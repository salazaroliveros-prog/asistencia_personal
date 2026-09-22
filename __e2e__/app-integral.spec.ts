/**
 * CONTROL PERSONAL CAMPO — Validación integral de la app principal
 *
 * Simula un día completo de operación sin backend real (Firebase mockeado +
 * persistencia en localStorage):
 *   1. Se siembran trabajadores de DISTINTOS PUESTOS en la caché.
 *   2. Se registra un trabajador NUEVO desde el formulario de Personal.
 *   3. Se registran asistencias (Entrada, Salida_Receso) por marcación manual,
 *      verificando la tabla y la caché.
 *   4. Se valida la INASISTENCIA: un trabajador sin marcaciones no aparece
 *      en la tabla del día.
 *   5. Reportes: vista previa diaria, exportación CSV y PDF (descargas).
 *
 * Ejecutar: npx playwright test --config=playwright.qr-camera.config.ts
 *           --project=desktop-pc -g "App integral"
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const BASE_URL = 'http://127.0.0.1:3801';

const TRABAJADORES = [
  { ID_Trabajador: 'TRAB-INT-001', Nombre_Completo: 'Juan Pérez Gómez', Puesto: 'Albañil', DPI_CUI: '30158847100101' },
  { ID_Trabajador: 'TRAB-INT-002', Nombre_Completo: 'Ana Lucía Torres', Puesto: 'Electricista', DPI_CUI: '30158847100102' },
  { ID_Trabajador: 'TRAB-INT-003', Nombre_Completo: 'Carlos Méndez López', Puesto: 'Maestro de Obra', DPI_CUI: '30158847100103' },
  // INASISTENTE: no tendrá marcaciones hoy
  { ID_Trabajador: 'TRAB-INT-004', Nombre_Completo: 'Miguel Ángel Ruiz', Puesto: 'Bodeguero', DPI_CUI: '30158847100104' },
];

function hoyStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/**
 * Mock del SDK compat de Firebase + GPS determinista. Igual que en
 * qr-camera-fix.spec.ts: bloquea el SDK real vía property no-configurable.
 */
function mockFirebaseInitScript() {
  function makeQuery() {
    return {
      where() { return makeQuery(); },
      limit() { return makeQuery(); },
      onSnapshot(cb) { setTimeout(() => cb({ docs: [] }), 0); return () => {}; },
      get: async () => ({ empty: true, docs: [] }),
    };
  }
  const db = {
    collection() {
      return {
        where() { return makeQuery(); },
        doc() { return { get: async () => ({ exists: false }) }; },
      };
    },
    runTransaction: async (fn) => {
      const tx = { get: async () => ({ exists: false }), set() {} };
      await fn(tx);
    },
  };
  const auth = {
    currentUser: null,
    onAuthStateChanged() {},
    signInWithEmailAndPassword: async () => ({ user: { email: 'sistemadecontrol090@gmail.com' } }),
    signOut: async () => {},
  };
  window.__FIREBASE_ENV__ = null;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok) => ok({ coords: { latitude: 14.63492, longitude: -90.50693, accuracy: 10 } }),
      watchPosition: () => 0,
      clearWatch: () => {},
    },
  });
  window.__e2eMockDb = db;
  window.__firebaseMock = {
    apps: [],
    initializeApp() { return {}; },
    firestore() { return db; },
    auth() { return auth; },
  };
  Object.defineProperty(window, 'firebase', {
    configurable: false,
    get: () => window.__firebaseMock,
    set: () => {},
  });
}

function seedWorkersInitScript() {
  // Estado: 'Activo' es requerido: el filtro de personal viene preseleccionado
  // en 'Activo' y sin el campo los trabajadores quedan fuera de la tabla.
  localStorage.setItem('cpc_personal_cache', JSON.stringify([
    { ID_Trabajador: 'TRAB-INT-001', Nombre_Completo: 'Juan Pérez Gómez', Puesto: 'Albañil', DPI_CUI: '30158847100101', Estado: 'Activo' },
    { ID_Trabajador: 'TRAB-INT-002', Nombre_Completo: 'Ana Lucía Torres', Puesto: 'Electricista', DPI_CUI: '30158847100102', Estado: 'Activo' },
    { ID_Trabajador: 'TRAB-INT-003', Nombre_Completo: 'Carlos Méndez López', Puesto: 'Maestro de Obra', DPI_CUI: '30158847100103', Estado: 'Activo' },
    { ID_Trabajador: 'TRAB-INT-004', Nombre_Completo: 'Miguel Ángel Ruiz', Puesto: 'Bodeguero', DPI_CUI: '30158847100104', Estado: 'Activo' },
  ]));
}

test.describe('App integral — trabajadores, asistencias, inasistencias y reportes', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockFirebaseInitScript);
    await page.addInitScript(seedWorkersInitScript);
    // Navegar directo a Personal: la app abre en Dashboard y las demás
    // secciones quedan ocultas (hidden) hasta navegar vía hash.
    await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#personal-tbody')).toBeVisible({ timeout: 15000 });
  });

  test('registra trabajador nuevo de otro puesto desde el formulario de Personal', async ({ page }) => {
    await page.goto(`${BASE_URL}/index.html#personal`);
    await expect(page.locator('#personal-tbody tr')).toHaveCount(4);

    // Abrir modal de nuevo trabajador
    await page.locator('#btn-nuevo-personal').click();
    await expect(page.locator('#modal-personal')).toBeVisible();

    // Llenar formulario (Soldador = un puesto que aún no existe en la obra)
    await page.fill('#p-nombre', 'Pedro Ramírez Solís');
    await page.fill('#p-dpi', '30158847100105');
    await page.selectOption('#p-puesto', 'Soldador');
    await page.fill('#p-jefe', 'Ing. Salazar');
    await page.locator('#btn-guardar-personal').click();

    // Modal cierra y el trabajador aparece en la tabla
    await expect(page.locator('#modal-personal')).toBeHidden({ timeout: 10000 });
    await expect(page.locator('#personal-tbody')).toContainText('Pedro Ramírez Solís');
    await expect(page.locator('#personal-tbody')).toContainText('Soldador');

    // Persistido en caché local
    const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]'));
    expect(cache).toHaveLength(5);
    const nuevo = cache.find((p) => p.Nombre_Completo === 'Pedro Ramírez Solís');
    expect(nuevo).toBeTruthy();
    expect(nuevo.Puesto).toBe('Soldador');
    expect(nuevo.Estado).toBe('Activo');
    // QR data generado para el carné
    expect(nuevo.Codigo_QR_Data).toContain(nuevo.ID_Trabajador);
  });

  test('registra asistencias por marcación manual y valida la inasistencia del día', async ({ page }) => {
    const hoy = hoyStr();
    await page.goto(`${BASE_URL}/index.html#asistencia`);

    // Tab manual
    const tabManual = page.locator('#tab-btn-manual');
    if (await tabManual.count()) {
      await tabManual.click();
    }

    // Helper: seleccionar trabajador en el autocomplete
    const seleccionar = async (busqueda, nombre) => {
      await page.fill('#manual-worker-search', busqueda);
      const item = page.locator('#autocomplete-list .autocomplete-item').first();
      await expect(item).toBeVisible();
      await item.click();
      await expect(page.locator('#manual-worker-name')).toHaveText(nombre);
    };

    // ── Trabajador 1: ENTRADA ────────────────────────────────────────────
    await seleccionar('Juan Pérez', 'Juan Pérez Gómez');
    await page.locator('#manual-worker-selected .btn-marcacion[data-tipo="Entrada"]').click();
    await expect(page.locator('#asistencia-tbody')).toContainText('Juan Pérez Gómez', { timeout: 10000 });
    await expect(page.locator('#asistencia-tbody')).toContainText('Entrada');

    // ── Trabajador 2: ENTRADA + SALIDA RECESO ────────────────────────────
    // OJO: tras cada marcación el panel manual se oculta
    // (_limpiarEstadoPendiente), así que hay que volver a seleccionar al
    // trabajador para registrar una segunda marca.
    await seleccionar('Ana Lucía', 'Ana Lucía Torres');
    await page.locator('#manual-worker-selected .btn-marcacion[data-tipo="Entrada"]').click();
    await expect(page.locator('#asistencia-tbody')).toContainText('Ana Lucía Torres', { timeout: 10000 });

    await seleccionar('Ana Lucía', 'Ana Lucía Torres');
    await page.locator('#manual-worker-selected .btn-marcacion[data-tipo="Salida_Receso"]').click();
    // La tabla renderiza la etiqueta abreviada "Sal. Receso"
    await expect(page.locator('#asistencia-tbody')).toContainText('Sal. Receso', { timeout: 10000 });

    // ── Verificar caché de asistencias ───────────────────────────────────
    const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('cpc_attendance_cache') || '[]'));
    const hoyCache = cache.filter((a) => a.Fecha === hoy);
    expect(hoyCache.length).toBeGreaterThanOrEqual(3);
    const juan = hoyCache.find((a) => a.Nombre_Trabajador === 'Juan Pérez Gómez');
    expect(juan.Tipo_Marcacion).toBe('Entrada');

    // ── INASISTENCIA: Miguel Ángel Ruiz no tiene marcaciones hoy ─────────
    expect(hoyCache.find((a) => a.Nombre_Trabajador === 'Miguel Ángel Ruiz')).toBeUndefined();
    await expect(page.locator('#asistencia-tbody')).not.toContainText('Miguel Ángel Ruiz');

    // El filtro de fecha del día muestra solo las 3 marcaciones registradas
    const filas = await page.locator('#asistencia-tbody tr').count();
    expect(filas).toBe(3);
  });

  test('genera informe diario con vista previa y exporta CSV y PDF', async ({ page }) => {
    const hoy = hoyStr();

    // Sembrar asistencias ANTES de cargar la página: el hash #reportes no
    // recarga el documento, así que setear el caché con evaluate no llegaría
    // a AppState (solo se hidrata al cargar config.js).
    await page.addInitScript((cache) => {
      localStorage.setItem('cpc_attendance_cache', cache);
    }, JSON.stringify([
      { ID_Marcacion: 'M1', ID_Trabajador: 'TRAB-INT-001', Nombre_Trabajador: 'Juan Pérez Gómez', Tipo_Marcacion: 'Entrada', Fecha: hoy, Hora_Real: '07:05', Estado_Marcacion: 'A Tiempo', Metodo_Registro: 'Manual_Fisica' },
      { ID_Marcacion: 'M2', ID_Trabajador: 'TRAB-INT-002', Nombre_Trabajador: 'Ana Lucía Torres', Tipo_Marcacion: 'Entrada', Fecha: hoy, Hora_Real: '07:20', Estado_Marcacion: 'Tardanza', Metodo_Registro: 'Escaneo_QR' },
      { ID_Marcacion: 'M3', ID_Trabajador: 'TRAB-INT-002', Nombre_Trabajador: 'Ana Lucía Torres', Tipo_Marcacion: 'Salida_Receso', Fecha: hoy, Hora_Real: '10:02', Estado_Marcacion: 'A Tiempo', Metodo_Registro: 'Escaneo_QR' },
    ]));

    await page.goto(`${BASE_URL}/index.html?e2e=1#reportes`);

    // Fecha del reporte diario = hoy
    await expect(page.locator('#reporte-fecha-diario')).toHaveValue(hoy);

    // ── Vista previa ─────────────────────────────────────────────────────
    await page.locator('#btn-preview-diario').click();
    await expect(page.locator('#reporte-preview-card')).toBeVisible({ timeout: 15000 });
    const preview = page.locator('#reporte-preview-card');
    await expect(preview).toContainText('Juan Pérez Gómez');
    await expect(preview).toContainText('Ana Lucía Torres');

    // ── Export CSV ───────────────────────────────────────────────────────
    const csvPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.locator('#btn-csv-diario').click();
    const csv = await csvPromise;
    expect(csv.suggestedFilename()).toMatch(/\.csv$/i);
    // API vigente de Playwright: el archivo descargado se lee desde su ruta
    // temporal (download.createStream() fue removido de las versiones nuevas).
    const csvPath = await csv.path();
    expect(csvPath).toBeTruthy();
    const csvContent = readFileSync(csvPath, 'utf8');
    expect(csvContent).toContain('Juan Pérez Gómez');
    expect(csvContent).toContain('Entrada');
    expect(csvContent).toContain('Salida_Receso');
    // El método de registro viaja en el informe: confirma que las marcaciones
    // hechas por QR llegan intactas a la exportación.
    expect(csvContent).toContain('Escaneo_QR');
    // Comportamiento real de exportarCSV en un reporte de UN solo día: incluye a
    // todo el personal Activo y marca como 'Ausencia' a quien no tiene Entrada
    // (verificación de inasistencias dentro del propio informe).
    expect(csvContent).toContain('Miguel Ángel Ruiz');
    expect(csvContent).toContain('"Ausencia"');

    // ── Export PDF ───────────────────────────────────────────────────────
    const pdfPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('#btn-pdf-diario').click();
    const pdf = await pdfPromise;
    expect(pdf.suggestedFilename()).toMatch(/\.pdf$/i);
    const pdfPath = await pdf.path();
    expect(pdfPath).toBeTruthy();
    const pdfBytes = readFileSync(pdfPath);
    // Firma %PDF- y tamaño razonable: confirma que jsPDF generó un documento real
    expect(pdfBytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });

  test('el reporte diario refleja la asistencia real: 3 asistentes y 1 inasistente fuera', async ({ page }) => {
    const hoy = hoyStr();

    // Sembrar asistencias ANTES de cargar (mismo motivo que el test anterior)
    await page.addInitScript((cache) => {
      localStorage.setItem('cpc_attendance_cache', cache);
    }, JSON.stringify([
      { ID_Marcacion: 'I1', ID_Trabajador: 'TRAB-INT-001', Nombre_Trabajador: 'Juan Pérez Gómez', Tipo_Marcacion: 'Entrada', Fecha: hoy, Hora_Real: '07:00', Estado_Marcacion: 'A Tiempo' },
      { ID_Marcacion: 'I2', ID_Trabajador: 'TRAB-INT-002', Nombre_Trabajador: 'Ana Lucía Torres', Tipo_Marcacion: 'Entrada', Fecha: hoy, Hora_Real: '07:02', Estado_Marcacion: 'A Tiempo' },
      { ID_Marcacion: 'I3', ID_Trabajador: 'TRAB-INT-003', Nombre_Trabajador: 'Carlos Méndez López', Tipo_Marcacion: 'Entrada', Fecha: hoy, Hora_Real: '07:01', Estado_Marcacion: 'A Tiempo' },
      { ID_Marcacion: 'I4', ID_Trabajador: 'TRAB-INT-002', Nombre_Trabajador: 'Ana Lucía Torres', Tipo_Marcacion: 'Salida_Receso', Fecha: hoy, Hora_Real: '10:00', Estado_Marcacion: 'A Tiempo' },
    ]));

    await page.goto(`${BASE_URL}/index.html?e2e=1#reportes`);
    await page.locator('#btn-preview-diario').click();
    await expect(page.locator('#reporte-preview-card')).toBeVisible({ timeout: 15000 });

    // Los 3 asistentes aparecen; el inasistente no aparece como marcación
    const preview = page.locator('#reporte-preview-card');
    await expect(preview).toContainText('Carlos Méndez López');
    await expect(preview).not.toContainText('Miguel Ángel Ruiz');

    // Resumen del informe: 4 de personal, 3 presentes, 1 ausente, 4 marcaciones
    const resumen = async (etiqueta) => (await page
      .locator('#reporte-preview-card .print-summary-item', { hasText: etiqueta })
      .locator('.print-summary-value')
      .textContent()).trim();
    expect(await resumen('Total Personal')).toBe('4');
    expect(await resumen('Presentes')).toBe('3');
    expect(await resumen('Ausentes')).toBe('1');
    expect(await resumen('Marcaciones')).toBe('4');
  });
});
