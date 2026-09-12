import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, collection, doc, setDoc, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export const FirebaseClient = (() => {
  let db = null;
  let auth = null;
  let initialized = false;
  let connectionState = 'idle';
  const connectionListeners = [];

  const health = {
    healthy: false,
    lastCheck: 0,
    consecutiveFailures: 0,
    latencyMs: 0,
  };

  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY = 1000;
  const MAX_RECONNECT_DELAY = 30000;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let healthCheckInterval = null;

  function setConnectionState(state) {
    if (connectionState === state) return;
    connectionState = state;
    connectionListeners.forEach((cb) => { try { cb(state); } catch { /* noop */ } });
  }

  async function checkHealth() {
    if (!db) return false;
    const start = performance.now();
    try {
      await getDocs(collection(db, 'health'));
      health.latencyMs = Math.round(performance.now() - start);
      health.lastCheck = Date.now();
      health.consecutiveFailures = 0;
      health.healthy = true;
      if (connectionState === 'degraded' || connectionState === 'failed') setConnectionState('connected');
      return true;
    } catch {
      health.latencyMs = Math.round(performance.now() - start);
      health.lastCheck = Date.now();
      health.consecutiveFailures++;
      health.healthy = health.consecutiveFailures < 3;
      if (health.consecutiveFailures >= 3 && connectionState === 'connected') {
        setConnectionState('degraded');
        scheduleReconnect();
      }
      return false;
    }
  }

  function startHealthMonitor() {
    if (healthCheckInterval) return;
    healthCheckInterval = setInterval(() => {
      if (initialized && connectionState !== 'idle') checkHealth().catch(() => {});
    }, 30000);
  }

  function stopHealthMonitor() {
    if (healthCheckInterval) { clearInterval(healthCheckInterval); healthCheckInterval = null; }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) { setConnectionState('failed'); return; }
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      reconnectAttempts++;
      await attemptReconnect();
    }, delay);
  }

  async function attemptReconnect() {
    try {
      const result = await initialize(getStoredConfig());
      if (result.success) reconnectAttempts = 0;
      else scheduleReconnect();
    } catch {
      scheduleReconnect();
    }
  }

  function cancelReconnect() { if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } }

  function getStoredConfig() {
    try {
      const raw = localStorage.getItem('cpc_firebase_config');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function isValidConfig(config) {
    return Boolean(config.apiKey && config.authDomain && config.projectId && config.projectId.length > 2);
  }

  async function initialize(config) {
    if (!isValidConfig(config)) {
      setConnectionState('idle');
      return { success: false, configured: false, mode: 'local' };
    }
    if (connectionState === 'connecting') return { success: false, configured: true, mode: 'local', error: 'Conexión en progreso' };
    setConnectionState('connecting');
    cancelReconnect();

    try {
      if (!db) {
        const app = initializeApp(config);
        auth = getAuth(app);
        db = getFirestore(app);
        try { await enableIndexedDbPersistence(db); } catch { /* ignore */ }
      }
      if (auth && !auth.currentUser) {
        await signInAnonymously(auth);
      }
      await checkHealth();
      initialized = true;
      setConnectionState('connected');
      reconnectAttempts = 0;
      try { localStorage.setItem('cpc_firebase_config', JSON.stringify(config)); } catch { /* noop */ }
      startHealthMonitor();
      return { success: true, configured: true, mode: 'firestore', projectId: config.projectId };
    } catch (error) {
      initialized = false;
      db = null;
      setConnectionState('failed');
      return { success: false, configured: true, mode: 'local', error: error.message };
    }
  }

  function isReady() {
    return initialized && db !== null && (connectionState === 'connected' || connectionState === 'degraded');
  }

  async function saveAttendance(record) {
    if (!db) throw new Error('Firestore no conectado');
    const id = String(record.ID_Marcacion || record.id);
    const ref = doc(db, 'asistencias', id);
    await setDoc(ref, record, { merge: true });
    return record;
  }

  function subscribeAttendance(callback) {
    if (!db) return () => undefined;
    const q = query(collection(db, 'asistencias'), orderBy('Hora_Real', 'desc'), limit(200));
    const unsub = onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => { /* handled */ });
    return unsub;
  }

  function subscribeWorkers(callback) {
    if (!db) return () => undefined;
    const q = query(collection(db, 'personal'), orderBy('Nombre_Completo', 'asc'));
    const unsub = onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => { /* handled */ });
    return unsub;
  }

  function onConnectionChange(callback) {
    connectionListeners.push(callback);
    return () => { connectionListeners.splice(connectionListeners.indexOf(callback), 1); };
  }

  function stop() {
    cancelReconnect();
    stopHealthMonitor();
    initialized = false;
    db = null;
    setConnectionState('idle');
    health.healthy = false;
    health.consecutiveFailures = 0;
  }

  return {
    getConnectionState: () => connectionState,
    isReady,
    getHealth: () => ({ ...health }),
    initialize,
    saveAttendance,
    subscribeAttendance,
    subscribeWorkers,
    onConnectionChange,
    stop,
  };
})();
