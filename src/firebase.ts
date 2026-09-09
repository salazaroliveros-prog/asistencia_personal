type FirestoreRecord = Record<string, unknown>;
export {};

interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  [key: string]: unknown;
}

interface FirebaseAdapter {
  getConfig(): FirebaseConfig;
  isConfigured(config?: FirebaseConfig): boolean;
  initialize(config?: FirebaseConfig): Promise<{ success: boolean; configured: boolean; mode: string; error?: string; projectId?: string }>;
  isReady(): boolean;
  list(collection: string, orderField?: string | null): Promise<FirestoreRecord[]>;
  save(collection: string, recordId: string, data: FirestoreRecord): Promise<FirestoreRecord>;
  remove(collection: string, recordId: string): Promise<void>;
  subscribe(collection: string, callback: (records: FirestoreRecord[]) => void): () => void;
  stop(): void;
}

declare global {
  interface Window {
    firebase?: {
      apps: unknown[];
      initializeApp(config: FirebaseConfig): void;
      auth(): { currentUser: unknown; signInAnonymously(): Promise<unknown> };
      firestore(): {
        enablePersistence(options: { synchronizeTabs: boolean }): Promise<void>;
        collection(name: string): {
          orderBy(field: string, direction: string): { get(): Promise<{ docs: Array<{ id: string; data(): FirestoreRecord }> }> };
          get(): Promise<{ docs: Array<{ id: string; data(): FirestoreRecord }> }>;
          doc(id?: string): {
            set(data: FirestoreRecord, options: { merge: boolean }): Promise<void>;
            delete(): Promise<void>;
          };
          onSnapshot(onNext: (snapshot: { docs: Array<{ id: string; data(): FirestoreRecord }> }) => void, onError: (error: Error) => void): () => void;
        };
        FieldValue: { serverTimestamp(): unknown };
      };
    };
    FirebaseClient: FirebaseAdapter;
  }
}

let database: ReturnType<NonNullable<Window['firebase']>['firestore']> | null = null;
let initialized = false;
const listeners: Array<() => void> = [];

function getConfig(): FirebaseConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(window.LS_KEYS.FIREBASE_CONFIG) || '{}') as FirebaseConfig;
    return { ...(window as Window & { FIREBASE_CONFIG?: FirebaseConfig }).FIREBASE_CONFIG, ...saved };
  } catch { return {}; }
}

function isConfigured(config = getConfig()): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
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

const FirebaseClient: FirebaseAdapter = {
  getConfig,
  isConfigured,
  async initialize(config = getConfig()) {
    if (!window.firebase || !isConfigured(config)) return { success: false, configured: false, mode: 'local' };
    try {
      if (window.firebase.apps.length === 0) window.firebase.initializeApp(config);
      const auth = window.firebase.auth();
      database = window.firebase.firestore();
      try { await database.enablePersistence({ synchronizeTabs: true }); }
      catch (error) { console.info('[Firestore] Persistencia local no habilitada:', (error as Error).message); }
      if (!auth.currentUser) await auth.signInAnonymously();
      initialized = true;
      window.AppState.set('backendMode', 'firestore');
      window.AppState.set('connected', true);
      return { success: true, configured: true, mode: 'firestore', projectId: config.projectId };
    } catch (error) {
      initialized = false;
      database = null;
      window.AppState.set('backendMode', 'local');
      window.AppState.set('connected', false);
      return { success: false, configured: true, mode: 'local', error: (error as Error).message };
    }
  },
  isReady: () => initialized && database !== null,
  async list(name, orderField = null) {
    if (!database) throw new Error('Firestore no está conectado.');
    let query = database.collection(name);
    const snapshot = orderField ? await query.orderBy(orderField, 'desc').get() : await query.get();
    return snapshot.docs.map(serialize);
  },
  async save(name, recordId, data) {
    if (!database || !window.firebase) throw new Error('Firestore no está conectado.');
    const reference = database.collection(name).doc(recordId || undefined);
    await reference.set({ ...data, updatedAt: window.firebase.firestore().FieldValue.serverTimestamp() }, { merge: true });
    return { ...data, ID_Registro: recordId };
  },
  async remove(name, recordId) {
    if (!database) throw new Error('Firestore no está conectado.');
    await database.collection(name).doc(recordId).delete();
  },
  subscribe(name, callback) {
    if (!database) return () => undefined;
    const unsubscribe = database.collection(name).onSnapshot(snapshot => callback(snapshot.docs.map(serialize)), error => console.warn(`[Firestore] Suscripción ${name}:`, error.message));
    listeners.push(unsubscribe);
    return unsubscribe;
  },
  stop() {
    listeners.splice(0).forEach(unsubscribe => unsubscribe());
    initialized = false;
    database = null;
    window.AppState.set('backendMode', 'local');
    window.AppState.set('connected', false);
  },
};

window.FirebaseClient = FirebaseClient;
