/**
 * Control Personal Campo — FirebaseClient unit tests
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const firebaseClientCode = fs.readFileSync(
  path.resolve(__dirname, '../../js/firebase-client.js'),
  'utf8'
);

const firebaseConfigCode = fs.readFileSync(
  path.resolve(__dirname, '../../js/firebase-config.js'),
  'utf8'
);

const wrappedClientCode = firebaseClientCode + '\nwindow.__FirebaseClient = typeof FirebaseClient !== "undefined" ? FirebaseClient : undefined;';
const wrappedConfigCode = firebaseConfigCode + '\nwindow.__FirebaseConfigLoaded = true;';

function createMockContext(overrides = {}) {
  const mockFirebase = {
    apps: [],
    initializeApp: (config) => {
      if (!config || !config.apiKey || !config.projectId) {
        throw new Error('Firebase initialization failed: missing apiKey or projectId');
      }
      return {
        delete: () => Promise.resolve(),
      };
    },
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: () => Promise.resolve({ docs: [] }),
          set: () => Promise.resolve(),
          delete: () => Promise.resolve(),
        }),
        onSnapshot: () => () => {},
        where: () => ({ get: () => Promise.resolve({ docs: [] }) }),
        orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) }),
        limit: () => ({ get: () => Promise.resolve({ docs: [] }) }),
        get: () => Promise.resolve({ docs: [] }),
      }),
    }),
    auth: () => ({
      signInAnonymously: () => Promise.resolve({ user: { uid: 'test' } }),
      currentUser: { uid: 'test' },
      onAuthStateChanged: (cb) => {
        cb({ uid: 'test' });
        return () => {};
      },
    }),
  };

  const mockLocalStorage = {};
  const mockAppState = {
    get: (key) => {
      if (key === 'backendMode') return 'firestore';
      if (key === 'connected') return true;
      return undefined;
    },
    set: () => {},
    on: () => () => {},
    today: () => new Date().toISOString().slice(0, 10),
  };

  const sandbox = {
    bundledFirebaseConfig: overrides.bundledFirebaseConfig || {
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test.appspot.com',
      messagingSenderId: '123456',
      appId: '1:123456:web:abc',
    },
    __FIREBASE_ENV__: overrides.firebaseEnv || {},
    localStorage: {
      getItem: (key) => mockLocalStorage[key] || null,
      setItem: (key, value) => { mockLocalStorage[key] = value; },
      removeItem: (key) => { delete mockLocalStorage[key]; },
    },
    AppState: mockAppState,
    Logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    setInterval: () => 1,
    clearInterval: () => {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  context.globalThis.firebase = mockFirebase;
  context.window.firebase = mockFirebase;

  return { context, mockLocalStorage };
}

function runFirebaseClient(overrides = {}) {
  const { context, mockLocalStorage } = createMockContext(overrides);
  vm.runInContext(wrappedConfigCode, context);
  vm.runInContext(wrappedClientCode, context);
  return { window: context.globalThis || context, mockLocalStorage };
}

describe('FirebaseClient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('initialize crea instancia con config valida', async () => {
    const { window } = runFirebaseClient();
    expect(window.FirebaseClient).toBeDefined();
    const result = window.FirebaseClient.initialize();
    expect(result.success).toBe(true);
    expect(window.FirebaseClient.isReady()).toBe(true);
    expect(window.FirebaseClient.getConnectionState()).toBe('connected');
  });

  test('initialize falla sin config', async () => {
    const { window } = runFirebaseClient({ bundledFirebaseConfig: {} });
    const result = window.FirebaseClient.initialize();
    expect(result.success).toBe(false);
    expect(window.FirebaseClient.getConnectionState()).toBe('disconnected');
  });

  test('configure cambia credenciales y reinicia la conexion', async () => {
    const { window, mockLocalStorage } = runFirebaseClient();
    const newConfig = {
      apiKey: 'new-api-key',
      authDomain: 'new.firebaseapp.com',
      projectId: 'new-project',
      storageBucket: 'new.appspot.com',
      messagingSenderId: '999999',
      appId: '1:999999:web:xyz',
    };
    const result = await window.FirebaseClient.configure(newConfig);
    expect(result.success).toBe(true);
    expect(window.FirebaseClient.getConfig().apiKey).toBe('new-api-key');
    expect(window.FirebaseClient.getConfig().projectId).toBe('new-project');
    expect(mockLocalStorage['cpc_firebase_config']).toContain('new-api-key');
    expect(window.FirebaseClient.isReady()).toBe(true);
  });

  test('configure no acepta config incompleta', async () => {
    const { window } = runFirebaseClient();
    const result = await window.FirebaseClient.configure({ apiKey: 'solo-api-key' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Configuración de Firebase incompleta.');
  });

  test('stop limpia intervalos y estado', async () => {
    const { window } = runFirebaseClient();
    window.FirebaseClient.initialize();
    window.FirebaseClient.stop();
    expect(window.FirebaseClient.getConnectionState()).toBe('idle');
  });

  test('getConnectionState devuelve el estado actual', async () => {
    const { window } = runFirebaseClient();
    window.FirebaseClient.initialize();
    expect(window.FirebaseClient.getConnectionState()).toBe('connected');
  });

  test('isReady devuelve true cuando hay conexion', async () => {
    const { window } = runFirebaseClient();
    window.FirebaseClient.initialize();
    expect(window.FirebaseClient.isReady()).toBe(true);
  });

  test('getConfig devuelve window.FIREBASE_CONFIG', async () => {
    const { window } = runFirebaseClient();
    const config = window.FirebaseClient.getConfig();
    expect(config.projectId).toBe('test-project');
  });

  test('onConnectionChange registra listener y limpia al hacer unsubscribe', async () => {
    const { window } = runFirebaseClient();
    window.FirebaseClient.initialize();
    const callback = jest.fn();
    const unsubscribe = window.FirebaseClient.onConnectionChange(callback);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  test('initialize usa window.__FIREBASE_ENV__ cuando esta disponible', async () => {
    const { window } = runFirebaseClient({
      bundledFirebaseConfig: {},
      firebaseEnv: {
        apiKey: 'env-api-key',
        authDomain: 'env.firebaseapp.com',
        projectId: 'env-project',
        storageBucket: 'env.appspot.com',
        messagingSenderId: '777777',
        appId: '1:777777:web:env',
      },
    });
    const result = window.FirebaseClient.initialize();
    expect(result.success).toBe(true);
    expect(window.FirebaseClient.getConfig().projectId).toBe('env-project');
  });

  test('configure persiste en localStorage y actualiza window.FIREBASE_CONFIG', async () => {
    const { window, mockLocalStorage } = runFirebaseClient();
    const newConfig = {
      apiKey: 'persist-api-key',
      authDomain: 'persist.firebaseapp.com',
      projectId: 'persist-project',
      storageBucket: 'persist.appspot.com',
      messagingSenderId: '888888',
      appId: '1:888888:web:persist',
    };
    await window.FirebaseClient.configure(newConfig);
    const stored = JSON.parse(mockLocalStorage['cpc_firebase_config']);
    expect(stored.projectId).toBe('persist-project');
    expect(window.FIREBASE_CONFIG.projectId).toBe('persist-project');
  });

  test('getHealth devuelve datos del health check', async () => {
    const { window } = runFirebaseClient();
    window.FirebaseClient.initialize();
    const health = window.FirebaseClient.getHealth();
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('lastCheck');
    expect(health).toHaveProperty('consecutiveFailures');
    expect(health).toHaveProperty('latencyMs');
  });
});
