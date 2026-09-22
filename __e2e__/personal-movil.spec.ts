import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';

function seedInitScript() {
  if (sessionStorage.getItem('cpc_e2e_seeded') === '1') return;
  sessionStorage.setItem('cpc_e2e_seeded', '1');
  localStorage.setItem('cpc_personal_cache', JSON.stringify([
    { ID_Trabajador: 'MOV-001', Nombre_Completo: 'Juan Pérez Gómez', Puesto: 'Albañil', DPI_CUI: '30158847100101', Estado: 'Activo' },
    { ID_Trabajador: 'MOV-002', Nombre_Completo: 'Ana Lucía Torres', Puesto: 'Electricista', DPI_CUI: '30158847100102', Estado: 'Activo' },
    { ID_Trabajador: 'MOV-003', Nombre_Completo: 'Carlos Méndez López', Puesto: 'Maestro de Obra', DPI_CUI: '30158847100103', Estado: 'Activo' },
    { ID_Trabajador: 'MOV-004', Nombre_Completo: 'Miguel Ángel Ruiz', Puesto: 'Bodeguero', DPI_CUI: '30158847100104', Estado: 'Activo' },
  ]));
}

function seedLongInitScript() {
  localStorage.setItem('cpc_personal_cache', JSON.stringify([
    { ID_Trabajador: 'LONG-001', Nombre_Completo: 'Nombre Completamente Extendido Para Probar El Truncamiento De La Columna Nombre 123456789', Puesto: 'Albañil', DPI_CUI: '30158847100101', Estado: 'Activo' },
    { ID_Trabajador: 'LONG-002', Nombre_Completo: 'Ana Lucía Torres', Puesto: 'Electricista', DPI_CUI: '30158847100102', Estado: 'Activo' },
  ]));
}

test('A) guardar trabajador desde la versión móvil → la versión escritorio NO lo muestra hasta recargar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(seedInitScript);
  await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(4, { timeout: 15000 });

  const context = page.context();
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.addInitScript(seedInitScript);
  await mobile.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
  await expect(mobile.locator('#personal-tbody tr')).toHaveCount(4, { timeout: 15000 });

  await mobile.locator('#btn-nuevo-personal').click();
  await expect(mobile.locator('#modal-personal')).toBeVisible();
  await mobile.fill('#p-nombre', 'Nuevo Operario Móvil');
  await mobile.fill('#p-dpi', '30158847100199');
  await mobile.selectOption('#p-puesto', 'Soldador');
  await mobile.fill('#p-jefe', 'Ing. Salazar');
  await mobile.locator('#btn-guardar-personal').click();
  await expect(mobile.locator('#modal-personal')).toBeHidden({ timeout: 10000 });
  await expect(mobile.locator('#personal-tbody')).toContainText('Nuevo Operario Móvil');
  await expect(mobile.locator('#personal-tbody tr')).toHaveCount(5);

  const cache5 = await page.evaluate(() => JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]').length);
  expect(cache5).toBe(5);

  await expect(page.locator('#personal-tbody tr')).toHaveCount(4);
  await expect(page.locator('#personal-tbody')).not.toContainText('Nuevo Operario Móvil');

  await page.reload();
  await expect(page.locator('#personal-tbody')).toContainText('Nuevo Operario Móvil', { timeout: 15000 });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(5);
});

test('B) versión móvil: 8 columnas visibles y recorribles con scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(seedLongInitScript);
  await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await expect(page.locator('#personal-tbody tr')).toHaveCount(2, { timeout: 15000 });
  await expect.poll(() => page.locator('#personal-table').evaluate((el) => el.closest('.table-responsive').clientWidth)).toBeGreaterThan(0);

  const scroll = await page.locator('#personal-table').evaluate((el) => {
    const wrap = el.closest('.table-responsive');
    return {
      scrollWidth: wrap.scrollWidth,
      clientWidth: wrap.clientWidth,
      overflowX: getComputedStyle(wrap).overflowX,
    };
  });
  expect(scroll.overflowX).toBe('auto');
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);

  const visible = await page.evaluate(() => {
    const isHidden = (el) => { const s = getComputedStyle(el); return s.display === 'none'; };
    const tds = document.querySelectorAll('#personal-table tbody tr:first-child td');
    const ths = document.querySelectorAll('#personal-table thead th');
    return {
      hiddenCells: [1, 3, 5].map((i) => isHidden(tds[i])),
      hiddenHeads: [1, 3, 5].map((i) => isHidden(ths[i])),
    };
  });
  expect(visible.hiddenCells).toEqual([false, false, false]);
  expect(visible.hiddenHeads).toEqual([false, false, false]);

  const cell = page.locator('#personal-table tbody tr:first-child td:nth-child(3)');
  await expect.poll(() => cell.evaluate((el) => el.clientWidth)).toBeGreaterThan(0);
});