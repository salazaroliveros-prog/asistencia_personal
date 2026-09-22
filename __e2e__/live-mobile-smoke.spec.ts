/**
 * Smoke live en viewports móvil/tablet contra Vercel (device emulation Playwright).
 *   LIVE_URL=... npx playwright test --config=playwright.live-mobile.config.ts
 */
import { test, expect, type Page } from '@playwright/test';

const LIVE = process.env.LIVE_URL || 'https://controlasistenciaapp.vercel.app';

async function boot(page: Page) {
  await page.goto(LIVE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 25000 }).catch(() => {});
  await page.waitForSelector('#app:not([hidden])', { timeout: 25000 });
  await page.evaluate(() => {
    for (const id of ['update-banner', 'pwa-install-banner', 'demo-banner']) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
  });
}

async function openNav(page: Page) {
  const alreadyOpen = await page.evaluate(() => document.body.classList.contains('sidebar-open'));
  if (alreadyOpen) return;
  const toggle = page.locator('#menu-toggle');
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await page.waitForFunction(() => document.body.classList.contains('sidebar-open'), null, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function goPage(page: Page, pageId: string) {
  await openNav(page);
  const open = await page.evaluate(() => document.body.classList.contains('sidebar-open'));
  const link = page.locator(`.nav-link[data-page="${pageId}"]`).first();
  if (open && (await link.isVisible().catch(() => false))) {
    await link.click().catch(async () => {
      await page.evaluate((id) => { window.location.hash = id; }, pageId);
    });
  } else {
    await page.evaluate((id) => { window.location.hash = id; }, pageId);
  }
  await page.waitForTimeout(700);
  await expect(page.locator(`#page-${pageId}`).first()).toBeVisible({ timeout: 12000 });
  await page.evaluate(() => document.body.classList.remove('sidebar-open'));
}

test('módulos + carné + reportes en device emulation', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const label = testInfo.project.name.replace(/[^a-zA-Z\s]/g, ' ').trim() || 'Device';

  await boot(page);

  const toggle = page.locator('#menu-toggle');
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await expect.poll(async () => page.evaluate(() => document.body.classList.contains('sidebar-open'))).toBeTruthy();
    await page.evaluate(() => document.body.classList.remove('sidebar-open'));
  }

  await goPage(page, 'dashboard');
  await expect(page.getByText(/Personal Activo/i).first()).toBeVisible();

  await goPage(page, 'personal');
  await page.locator('#btn-nuevo-personal').click({ force: true });
  await expect(page.locator('#modal-personal')).toBeVisible({ timeout: 10000 });

  const suffix = String(Date.now()).slice(-6);
  // Solo letras: la validación del nombre rechaza dígitos
  const nombre = `Auditoria Movil ${label}`;
  await page.fill('#p-nombre', nombre);
  await page.fill('#p-dpi', `2888${suffix}010101`.replace(/\D/g, '').slice(0, 13).padEnd(13, '0'));
  const puesto = page.locator('#p-puesto');
  if ((await puesto.locator('option').count()) > 1) await puesto.selectOption({ index: 1 });
  await page.fill('#p-jefe', 'Ingeniero QA');
  await page.fill('#p-telefono', '55559876');
  await page.locator('#btn-guardar-personal').click({ force: true });

  await expect.poll(async () => page.evaluate((n) => {
    const all = (window as any).AppState?.get?.('personal') || [];
    return all.some((x: any) => x.Nombre_Completo === n);
  }, nombre), { timeout: 15000 }).toBeTruthy();

  const workerId = await page.evaluate((n) => {
    const all = (window as any).AppState?.get?.('personal') || [];
    return all.find((x: any) => x.Nombre_Completo === n)?.ID_Trabajador || null;
  }, nombre);
  expect(workerId).toBeTruthy();

  const row = page.locator(`tr[data-id="${workerId}"]`).first();
  await expect(row).toBeVisible({ timeout: 8000 });
  // En móvil la columna acciones puede requerir scroll horizontal
  await row.locator('[data-action="qr"]').scrollIntoViewIfNeeded().catch(() => {});
  await row.locator('[data-action="qr"]').click({ force: true });
  await expect(page.locator('#modal-carne')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#carne-print-area')).toBeVisible();
  await expect.poll(
    async () => page.locator('#carne-qr-container canvas, #carne-qr-container img').count(),
    { timeout: 10000 },
  ).toBeGreaterThan(0);
  await expect(page.locator('#btn-descargar-carne-png')).toBeEnabled();
  await expect(page.locator('#btn-imprimir-carne')).toBeEnabled();

  const box = await page.locator('#carne-print-area').boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(200);
  expect(box!.width).toBeLessThanOrEqual((page.viewportSize()?.width || 500) + 8);

  await page.locator('#modal-carne .modal-close').first().click({ force: true }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);

  await goPage(page, 'reportes');
  await page.locator('#btn-preview-diario').click({ force: true });
  await page.waitForTimeout(1200);
  await expect(page.locator('#reporte-preview-card')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#reporte-preview-content')).toBeVisible();

  await goPage(page, 'asistencia');
  await goPage(page, 'campo');
  await goPage(page, 'ajustes');

  expect(errors.filter((e) => !/ResizeObserver|favicon/i.test(e))).toEqual([]);
});
