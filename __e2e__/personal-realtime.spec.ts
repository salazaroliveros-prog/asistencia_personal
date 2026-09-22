import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';

const SEED = [
  { ID_Trabajador: 'RT-001', Nombre_Completo: 'Juan Pérez Gómez', Puesto: 'Albañil', DPI_CUI: '30158847100101', Estado: 'Activo' },
  { ID_Trabajador: 'RT-002', Nombre_Completo: 'Ana Lucía Torres', Puesto: 'Electricista', DPI_CUI: '30158847100102', Estado: 'Activo' },
  { ID_Trabajador: 'RT-003', Nombre_Completo: 'Carlos Méndez López', Puesto: 'Maestro de Obra', DPI_CUI: '30158847100103', Estado: 'Activo' },
  { ID_Trabajador: 'RT-004', Nombre_Completo: 'Miguel Ángel Ruiz', Puesto: 'Bodeguero', DPI_CUI: '30158847100104', Estado: 'Activo' },
];

function seedInitScript(arg) {
  if (sessionStorage.getItem('cpc_e2e_seeded') === '1') return;
  sessionStorage.setItem('cpc_e2e_seeded', '1');
  localStorage.setItem('cpc_personal_cache', JSON.stringify(arg.__E2E_SEED__));
}

test('A) escritorio en Personal: un trabajador registrado desde otro dispositivo aparece sin recargar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(seedInitScript, { __E2E_SEED__: SEED });
  await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(4, { timeout: 15000 });

  // El realtime de js/app.js hace exactamente esto al recibir el snapshot:
  // actualiza AppState('personal') → el módulo personal re-renderiza al instante.
  await page.evaluate(() => {
    const docs = JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]');
    docs.push({
      ID_Trabajador: 'RT-005',
      Nombre_Completo: 'Nuevo Operario Remoto',
      Puesto: 'Soldador',
      DPI_CUI: '30158847100199',
      Estado: 'Activo',
    });
    localStorage.setItem('cpc_personal_cache', JSON.stringify(docs));
    window.AppState.set('personal', docs);
  });

  await expect(page.locator('#personal-tbody')).toContainText('Nuevo Operario Remoto', { timeout: 8000 });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(5);
});

test('A2) la tabla reacciona a cambios en AppState personal (filtro por defecto Activo)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(seedInitScript, { __E2E_SEED__: SEED });
  await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(4, { timeout: 15000 });

  await page.evaluate(() => {
    const docs = JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]');
    docs.push({ ID_Trabajador: 'RT-006', Nombre_Completo: 'Segundo Operario Remoto', Puesto: 'Albañil', DPI_CUI: '30158847100198', Estado: 'Activo' });
    window.AppState.set('personal', docs);
  });

  await expect(page.locator('#personal-tbody')).toContainText('Segundo Operario Remoto', { timeout: 8000 });
  await expect(page.locator('#personal-tbody tr')).toHaveCount(5);
});