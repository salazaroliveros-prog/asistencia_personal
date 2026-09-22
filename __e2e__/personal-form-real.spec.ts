import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';

const SEED = [
  { ID_Trabajador: 'RT-001', Nombre_Completo: 'Juan Pérez Gómez', Puesto: 'Albañil', DPI_CUI: '30158847100101', Estado: 'Activo' },
  { ID_Trabajador: 'RT-002', Nombre_Completo: 'Ana Lucía Torres', Puesto: 'Electricista', DPI_CUI: '30158847100102', Estado: 'Activo' },
  { ID_Trabajador: 'RT-003', Nombre_Completo: 'Carlos Méndez López', Puesto: 'Maestro de Obra', DPI_CUI: '30158847100103', Estado: 'Activo' },
  { ID_Trabajador: 'RT-004', Nombre_Completo: 'Miguel Ángel Ruiz', Puesto: 'Bodeguero', DPI_CUI: '30158847100104', Estado: 'Activo' },
];

/**
 * Mock de Firebase funcional ("servidor" en localStorage) con getter de
 * window.firebase que devuelve un objeto NUEVO en cada acceso: así los
 * bundles compat vendered de vendor/firebase escriben sus registros en
 * objetos desechables y el mock real nunca es contaminado. AppState queda
 * 'connected' (online) o 'local' (offline) según mode.
 */
function realMockInitScript(arg: { mode: 'online' | 'offline'; __SEED__: unknown[] }) {
  const FS_KEY = '__e2e_fs';
  const SEED_FLAG = '__e2e_fs_seeded';
  const ONLINE = arg.mode === 'online';
  const authUser = { uid: 'anon-e2e', email: 'test@cpc.local', refreshToken: 'x' };

  function readFs(): any { try { return JSON.parse(localStorage.getItem(FS_KEY) || '{}'); } catch { return {}; } }
  function writeFs(s: any) { localStorage.setItem(FS_KEY, JSON.stringify(s)); }
  function seedServer() {
    if (sessionStorage.getItem(SEED_FLAG) === '1') return;
    sessionStorage.setItem(SEED_FLAG, '1');
    const seed = arg.__SEED__ as Array<Record<string, unknown>>;
    if (localStorage.getItem(FS_KEY) == null) {
      writeFs({
        personal: seed.map((w) => ({ id: w.ID_Trabajador, data: { ...w } })),
        configuracion: [{ id: 'general', data: { Nombre_App: 'CPC', Nombre_Obra: 'Obra Principal' } }],
      });
    }
    if (!ONLINE) {
      localStorage.setItem('cpc_personal_cache', JSON.stringify(seed));
    }
  }
  seedServer();

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
    currentUser: ONLINE ? authUser : null,
    onAuthStateChanged: (cb: any) => { setTimeout(() => cb(ONLINE ? authUser : null), 0); return () => {}; },
    signInAnonymously: async () => ({ user: authUser }),
    signInWithEmailAndPassword: async () => ({ user: authUser }),
    signOut: async () => {},
    setPersistence: async () => {},
    Auth: { Persistence: { LOCAL: 'local' } },
  };

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
  window.FIREBASE_ALLOW_ANONYMOUS = ONLINE;
  window.__FIREBASE_ENV__ = null;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: any) => ok({ coords: { latitude: 14.63492, longitude: -90.50693, accuracy: 10 } }), watchPosition: () => 0, clearWatch: () => {} },
  });

  // Emula la PUSH de Firestore: cuando OTRO tab escribe, este tab recibe el
  // evento y re-emite los snapshots activos.
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === FS_KEY) reemitSnapshots();
  });
}

async function abrirYEsperar(page: Page, modo: 'online' | 'offline') {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(realMockInitScript as any, { mode: modo, __SEED__: SEED });
  await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(4, { timeout: 20000 });
}

async function registrarDesdeFormulario(page: Page, nombre: string, dpi: string, puesto: string, whatsapp?: string) {
  await page.locator('#btn-nuevo-personal').click();
  await expect(page.locator('#modal-personal')).toBeVisible();
  await page.fill('#p-nombre', nombre);
  await page.fill('#p-dpi', dpi);
  await page.selectOption('#p-puesto', puesto);
  await page.fill('#p-jefe', 'Ing. Salazar');
  if (whatsapp) await page.fill('#p-whatsapp', whatsapp);
  await page.locator('#btn-guardar-personal').click({ force: true });
  await expect(page.locator('#modal-personal')).toBeHidden({ timeout: 15000 });
}

test('ONLINE: registrar desde el formulario genera el trabajador (ID/QR) y lo guarda en Firestore', async ({ page }) => {
  await abrirYEsperar(page, 'online');

  await registrarDesdeFormulario(page, 'Operario Real Test', '5123456789012', 'Soldador', '55550123');

  await expect(page.locator('#personal-tbody')).toContainText('Operario Real Test', { timeout: 10000 });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(5);

  const estado = await page.evaluate(() => {
    const all = window.AppState.get('personal') || [];
    const w = all.find((x: any) => x.Nombre_Completo === 'Operario Real Test');
    const server = JSON.parse(localStorage.getItem('__e2e_fs') || '{}');
    const fsDocs = (server.personal || []).map((d: any) => d.data);
    return {
      worker: w || null,
      cacheLen: JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]').length,
      fsHas: fsDocs.some((d: any) => d.Nombre_Completo === 'Operario Real Test'),
      queue: JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]'),
      subscribed: (window as any).__e2eFsCbs.personal ? ((window as any).__e2eFsCbs.personal.length > 0) : false,
    };
  });

  expect(estado.cacheLen).toBe(5);
  expect(estado.fsHas).toBe(true);
  expect(estado.queue.length).toBe(0);
  expect(estado.subscribed).toBe(true);
  expect(estado.worker).toBeTruthy();
  const w = estado.worker;
  expect(w.ID_Trabajador).toMatch(/^TRAB/);
  const qr = JSON.parse(w.Codigo_QR_Data);
  expect(qr.id).toBe(w.ID_Trabajador);
  expect(qr.dpi).toBe('5123456789012');
  expect(qr.nombre).toBe('Operario Real Test');
  expect(w.Estado).toBe('Activo');
  expect(w.Fecha_Registro).toBeTruthy();
  expect(w.WhatsApp).toMatch(/^https:\/\/wa\.me\/502/);
});

test('OFFLINE: registrar desde el formulario guarda en local, genera ID/QR y deja cola pendiente', async ({ page }) => {
  await abrirYEsperar(page, 'offline');

  await registrarDesdeFormulario(page, 'Operario Offline', '6123456789012', 'Albañil');

  await expect(page.locator('#personal-tbody')).toContainText('Operario Offline', { timeout: 10000 });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(5);

  const estado = await page.evaluate(() => {
    const all = window.AppState.get('personal') || [];
    const w = all.find((x: any) => x.Nombre_Completo === 'Operario Offline');
    const server = JSON.parse(localStorage.getItem('__e2e_fs') || '{}');
    const fsDocs = (server.personal || []).map((d: any) => d.data);
    const queue = JSON.parse(localStorage.getItem('cpc_offline_queue') || '[]');
    return {
      worker: w || null,
      cacheLen: JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]').length,
      fsHas: fsDocs.some((d: any) => d.Nombre_Completo === 'Operario Offline'),
      queue,
      connected: window.AppState.get('connected'),
      backendMode: window.AppState.get('backendMode'),
    };
  });

  expect(estado.connected).toBe(false);
  expect(estado.backendMode).toBe('local');
  expect(estado.cacheLen).toBe(5);
  expect(estado.fsHas).toBe(false);
  expect(estado.worker).toBeTruthy();
  const w = estado.worker;
  expect(w.ID_Trabajador).toMatch(/^TRAB/);
  const qr = JSON.parse(w.Codigo_QR_Data);
  expect(qr.id).toBe(w.ID_Trabajador);
  expect(qr.dpi).toBe('6123456789012');
  expect(w.Estado).toBe('Activo');
  expect(w.Fecha_Registro).toBeTruthy();
  expect(estado.queue.length).toBe(1);
  expect(estado.queue[0].type).toBe('personal-create');
  expect(estado.queue[0].payload.id).toBe(w.ID_Trabajador);
});

test('REALTIME: registrar desde el móvil (2ª pestaña) aparece en escritorio sin recargar', async ({ page }) => {
  await abrirYEsperar(page, 'online');

  const mobile = await page.context().newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.addInitScript(realMockInitScript as any, { mode: 'online', __SEED__: SEED });
  await mobile.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
  await expect(mobile.locator('#personal-tbody tr')).toHaveCount(4, { timeout: 20000 });

  await registrarDesdeFormulario(mobile, 'Trabajador Remoto RT', '7123456789012', 'Soldador');
  await expect(mobile.locator('#personal-tbody')).toContainText('Trabajador Remoto RT', { timeout: 10000 });

  await expect(page.locator('#personal-tbody')).toContainText('Trabajador Remoto RT', { timeout: 10000 });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(5);

  const cacheDesktop = await page.evaluate(() => JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]').length);
  expect(cacheDesktop).toBe(5);

  await mobile.close();
});