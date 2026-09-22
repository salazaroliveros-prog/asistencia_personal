/**
 * VALIDACIÓN DE LOGIN Y SINCRONIZACIÓN BILATERAL (offline/online/real-time)
 *
 * Cubre los 3 escenarios pedidos:
 *  1) LOGIN — credenciales correo+contraseña conectan con la base de datos y
 *     cargan los datos de Firestore (simula REINSTALACIÓN con caché vacía:
 *     los trabajadores vuelven a mostrarse desde la BD, no desde localStorage).
 *  2) OFFLINE→ONLINE — un trabajador registrado sin conexión se sincroniza
 *     automáticamente al reconectar (iniciar sesión / volver online).
 *  3) REAL-TIME BILATERAL — una marcación hecha desde otro dispositivo aparece
 *     en esta pestaña sin recargar (suscrito personal + asistencias).
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';

const SEED = [
  { ID_Trabajador: 'RT-001', Nombre_Completo: 'Juan Pérez Gómez', Puesto: 'Albañil', DPI_CUI: '30158847100101', Estado: 'Activo' },
  { ID_Trabajador: 'RT-002', Nombre_Completo: 'Ana Lucía Torres', Puesto: 'Electricista', DPI_CUI: '30158847100102', Estado: 'Activo' },
  { ID_Trabajador: 'RT-003', Nombre_Completo: 'Carlos Méndez López', Puesto: 'Maestro de Obra', DPI_CUI: '30158847100103', Estado: 'Activo' },
  { ID_Trabajador: 'RT-004', Nombre_Completo: 'Miguel Ángel Ruiz', Puesto: 'Bodeguero', DPI_CUI: '30158847100104', Estado: 'Activo' },
];

const EMAIL = 'operador@cpc.local';
const PASSWORD = 'clave-segura';
const FS_KEY = '__e2e_fs';

/**
 * Mock de Firebase con sesión mutable: arranca SIN usuario (simula dispositivo
 * recién instalado / deslogueado) y la sesión cambia únicamente vía
 * signInWithEmailAndPassword (login real de la UI). La "base de datos"
 * persiste en localStorage.__e2e_fs (sobrevive al borrado de la caché de la app).
 */
function loginMockInitScript(arg: { __SEED__: unknown[]; autoconnect?: boolean; __EMAIL__?: string }) {
  const FS_KEY = '__e2e_fs';
  const SEED_FLAG = '__e2e_fs_seeded_login';
  const EMAIL_ARG = arg.__EMAIL__ || 'operador@cpc.local';
  const authUser = { uid: 'operador-e2e', email: EMAIL_ARG, emailVerified: true, refreshToken: 'x' };
  let user: typeof authUser | null = arg.autoconnect ? authUser : null;
  let authCbs: Array<(u: typeof authUser | null) => void> = [];

  function readFs(): any { try { return JSON.parse(localStorage.getItem(FS_KEY) || '{}'); } catch { return {}; } }
  function writeFs(s: any) { localStorage.setItem(FS_KEY, JSON.stringify(s)); }

  if (sessionStorage.getItem(SEED_FLAG) !== '1') {
    sessionStorage.setItem(SEED_FLAG, '1');
    if (localStorage.getItem(FS_KEY) == null) {
      writeFs({
        personal: (arg.__SEED__ as Array<Record<string, unknown>>).map((w) => ({ id: w.ID_Trabajador, data: { ...w } })),
        asistencias: [],
        configuracion: [{ id: 'general', data: { Nombre_App: 'CPC', Nombre_Obra: 'Obra Principal', Tolerancia_Minutos: 15 } }],
      });
    }
  }

  window.__e2eFsCbs = (window as any).__e2eFsCbs || {};

  function evaluateDocs(colName: string) {
    return (readFs()[colName] || []).map((d: any) => ({ ...d.data, id: d.id }));
  }
  function reemitSnapshots() {
    Object.keys(window.__e2eFsCbs).forEach((col) => {
      const docs = evaluateDocs(col).map((r: any) => ({ id: r.ID_Trabajador || r.id, data: () => ({ ...r }) }));
      window.__e2eFsCbs[col].slice().forEach((cb: any) => cb({ docs }));
    });
  }

  function makeQuery(colName: string) {
    const q: any = {
      where() { return q; },
      orderBy() { return q; },
      limit() { return q; },
      doc(id: string) {
        const holder = { col: id };
        return {
          get: async () => {
            const d = (readFs()[colName] || []).find((x: any) => x.id === holder.col);
            return { exists: !!d, data: () => (d ? { ...d.data } : null) };
          },
          set: async (data: any, opts: any) => {
            const s = readFs();
            s[colName] = s[colName] || [];
            const i = s[colName].findIndex((x: any) => x.id === holder.col);
            if (i >= 0) s[colName][i].data = opts && opts.merge ? { ...s[colName][i].data, ...data } : { ...data };
            else s[colName].push({ id: holder.col, data: { ...data } });
            writeFs(s);
            reemitSnapshots();
          },
          delete: async () => {
            const s = readFs();
            s[colName] = (s[colName] || []).filter((x: any) => x.id !== holder.col);
            writeFs(s);
            reemitSnapshots();
          },
        };
      },
      onSnapshot(cb: any) {
        (window.__e2eFsCbs[colName] = window.__e2eFsCbs[colName] || []).push(cb);
        const docs = evaluateDocs(colName).map((r: any) => ({ id: r.ID_Trabajador || r.id, data: () => ({ ...r }) }));
        setTimeout(() => cb({ docs }), 0);
        return () => {
          window.__e2eFsCbs[colName] = (window.__e2eFsCbs[colName] || []).filter((c: any) => c !== cb);
        };
      },
    };
    return q;
  }

  const db: any = {
    collection: (name: string) => makeQuery(name),
    runTransaction: async (fn: any) => { const tx = { get: async () => ({ exists: false }), set() {}, update() {}, delete() {} }; await fn(tx); },
    doc: (path: string) => {
      const parts = String(path).split('/');
      return makeQuery(parts[0]).doc(parts[1]);
    },
  };

  const auth = {
    get currentUser() { return user; },
    onAuthStateChanged: (cb: any) => {
      authCbs.push(cb);
      setTimeout(() => cb(user), 0);
      return () => { authCbs = authCbs.filter((c) => c !== cb); };
    },
    signInAnonymously: async () => ({ user: authUser }),
    signInWithEmailAndPassword: async (email: string) => {
      user = { ...authUser, email: (email || EMAIL_ARG).trim() };
      authCbs.slice().forEach((cb) => cb(user));
      return { user: authUser };
    },
    signInWithPopup: async () => {
      user = { uid: 'google-user-e2e', email: 'juan.gmail.real@gmail.com', emailVerified: true, refreshToken: 'g' };
      authCbs.slice().forEach((cb) => cb(user));
      return { user: { ...user } };
    },
    signOut: async () => {
      user = null;
      authCbs.slice().forEach((cb) => cb(null));
    },
    setPersistence: async () => {},
    Auth: { Persistence: { LOCAL: 'local' } },
  };
  auth.GoogleAuthProvider = class GoogleAuthProvider {};

  const mkFirebase = () => ({
    apps: [],
    initializeApp: () => ({}),
    firestore: () => db,
    auth: () => auth,
    functions: () => ({ httpsCallable: () => async () => ({ data: {} }) }),
    storage: () => ({ ref: () => ({ put: async () => ({ ref: { getDownloadURL: async () => '' } }), getDownloadURL: async () => '' }) }),
    Auth: auth.Auth,
  });
  Object.defineProperty(window, 'firebase', { configurable: false, get: () => mkFirebase(), set: () => {} });
  window.FIREBASE_ALLOW_ANONYMOUS = false;
  window.__FIREBASE_ENV__ = null;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: any) => ok({ coords: { latitude: 14.63492, longitude: -90.50693, accuracy: 10 } }), watchPosition: () => 0, clearWatch: () => {} },
  });

  // Push de Firestore emulada: una escritura de otro tab re-emite los snapshots.
  window.addEventListener('storage', (e: StorageEvent) => {
    if ((e as any).key === FS_KEY) reemitSnapshots();
  });
}

async function boot(page: Page, hash: string, autoconnect = false) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(loginMockInitScript as any, { __SEED__: SEED, __EMAIL__: EMAIL, autoconnect });
  await page.goto(`${BASE_URL}/index.html#${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForSelector(`#page-${hash}`, { timeout: 10000 }).catch(() => {});
}

async function registrarDesdeFormulario(page: Page, nombre: string, dpi: string, puesto: string) {
  await page.locator('#btn-nuevo-personal').click();
  await expect(page.locator('#modal-personal')).toBeVisible();
  await page.fill('#p-nombre', nombre);
  await page.fill('#p-dpi', dpi);
  await page.selectOption('#p-puesto', puesto);
  await page.fill('#p-jefe', 'Ing. Salazar');
  await page.locator('#btn-guardar-personal').click({ force: true });
  await expect(page.locator('#modal-personal')).toBeHidden({ timeout: 15000 });
}

test('LOGIN (+ reinstalación): credenciales correo/contraseña conectan y los datos vuelven desde la BD', async ({ page }) => {
  await boot(page, 'ajustes');

  // Reinstalación simulada: caché de la app vacía (localStorage cpc_* limpio),
  // solo la "base de datos" (__e2e_fs) conserva los trabajadores.
  await page.evaluate(() => {
    ['cpc_personal_cache', 'cpc_attendance_cache', 'cpc_config', 'cpc_offline_queue'].forEach((k) => localStorage.removeItem(k));
  });
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('__e2e_fs') || '{}'); (window as any).__e2eCacheLen = (s.personal || []).length; });

  // Antes del login: sin sesión y sin datos en caché
  expect(await page.evaluate(() => window.AppState.get('connected'))).toBe(false);

  // LOGIN con correo y contraseña vía la UI real
  await page.fill('#firebase-auth-email', EMAIL);
  await page.fill('#firebase-auth-password', PASSWORD);
  await page.locator('#btn-login-firebase').click();

  // Sesión activa confirmada en el indicador de conexión
  await expect(page.locator('#connection-status-detail')).toContainText('Sesión activa', { timeout: 15000 });
  expect(await page.evaluate(() => window.AppState.get('connected'))).toBe(true);
  expect(await page.evaluate(() => (window.FirebaseClient.getCurrentUser() || { email: null }).email)).toBe(EMAIL);

  // Los datos están en la BD (__e2eCacheLen) y AHORA sí se cargan en la app
  await page.evaluate(() => { window.location.hash = '#personal'; });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(4, { timeout: 15000 });
  await expect(page.locator('#personal-tbody')).toContainText('Juan Pérez Gómez');

  // La caché de la app quedó repoblada DESDE Firestore
  const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]').length);
  expect(cache).toBe(4);
});

test('OFFLINE→ONLINE: registrado sin conexión se sincroniza automáticamente al conectar', async ({ page }) => {
  await boot(page, 'personal');

  // Arranca deslogueado (offline local). Registrar trabajador → cola pendiente.
  await expect(page.locator('#personal-tbody')).toContainText('No se encontraron trabajadores', { timeout: 10000 });
  await registrarDesdeFormulario(page, 'Operario Offline Sync', '6123456789012', 'Albañil');
  await expect(page.locator('#personal-tbody')).toContainText('Operario Offline Sync', { timeout: 10000 });

  const antes = await page.evaluate(() => ({
    connected: window.AppState.get('connected'),
    queue: JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]').length,
    fsLen: (JSON.parse(localStorage.getItem('__e2e_fs') || '{}').personal || []).length,
  }));
  expect(antes.connected).toBe(false);
  expect(antes.queue).toBe(1);
  expect(antes.fsLen).toBe(4); // la BD aún no lo tiene

  // Reconexión: iniciar sesión → auto-sync de la cola offline
  await page.evaluate(() => { window.location.hash = '#ajustes'; });
  await page.waitForSelector('#firebase-auth-email', { timeout: 10000 });
  await page.fill('#firebase-auth-email', EMAIL);
  await page.fill('#firebase-auth-password', PASSWORD);
  await page.locator('#btn-login-firebase').click();
  await expect(page.locator('#connection-status-detail')).toContainText('Sesión activa', { timeout: 15000 });

  // La cola se drenó y la BD ya tiene el trabajador
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]').length), { timeout: 15000 }).toBe(0);
  const despues = await page.evaluate(() => JSON.parse(localStorage.getItem('__e2e_fs') || '{}').personal || []);
  expect(despues.some((d: any) => d.data.Nombre_Completo === 'Operario Offline Sync')).toBe(true);

  // Las suscripciones real-time quedaron activas (bilateral)
  const subs = await page.evaluate(() => ({
    personal: ((window as any).__e2eFsCbs.personal || []).length,
    asistencias: ((window as any).__e2eFsCbs.asistencias || []).length,
  }));
  expect(subs.personal).toBeGreaterThan(0);
  expect(subs.asistencias).toBeGreaterThan(0);
});

test('REAL-TIME BILATERAL: marcación desde el móvil aparece en el escritorio sin recargar', async ({ page }) => {
  await boot(page, 'asistencia', true); // escritorio conectado

  const mobile = await page.context().newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.addInitScript(loginMockInitScript as any, { __SEED__: SEED, __EMAIL__: EMAIL, autoconnect: true });
  await mobile.goto(`${BASE_URL}/index.html#asistencia`, { waitUntil: 'domcontentloaded' });

  // El escritorio tiene la suscripción real-time de asistencias (feature nueva)
  await expect.poll(async () => page.evaluate(() => ((window as any).__e2eFsCbs.asistencias || []).length), { timeout: 10000 }).toBeGreaterThan(0);

  // Móvil: marcación manual de entrada
  await mobile.locator('#tab-btn-manual').click();
  await mobile.fill('#manual-worker-search', 'Juan');
  await expect(mobile.locator('#autocomplete-list')).toBeVisible({ timeout: 10000 });
  await mobile.locator('#autocomplete-list li').first().click({ force: true });
  await expect(mobile.locator('#manual-worker-selected')).toBeVisible();
  await mobile.locator('#manual-worker-selected .btn-marcacion.btn-entrada').first().click({ force: true });
  await expect(mobile.locator('#asistencia-tbody')).toContainText('Juan Pérez Gómez', { timeout: 10000 });

  // ESCRITORIO: recibe la marcación en tiempo real, sin recargar
  await expect(page.locator('#asistencia-tbody')).toContainText('Juan Pérez Gómez', { timeout: 15000 });

  // y quedó persistida en la "BD" (bilateral: escritura remota llegó a Firestore)
  const asis = await page.evaluate(() => JSON.parse(localStorage.getItem('__e2e_fs') || '{}').asistencias || []);
  expect(asis.some((a: any) => a.data.Nombre_Trabajador === 'Juan Pérez Gómez')).toBe(true);

  await mobile.close();
});

test('LOGIN GOOGLE: el botón "Ingresar con Google" autentica cualquier cuenta Gmail real', async ({ page }) => {
  await boot(page, 'ajustes');

  // Reinstalación simulada: caché de la app vacía, solo la "BD" conserva datos.
  await page.evaluate(() => {
    ['cpc_personal_cache', 'cpc_attendance_cache', 'cpc_config', 'cpc_offline_queue'].forEach((k) => localStorage.removeItem(k));
  });
  expect(await page.evaluate(() => window.AppState.get('connected'))).toBe(false);

  // Botón de Google (OAuth popup simulado): entra con una Gmail cualquiera
  await page.locator('#btn-login-google').click();
  await expect(page.locator('#connection-status-detail')).toContainText('Sesión activa', { timeout: 15000 });
  expect(await page.evaluate(() => (window.FirebaseClient.getCurrentUser() || {}).email)).toBe('juan.gmail.real@gmail.com');
  expect(await page.evaluate(() => window.AppState.get('connected'))).toBe(true);

  // El usuario Google puede leer la BD (isAuthorizedOperator en firestore.rules)
  await page.evaluate(() => { window.location.hash = '#personal'; });
  await expect(page.locator('#personal-tbody')).toContainText('Juan Pérez Gómez', { timeout: 15000 });
});