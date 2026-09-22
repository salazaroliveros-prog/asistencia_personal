/**
 * VALIDACIÓN VISUAL INTERACTIVA — Recorre cada pantalla y opera sus
 * elementos reales (botones, tabs, selects, formularios, modales) validando
 * que responden correctamente. Genera capturas por pantalla en __e2e__/capturas/.
 */
import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = 'http://127.0.0.1:3801';
const NAV_TIMEOUT = 20000;

const CAP_DIR = join(__dirname, 'capturas');
mkdirSync(CAP_DIR, { recursive: true });

const SEED = [
  { ID_Trabajador: 'TRAB-SEED01', Nombre_Completo: 'Carlos López Ruiz', DPI_CUI: '1012345678901', Puesto: 'Albañil', Jefe_Inmediato: 'Ing. Salazar', Telefono: '5555 1010', WhatsApp: 'https://wa.me/50255551010', Direccion: 'Guatemala', Fotografia_URL: '', Codigo_QR_Data: JSON.stringify({ id: 'TRAB-SEED01', dpi: '1012345678901', nombre: 'Carlos López Ruiz' }), Fecha_Registro: '2026-09-20T08:00:00', Estado: 'Activo' },
  { ID_Trabajador: 'TRAB-SEED02', Nombre_Completo: 'María García Pérez', DPI_CUI: '2012345678902', Puesto: 'Maestro de Obra', Jefe_Inmediato: 'Ing. Salazar', Telefono: '5555 2020', WhatsApp: 'https://wa.me/50255552020', Direccion: 'Guatemala', Fotografia_URL: '', Codigo_QR_Data: JSON.stringify({ id: 'TRAB-SEED02', dpi: '2012345678902', nombre: 'María García Pérez' }), Fecha_Registro: '2026-09-20T08:05:00', Estado: 'Activo' },
  { ID_Trabajador: 'TRAB-SEED03', Nombre_Completo: 'Pedro Ramírez Sosa', DPI_CUI: '3012345678903', Puesto: 'Soldador', Jefe_Inmediato: 'Ing. Salazar', Telefono: '5555 3030', WhatsApp: 'https://wa.me/50255553030', Direccion: 'Villa Nueva', Fotografia_URL: '', Codigo_QR_Data: JSON.stringify({ id: 'TRAB-SEED03', dpi: '3012345678903', nombre: 'Pedro Ramírez Sosa' }), Fecha_Registro: '2026-09-20T08:10:00', Estado: 'Activo' },
];

async function boot(page: Page, hash: string) {
  await page.goto(`${BASE_URL}/#${hash}`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForSelector(`#page-${hash}`, { timeout: 10000 }).catch(() => {});
}

const seedScript = (cacheKey: string, data: unknown[]) => {
  const json = JSON.stringify(data);
  return `
    (() => {
      try { localStorage.setItem('${cacheKey}', ${JSON.stringify(json)}); } catch (e) {}
    })();
  `;
};

test.describe('Validación visual de cada pantalla (móvil 390x844)', () => {
  test('DASHBOARD: KPIs, calendario, refresco y filtros de turno', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(seedScript('cpc_personal_cache', SEED));
    await boot(page, 'dashboard');

    // KPI cards presentes y con valor poblado
    const kpis = page.locator('.kpi-card');
    await expect(kpis).toHaveCount(4);
    await expect(page.locator('#kpi-total')).not.toHaveText('--', { timeout: 10000 });
    await expect(page.locator('#kpi-total')).toHaveText(/^\d+$/);

    // Botón Actualizar dashboard responde sin romper
    await page.locator('#btn-refresh-dashboard').click();

    // Calendario: mes anterior y volver
    const mes1 = await page.locator('#cal-month-year').textContent();
    await page.locator('#cal-prev').click();
    const mes2 = await page.locator('#cal-month-year').textContent();
    expect(mes2).not.toBe(mes1);
    await page.locator('#cal-next').click();
    await expect(page.locator('#cal-month-year')).toHaveText(mes1!);
    await expect(page.locator('#calendar-grid .cal-day:not(.empty)').first()).toBeVisible();

    // Tabs de estado de turno
    await page.locator('.turno-tab[data-turno="receso"]').click();
    await expect(page.locator('.turno-tab[data-turno="receso"]')).toHaveAttribute('aria-selected', 'true');

    // Selector de fecha del dashboard
    await page.fill('#dashboard-date', '2026-09-22');
    await expect(page.locator('#dashboard-date')).toHaveValue('2026-09-22');

    await page.screenshot({ path: join(CAP_DIR, '1-dashboard.png') });
  });

  test('PERSONAL: alta por formulario, búsqueda, filtros y modal de carné', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(seedScript('cpc_personal_cache', SEED));
    await boot(page, 'personal');

    // Tabla con 3 trabajadores sembrados
    await expect(page.locator('#personal-tbody tr')).toHaveCount(3, { timeout: 15000 });
    await expect(page.locator('#personal-table th')).toHaveCount(8);

    // Apertura del modal de nuevo trabajador
    await page.locator('#btn-nuevo-personal').click();
    await expect(page.locator('#modal-personal')).toBeVisible();
    await page.locator('.modal-close[data-modal="modal-personal"]').click();
    await expect(page.locator('#modal-personal')).toBeHidden();

    // Validación del formulario (submit vacío)
    await page.locator('#btn-nuevo-personal').click();
    await page.locator('#btn-guardar-personal').click({ force: true });
    await expect(page.locator('#p-nombre-error')).toBeVisible();
    await page.locator('.modal-close[data-modal="modal-personal"]').click();

    // Alta real de un trabajador
    await page.locator('#btn-nuevo-personal').click();
    await page.fill('#p-nombre', 'Ana Sofía Méndez');
    await page.fill('#p-dpi', '4012345678904');
    await page.selectOption('#p-puesto', 'Electricista');
    await page.fill('#p-jefe', 'Ing. Salazar');
    await page.fill('#p-telefono', '5555 4040');
    await page.locator('#btn-guardar-personal').click({ force: true });
    await expect(page.locator('#modal-personal')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('#personal-tbody')).toContainText('Ana Sofía Méndez', { timeout: 10000 });
    await expect(page.locator('#personal-tbody tr')).toHaveCount(4);

    // Búsqueda filtra la tabla
    await page.fill('#personal-search', 'María');
    await expect(page.locator('#personal-tbody tr')).toHaveCount(1);
    await expect(page.locator('#personal-tbody')).toContainText('María García Pérez');
    await page.fill('#personal-search', '');

    // Filtro por puesto
    await page.selectOption('#filter-puesto', 'Soldador');
    await expect(page.locator('#personal-tbody tr')).toHaveCount(1);
    await page.selectOption('#filter-puesto', '');

    // Carné QR de una fila
    await page.locator('#personal-tbody tr').first().locator('.table-action-btn.qr').click();
    await expect(page.locator('#modal-carne')).toBeVisible();
    await expect(page.locator('#carne-nombre')).not.toBeEmpty();
    await page.locator('.modal-close[data-modal="modal-carne"]').click();
    await expect(page.locator('#modal-carne')).toBeHidden();

    await page.screenshot({ path: join(CAP_DIR, '2-personal.png') });
  });

  test('ASISTENCIA: tabs QR/manual, autocompletado y marcación real', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(seedScript('cpc_personal_cache', SEED));
    await boot(page, 'asistencia');

    // Tabs: cambiar a manual y volver
    await page.locator('#tab-btn-manual').click();
    await expect(page.locator('#tab-manual')).toBeVisible();
    await expect(page.locator('#tab-manual')).not.toBeHidden();
    await page.locator('#tab-btn-qr').click();
    await expect(page.locator('#tab-qr-scanner')).toBeVisible();

    // Marcación manual con autocompletado
    await page.locator('#tab-btn-manual').click();
    await page.fill('#manual-worker-search', 'Carlos');
    await expect(page.locator('#autocomplete-list')).toBeVisible();
    await page.locator('#autocomplete-list li').first().click();
    await expect(page.locator('#manual-worker-selected')).toBeVisible();
    await expect(page.locator('#manual-worker-name')).toContainText('Carlos López Ruiz');

    // Registrar entrada
    await page.locator('#manual-worker-selected .btn-marcacion.btn-entrada').first().click();
    await expect(page.locator('#asistencia-tbody tr')).not.toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('#asistencia-tbody')).toContainText('Carlos López Ruiz', { timeout: 10000 });

    // Filtro de fecha
    const hoy = await page.evaluate(() => new Date().toISOString().slice(0, 10));
    await page.fill('#asistencia-filter-date', hoy);
    await expect(page.locator('#asistencia-filter-date')).toHaveValue(hoy);

    await page.screenshot({ path: join(CAP_DIR, '3-asistencia.png') });
  });

  test('CAMPO: pantalla de escaneo con estado offline y feed', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(seedScript('cpc_personal_cache', SEED));
    await boot(page, 'campo');

    await expect(page.locator('#page-campo')).toBeVisible();
    await expect(page.locator('#campo-status')).toContainText(/oﬄine|Offline|Local/i);
    await expect(page.locator('#campo-btn-scan')).toBeVisible();
    await expect(page.locator('#campo-qr-reader')).toBeVisible();
    await expect(page.locator('#campo-feed-list')).toBeVisible();

    await page.screenshot({ path: join(CAP_DIR, '4-campo.png') });
  });

  test('REPORTES: vista previa, orientación y exportación CSV', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(seedScript('cpc_personal_cache', SEED));
    await boot(page, 'reportes');

    // Vista previa del reporte diario
    await page.fill('#reporte-fecha-diario', '2026-09-22');
    await page.locator('#btn-preview-diario').click();
    await expect(page.locator('#reporte-preview-card')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#preview-title')).toContainText('Vista Previa');

    // Cambio de orientación de impresión
    await page.selectOption('#preview-orientation', 'landscape');
    await expect(page.locator('#preview-orientation')).toHaveValue('landscape');

    // Exportar CSV descarga un archivo
    const download = page.waitForEvent('download');
    await page.locator('#btn-csv-diario').click();
    const d = await download;
    expect(d.suggestedFilename()).toMatch(/\.csv$/);

    await page.screenshot({ path: join(CAP_DIR, '5-reportes.png') });
  });

  test('AJUSTES: config general, horarios, GPS, escáner audit y QR instalación', async ({ page }) => {
    test.setTimeout(150000);
    await boot(page, 'ajustes');

    await expect(page.locator('#page-ajustes')).toBeVisible();

    // Configuración general → toast de éxito
    await page.fill('#cfg-nombre-obra', 'Construcciones Ramsa');
    await page.locator('#btn-save-general').click();
    await expect(page.locator('#toast-container')).toBeVisible({ timeout: 10000 });
    await expect(page.evaluate(() => localStorage.getItem('cpc_config'))).resolves.toContain('Ramsa');

    // Horarios
    await page.fill('#cfg-hora-entrada', '06:30');
    await page.locator('#btn-save-horarios').click();

    // Toggles GPS
    await page.locator('#cfg-gps-requerir').check();
    await expect(page.locator('#cfg-gps-requerir')).toBeChecked();
    await page.locator('#btn-save-gps').click();

    // Auditoría del escáner
    await page.locator('#btn-load-scanner-audit').click();
    await expect(page.locator('#scanner-audit-output')).toBeVisible();
    await page.locator('#btn-export-scanner-audit').click();
    await page.locator('#btn-clear-scanner-audit').click();

    // QR de instalación del escáner
    await page.locator('#btn-qr-scanner-instalacion').click();
    await expect(page.locator('#scanner-install-qr')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: join(CAP_DIR, '6-ajustes.png') });
  });
});