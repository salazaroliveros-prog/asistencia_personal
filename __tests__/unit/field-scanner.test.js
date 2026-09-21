const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Carga field-scanner.js en un contexto aislado.
 *
 * `document.readyState` se deja en 'loading' para que el arranque automático
 * registre el listener de DOMContentLoaded en lugar de ejecutar init(): así el
 * módulo se evalúa sin necesidad de un DOM real y quedan disponibles los
 * ganchos de prueba de window.FieldScanner.
 *
 * @returns {Object} API pública expuesta en window.FieldScanner
 */
function loadFieldScanner() {
  const code = fs.readFileSync(
    path.resolve(__dirname, '../../field-scanner.js'),
    'utf8',
  );
  const window = { addEventListener() {} };
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById: () => null,
    querySelectorAll: () => [],
  };
  const context = vm.createContext({
    window,
    document,
    navigator: { onLine: true },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout,
    clearTimeout,
    Promise,
    Error,
    Date,
    JSON,
    console,
  });
  vm.runInContext(code, context);
  return window.FieldScanner;
}

describe('FieldScanner — validación de la sesión del operador', () => {
  it('acepta cualquier usuario con email verificado (modo abierto)', () => {
    const FieldScanner = loadFieldScanner();

    expect(FieldScanner.__validateSession({ email: 'cualquiera@gmail.com', emailVerified: true }))
      .toEqual({ ok: true });
  });

  it('permite operar una cuenta válida sin verificar (modo abierto)', () => {
    const FieldScanner = loadFieldScanner();

    // Las cuentas creadas a mano en Firebase Console nunca llegan verificadas.
    // Si el modo abierto las rechazara, el login daría "no me deja entrar".
    expect(FieldScanner.__validateSession({ email: 'cualquiera@gmail.com', emailVerified: false }))
      .toEqual({ ok: true });
  });

  it('en modo estricto exige el correo verificado', () => {
    const FieldScanner = loadFieldScanner();
    FieldScanner.__setRequireVerifiedEmail(true);

    expect(FieldScanner.__validateSession({ email: 'cualquiera@gmail.com', emailVerified: false }))
      .toEqual({ ok: false, reason: 'unverified' });
    expect(FieldScanner.__validateSession({ email: 'cualquiera@gmail.com', emailVerified: true }))
      .toEqual({ ok: true });
  });

  it('rechaza una sesión sin usuario', () => {
    const FieldScanner = loadFieldScanner();

    expect(FieldScanner.__validateSession(null)).toEqual({ ok: false, reason: 'unauthorized' });
    expect(FieldScanner.__validateSession(undefined)).toEqual({ ok: false, reason: 'unauthorized' });
    // Sin email no hay cuenta que autorizar, ni siquiera en modo abierto.
    expect(FieldScanner.__validateSession({ uid: 'x' })).toEqual({ ok: false, reason: 'unauthorized' });
    expect(FieldScanner.__validateSession({ email: '' })).toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('el usuario simulado de los tests e2e pasa la validación completa', async () => {
    const FieldScanner = loadFieldScanner();
    // __testLogin inyecta un usuario; si dejara de cumplir los requisitos, los
    // e2e de cámara y marcación fallarían al arrancar la app.
    await FieldScanner.__testLogin();

    expect(typeof FieldScanner.__validateSession).toBe('function');
  });
});

describe('FieldScanner — mensajes de error de marcación', () => {
  it('explica el fallo de permisos indicando revisar la verificación', () => {
    const FieldScanner = loadFieldScanner();

    const mensaje = FieldScanner.__mensajeErrorMarcacion({ code: 'firestore/permission-denied' });

    expect(mensaje).toMatch(/permiso/i);
    expect(mensaje).toMatch(/verificado/i);
  });

  it('distingue la pérdida de conexión', () => {
    const FieldScanner = loadFieldScanner();

    expect(FieldScanner.__mensajeErrorMarcacion({ code: 'firestore/unavailable' }))
      .toMatch(/sin conexión/i);
    expect(FieldScanner.__mensajeErrorMarcacion({ code: 'firestore/network-error' }))
      .toMatch(/sin conexión/i);
  });

  it('informa cuando la base de datos aún no está lista', () => {
    const FieldScanner = loadFieldScanner();

    expect(FieldScanner.__mensajeErrorMarcacion({ code: 'firestore/failed-precondition' }))
      .toMatch(/no lista/i);
  });

  it('usa un mensaje genérico para errores desconocidos', () => {
    const FieldScanner = loadFieldScanner();

    expect(FieldScanner.__mensajeErrorMarcacion({ code: 'algo-raro' }))
      .toBe('No se pudo registrar la marca');
    expect(FieldScanner.__mensajeErrorMarcacion(undefined))
      .toBe('No se pudo registrar la marca');
  });
});
