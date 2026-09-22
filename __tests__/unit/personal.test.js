/**
 * Control Personal Campo — Personal module unit tests
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const personalCode = fs.readFileSync(
  path.resolve(__dirname, '../../js/modules/personal.js'),
  'utf8',
);

// `const` declarations in vm.runInContext are NOT exposed on the sandbox.
// Wrap the code so the result gets assigned to mockCtx.ModuloPersonal via window.
const wrappedCode = personalCode + '\nwindow.__ModuloPersonal = typeof ModuloPersonal !== "undefined" ? ModuloPersonal : undefined;';

const mockWindow = {
  AppState: {
    get: (key) => {
      if (key === 'personal') return [];
      if (key === 'backendMode') return 'local';
      return undefined;
    },
    set: () => {},
    today: () => new Date().toISOString().slice(0, 10),
  },
  LS_KEYS: {
    PERSONAL_CACHE: 'cpc_personal_cache',
    FIREBASE_CONFIG: 'cpc_firebase_config',
  },
  API: {
    obtenerPersonal: async () => ({ success: true, data: [] }),
    registrarPersonal: async () => ({ success: true, message: 'OK' }),
    actualizarPersonal: async () => ({ success: true, message: 'OK' }),
    eliminarPersonal: async () => ({ success: true }),
  },
  Alerts: {
    success: () => ({ close: () => {} }),
    error:   () => ({ close: () => {} }),
    warning: () => ({ close: () => {} }),
    loading: () => ({ close: () => {} }),
    confirm: () => Promise.resolve(true),
  },
  DEFAULT_CONFIG: {},
  APP_NAME: 'Control Personal Campo',
  RequestOptimizer: {
    debounce: (_key, fn, _wait) => fn,
  },
  lucide: null,
  html2canvas: null,
  QRCode: null,
  CPC: {},
  Logger: null,
};

const mockCtx = vm.createContext({
  window: mockWindow,
  console,
  document: {
    getElementById: () => ({
      value: '',
      checked: false,
      textContent: '',
      src: '',
      style: {},
      hidden: false,
      addEventListener: () => {},
      onclick: null,
      onkeydown: null,
      innerHTML: '',
      rows: { length: 0 },
      querySelector: () => null,
      querySelectorAll: () => [],
      closest: () => null,
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => {} }),
      toDataURL: () => 'data:image/jpeg;base64,test',
    }),
    body: {
      classList: { add: () => {}, remove: () => {} },
      appendChild: () => {},
      removeChild: () => {},
    },
  },
  navigator: { mediaDevices: null },
  URL: {
    createObjectURL: () => 'blob:test',
    revokeObjectURL: () => {},
  },
  FileReader: class MockFileReader {
    readAsDataURL() {
      setTimeout(() => this.onload && this.onload({ target: { result: 'data:image/jpeg;base64,test' } }), 10);
    }
  },
  Image: class MockImage {
    constructor() { setTimeout(() => this.onload && this.onload(), 10); }
  },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  },
  location: {
    href: '', origin: '', pathname: '', search: '', hash: '',
    protocol: 'https:', host: 'localhost', hostname: 'localhost', port: '',
    assign: () => {}, replace: () => {}, reload: () => {},
  },
  fetch: () => Promise.resolve({}),
  alert: () => {},
  confirm: () => true,
  prompt: () => null,
  JSON,
  Math,
  Date,
  String,
  Array,
  Object,
  Promise,
  Error,
  TypeError,
  RangeError,
  SyntaxError,
  ReferenceError,
  RegExp,
  Map,
  Set,
  Symbol,
  WeakMap,
  WeakSet,
  Proxy,
  Reflect,
  Intl,
  DataView,
  Float32Array,
  Float64Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  BigInt64Array,
  BigUint64Array,
  encodeURI,
  decodeURI,
  encodeURIComponent,
  decodeURIComponent,
  isFinite,
  isNaN,
  parseFloat,
  parseInt,
});

try {
  vm.runInContext(wrappedCode, mockCtx);
} catch (e) {
  // Some DOM-dependent initialization may throw; that's acceptable
}

// Access via window.__ModuloPersonal (assigned in wrapper) or via context
const ModuloPersonal = mockCtx.window.__ModuloPersonal;

describe('ModuloPersonal', () => {
  it('exports as an object', () => {
    expect(ModuloPersonal).toBeDefined();
    expect(typeof ModuloPersonal).toBe('object');
    expect(ModuloPersonal).not.toBeNull();
  });

  it('exports init function', () => {
    expect(typeof ModuloPersonal.init).toBe('function');
  });

  it('exports cargar function', () => {
    expect(typeof ModuloPersonal.cargar).toBe('function');
  });
});
