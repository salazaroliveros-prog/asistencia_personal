/**
 * Logger no debe llamar firebase.auth() si no hay app inicializada.
 * Regresión del error de producción:
 *   Firebase: No Firebase App '[DEFAULT]' has been created
 * que rompía _guardarPersonal al invocar Logger.info.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadLogger(firebaseStub) {
  const code = fs.readFileSync(
    path.resolve(__dirname, '../../js/utils/logger.js'),
    'utf8',
  );
  const window = {
    addEventListener() {},
    firebase: firebaseStub,
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
    },
  };
  const context = vm.createContext({
    window,
    console,
    Date,
    Math,
    JSON,
    Error,
    location: { hostname: 'example.com' },
  });
  vm.runInContext(code, context);
  return { Logger: window.Logger, window };
}

describe('Logger — acceso seguro a Firebase Auth', () => {
  it('no lanza si firebase existe pero no hay apps inicializadas', () => {
    const authFn = jest.fn(() => {
      throw new Error("Firebase: No Firebase App '[DEFAULT]' has been created");
    });
    authFn.GoogleAuthProvider = function GoogleAuthProvider() {};

    const { Logger } = loadLogger({
      apps: [],
      auth: authFn,
    });

    expect(() => {
      Logger.info('ModuloPersonal', 'Iniciando guardado de trabajador', { isEdit: false });
    }).not.toThrow();
    expect(authFn).not.toHaveBeenCalled();
  });

  it('usa FirebaseClient.getCurrentUser cuando está disponible', () => {
    const { Logger, window } = loadLogger({ apps: [] });
    window.FirebaseClient = {
      getCurrentUser: () => ({ uid: 'user-123' }),
    };

    Logger.info('Test', 'con usuario');
    const logs = Logger.getLogs('INFO', 'Test');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[logs.length - 1].userId).toBe('user-123');
  });
});
