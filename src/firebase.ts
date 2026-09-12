type FirestoreRecord = Record<string, unknown>;
export {};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS E INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'degraded' | 'failed';

interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  [key: string]: unknown;
}

interface FirebaseHealth {
  healthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  latencyMs: number;
}

interface FirebaseAdapter {
  getConfig(): FirebaseConfig;
  isConfigured(config?: FirebaseConfig): boolean;
  initialize(config?: FirebaseConfig): Promise<{ success: boolean; configured: boolean; mode: string; error?: string; projectId?: string }>;
  isReady(): boolean;
  getConnectionState(): ConnectionState;
  list(collection: string, orderField?: string | null, limit?: number): Promise<FirestoreRecord[]>;
  save(collection: string, recordId: string, data: FirestoreRecord): Promise<FirestoreRecord>;
  remove(collection: string, recordId: string): Promise<void>;
  subscribe(collection: string, callback: (records: FirestoreRecord[]) => void): () => void;
  stop(): void;
  onConnectionChange(callback: (state: ConnectionState) => void): () => void;
  getHealth(): FirebaseHealth;
}

// ─────────────────────────────────────────────────────────────────────────────
// DECLARACIONES GLOBALES
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    firebase?: {
      apps: unknown[];
      initializeApp(config: FirebaseConfig): void;
      auth(): { 
        currentUser: unknown; 
        signInAnonymously(): Promise<{ user: unknown }>; 
        onAuthStateChanged(callback: (user: unknown) => void): () => void;
      };
      firestore(): {
        enablePersistence(options: { synchronizeTabs: boolean }): Promise<void>;
      collection(name: string): {
        orderBy(field: string, direction: string): { 
          get(): Promise<{ docs: Array<{ id: string; data(): FirestoreRecord }> }>; 
          limit(count: number): { get(): Promise<{ docs: Array<{ id: string; data(): FirestoreRecord }> }> };
        };
        get(): Promise<{ docs: Array<{ id: string; data(): FirestoreRecord }> }>;
        doc(id?: string): {
          set(data: FirestoreRecord, options: { merge: boolean }): Promise<void>;
          delete(): Promise<void>;
          get(): Promise<{ exists: boolean; data(): FirestoreRecord }>;
        };
        onSnapshot(onNext: (snapshot: { docs: Array<{ id: string; data(): FirestoreRecord }> }) => void, onError: (error: Error) => void): () => void;
      };
        FieldValue: { serverTimestamp(): unknown };
      };
    };
    FirebaseClient: FirebaseAdapter;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO INTERNO
// ─────────────────────────────────────────────────────────────────────────────

let database: ReturnType<NonNullable<Window['firebase']>['firestore']> | null = null;
let initialized = false;
let connectionState: ConnectionState = 'idle';
const listeners: Array<() => void> = [];
const connectionListeners: Array<(state: ConnectionState) => void> = [];

// Health monitoring
const health: FirebaseHealth = {
  healthy: false,
  lastCheck: 0,
  consecutiveFailures: 0,
  latencyMs: 0,
};

// Reconnection state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let healthCheckInterval: ReturnType<typeof setInterval> | null = null;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const HEALTH_FAILURE_THRESHOLD = 3;

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

function getConfig(): FirebaseConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(window.LS_KEYS.FIREBASE_CONFIG) || '{}') as FirebaseConfig;
    return { ...(window as Window & { FIREBASE_CONFIG?: FirebaseConfig }).FIREBASE_CONFIG, ...saved };
  } catch { 
    return {}; 
  }
}

function isConfigured(config = getConfig()): boolean {
  return Boolean(
    config.apiKey && 
    config.authDomain && 
    config.projectId && 
    config.appId &&
    config.apiKey.length > 10 &&
    config.projectId.length > 2
  );
}

function validateConfig(config: FirebaseConfig): { valid: boolean; error?: string } {
  if (!config.apiKey || config.apiKey.length <= 10) {
    return { valid: false, error: 'API Key inválida o vacía.' };
  }
  if (!config.authDomain || !config.authDomain.includes('.firebaseapp.com')) {
    return { valid: false, error: 'Dominio de autenticación inválido. Debe terminar en .firebaseapp.com' };
  }
  if (!config.projectId || config.projectId.length <= 2) {
    return { valid: false, error: 'ID del proyecto inválido.' };
  }
  if (!config.appId || config.appId.length <= 5) {
    return { valid: false, error: 'App ID inválido.' };
  }
  return { valid: true };
}

function setConnectionState(state: ConnectionState): void {
  if (connectionState === state) return;
  connectionState = state;
  window.AppState.set('connected', state === 'connected' || state === 'degraded');
  connectionListeners.forEach(callback => {
    try { callback(state); } catch (e) { console.error('[Firebase] Connection listener error:', e); }
  });
}

function serialize(document: { id: string; data(): FirestoreRecord }): FirestoreRecord {
  const data = { ...document.data() };
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      data[key] = (value as { toDate(): Date }).toDate().toISOString();
    }
  }
  return { ...data, _docId: document.id };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getReconnectDelay(): number {
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  return delay + Math.random() * 1000; // Add jitter
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH MONITOR
// ─────────────────────────────────────────────────────────────────────────────

async function checkHealth(): Promise<boolean> {
  if (!database || !initialized) return false;
  
  const start = performance.now();
  try {
    await database.collection('health').doc('ping').get();
    health.latencyMs = Math.round(performance.now() - start);
    health.lastCheck = Date.now();
    health.consecutiveFailures = 0;
    health.healthy = true;
    
    if (connectionState === 'degraded' || connectionState === 'failed') {
      setConnectionState('connected');
    }
    return true;
  } catch (error) {
    health.latencyMs = Math.round(performance.now() - start);
    health.lastCheck = Date.now();
    health.consecutiveFailures++;
    health.healthy = health.consecutiveFailures < HEALTH_FAILURE_THRESHOLD;
    
    if (health.consecutiveFailures >= HEALTH_FAILURE_THRESHOLD && connectionState === 'connected') {
      console.warn('[Firebase] Health check failed, transitioning to degraded');
      setConnectionState('degraded');
      scheduleReconnect();
    }
    return false;
  }
}

function startHealthMonitor(): void {
  if (healthCheckInterval) return;
  healthCheckInterval = setInterval(() => {
    if (initialized && connectionState !== 'idle') {
      checkHealth().catch(() => {});
    }
  }, HEALTH_CHECK_INTERVAL);
}

function stopHealthMonitor(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECONNECTION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn('[Firebase] Max reconnection attempts reached');
    setConnectionState('failed');
    return;
  }
  
  const delay = getReconnectDelay();
  console.log(`[Firebase] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
  setConnectionState('connecting');
  
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    reconnectAttempts++;
    await attemptReconnect();
  }, delay);
}

async function attemptReconnect(): Promise<void> {
  if (!isConfigured()) {
    setConnectionState('failed');
    return;
  }
  
  try {
    const result = await initialize(getConfig());
    if (result.success) {
      reconnectAttempts = 0;
      console.log('[Firebase] Reconnected successfully');
    } else {
      scheduleReconnect();
    }
  } catch (error) {
    console.warn('[Firebase] Reconnection failed:', error);
    scheduleReconnect();
  }
}

function cancelReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE CLIENT
// ─────────────────────────────────────────────────────────────────────────────

async function initialize(config = getConfig()): Promise<{ success: boolean; configured: boolean; mode: string; error?: string; projectId?: string }> {
  // Validate config first
  const validation = validateConfig(config);
  if (!validation.valid) {
    setConnectionState('failed');
    return { success: false, configured: false, mode: 'local', error: validation.error };
  }
  
  if (!window.firebase || !isConfigured(config)) {
    setConnectionState('idle');
    return { success: false, configured: false, mode: 'local' };
  }
  
  // Prevent concurrent initialization
  if (connectionState === 'connecting') {
    return { success: false, configured: true, mode: 'local', error: 'Conexión en progreso...' };
  }
  
  setConnectionState('connecting');
  cancelReconnect();
  
  try {
    // Initialize app if not already done
    if (window.firebase.apps.length === 0) {
      window.firebase.initializeApp(config);
    }
    
    const auth = window.firebase.auth();
    database = window.firebase.firestore();
    
    // Enable persistence with proper error handling
    try {
      await database.enablePersistence({ synchronizeTabs: true });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('already configured') || err.message.includes('already initialized')) {
        console.info('[Firebase] Persistence already enabled');
      } else {
        console.warn('[Firebase] Local persistence disabled:', err.message);
      }
    }
    
    // Anonymous auth with proper error handling
    try {
      if (!auth.currentUser) {
        await auth.signInAnonymously();
      }
    } catch (error) {
      const err = error as Error;
      console.warn('[Firebase] Anonymous auth failed:', err.message);
      // Continue without auth - some Firestore operations may still work
    }
    
    // Initial health check
    await checkHealth();
    
    initialized = true;
    setConnectionState('connected');
    reconnectAttempts = 0;
    
    // Persist successful config
    try {
      localStorage.setItem(window.LS_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.warn('[Firebase] Could not persist config:', e);
    }
    
    window.AppState.set('backendMode', 'firestore');
    
    return { 
      success: true, 
      configured: true, 
      mode: 'firestore', 
      projectId: config.projectId 
    };
  } catch (error) {
    initialized = false;
    database = null;
    setConnectionState('failed');
    window.AppState.set('backendMode', 'local');
    return { 
      success: false, 
      configured: true, 
      mode: 'local', 
      error: (error as Error).message 
    };
  }
}

function isReady(): boolean {
  return initialized && database !== null && (connectionState === 'connected' || connectionState === 'degraded');
}

async function list(name: string, orderField: string | null = null, limitCount: number = 500): Promise<FirestoreRecord[]> {
  if (!database) throw new Error('Firestore no está conectado.');
  
  let query: any = database.collection(name);
  
  if (orderField) {
    query = query.orderBy(orderField, 'desc');
  }
  
  if (limitCount > 0) {
    query = query.limit(limitCount);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(serialize);
}

async function save(name: string, recordId: string, data: FirestoreRecord): Promise<FirestoreRecord> {
  if (!database || !window.firebase) throw new Error('Firestore no está conectado.');
  const reference = database.collection(name).doc(recordId || undefined);
  await reference.set({ 
    ...data, 
    updatedAt: window.firebase.firestore().FieldValue.serverTimestamp() 
  }, { merge: true });
  return { ...data, ID_Registro: recordId };
}

async function remove(name: string, recordId: string): Promise<void> {
  if (!database) throw new Error('Firestore no está conectado.');
  await database.collection(name).doc(recordId).delete();
}

function subscribe(name: string, callback: (records: FirestoreRecord[]) => void): () => void {
  if (!database) {
    console.warn(`[Firebase] Cannot subscribe to ${name}: not connected`);
    return () => undefined;
  }
  
  const unsubscribe = database.collection(name).onSnapshot(
    snapshot => callback(snapshot.docs.map(serialize)),
    error => console.warn(`[Firestore] Suscripción ${name}:`, error.message)
  );
  
  listeners.push(unsubscribe);
  return unsubscribe;
}

function stop(): void {
  cancelReconnect();
  stopHealthMonitor();
  
  listeners.splice(0).forEach(unsubscribe => {
    try { unsubscribe(); } catch (e) { /* ignore cleanup errors */ }
  });
  
  initialized = false;
  database = null;
  connectionState = 'idle';
  health.healthy = false;
  health.consecutiveFailures = 0;
  
  window.AppState.set('backendMode', 'local');
  window.AppState.set('connected', false);
}

function onConnectionChange(callback: (state: ConnectionState) => void): () => void {
  connectionListeners.push(callback);
  return () => {
    connectionListeners.splice(connectionListeners.indexOf(callback), 1);
  };
}

function getHealth(): FirebaseHealth {
  return { ...health };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR CLIENTE
// ─────────────────────────────────────────────────────────────────────────────

const FirebaseClient: FirebaseAdapter = {
  getConfig,
  isConfigured,
  initialize,
  isReady,
  getConnectionState: () => connectionState,
  list,
  save,
  remove,
  subscribe,
  stop,
  onConnectionChange,
  getHealth,
};

window.FirebaseClient = FirebaseClient;

// Auto-initialize if config exists (zero-user-intervention)
// This runs when the module is loaded, before app.js starts
if (isConfigured() && window.firebase) {
  const config = getConfig();
  initialize(config).catch(error => {
    console.warn('[Firebase] Auto-initialization failed:', error);
  });
}
