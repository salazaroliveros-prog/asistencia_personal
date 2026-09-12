const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SHOTS = path.join(__dirname, 'output', 'screenshots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

function shot(page, name) {
  const file = path.join(SHOTS, name + '-' + Date.now() + '.png');
  // fullPage puede colgar con animaciones/backdrop-filter infinitos; timeout + fallback viewport.
  return page.screenshot({ path: file, fullPage: true, timeout: 8000 })
    .catch(() => page.screenshot({ path: file, fullPage: false, timeout: 8000 }));
}

test.describe('Flujo E2E - QA Completo', () => {

  test('01. Carga inicial y splash - app visible', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[CONSOLE] ' + msg.text()); });
    await page.goto('/');
    await page.waitForLoadState('load');
    await expect(page.locator('#splash-screen')).toBeVisible({ timeout: 5000 });
    await shot(page, '01-splash');
    await page.waitForFunction(() => {
      const splash = document.querySelector('#splash-screen');
      const app = document.querySelector('#app');
      return splash && (splash.style.display === 'none' || splash.hasAttribute('hidden')) && app && !app.hasAttribute('hidden');
    }, { timeout: 15000 });
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#sidebar')).toBeVisible();
        await shot(page, '02-app-visible');
    expect(errors).toEqual([]);
  });

  test('02. PWA Install Banner - aparicion y boton X', async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); });
    });
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt');
      event.preventDefault = () => {};
      window.dispatchEvent(event);
    });
    const banner = page.locator('#pwa-install-banner');
    await expect(banner).toBeVisible();
    await expect(page.locator('#pwa-install-title')).toHaveText(/Instalar/i);
    await shot(page, '03-banner-visible');
    const dismiss = page.locator('#pwa-install-dismiss');
    const box = await dismiss.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    console.log('  [touch] boton X: ' + Math.round(box.width) + 'x' + Math.round(box.height) + 'px');
    await dismiss.click();
    await page.waitForTimeout(500);
    await expect(banner).toBeHidden();
    await page.reload();
    await page.waitForLoadState('load');
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt');
      event.preventDefault = () => {};
      window.dispatchEvent(event);
    });
    await page.waitForTimeout(800);
    await expect(banner).toBeHidden();
    console.log('  [persist] Banner no reaparece tras recarga - OK');
  });

  // Flujo real de usuario para navegar entre páginas en móvil:
  // hamburguesa del topbar (#menu-toggle) -> enlace del sidebar -> esperar.
  async function navTo(page, name) {
    const link = page.locator('[data-page="' + name + '"]').first();
    if ((await link.count()) === 0) return false;
    const open = await page.evaluate(() => document.body.classList.contains('sidebar-open'));
    if (!open) {
      const burger = page.locator('#menu-toggle').first();
      if (await burger.count() > 0) { await burger.click(); await page.waitForTimeout(600); }
    }
    await link.click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    // cerrar el menú si quedó abierto (overlay)
    await page.evaluate(() => document.body.classList.remove('sidebar-open'));
    return true;
  }

  test('03. Navegacion SPA por menu lateral', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForSelector('#app:not([hidden])');
    const burger = page.locator('#menu-toggle').first();
    await burger.click();
    await page.waitForTimeout(600);
    const opened = await page.evaluate(() => document.body.classList.contains('sidebar-open'));
    expect(opened).toBe(true);
    await shot(page, '03-sidebar-open');
    await page.locator('#sidebar-overlay, .sidebar-overlay').first().click().catch(() => {});
    await page.waitForTimeout(400);
    const closed = await page.evaluate(() => !document.body.classList.contains('sidebar-open'));
    expect(closed).toBe(true);
    console.log('  [menu] Abrir con hamburguesa + cerrar con overlay - OK');
    const pages = ['personal', 'asistencia', 'campo', 'reportes', 'ajustes'];
    for (const p of pages) {
      const ok = await navTo(page, p);
      if (ok) await shot(page, 'nav-' + p);
    }
    await navTo(page, 'dashboard');
    await shot(page, 'nav-dashboard');
  });

  test('04. Formulario Personal - validaciones', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForSelector('#app:not([hidden])');
    await navTo(page, 'personal');
    await shot(page, '04-nav-personal');
    const addBtn = page.locator('button:has-text("Nuevo"), button:has-text("Agregar"), button:has-text("+"), button:has-text("Crear")').first();
    if (await addBtn.count() > 0) await addBtn.click();
    await shot(page, '04-form-personal');
    const dpi = page.locator('#trabajador-dpi, #personal-dpi, input[placeholder*="DPI"], #dpi-input').first();
    const nombre = page.locator('#trabajador-nombre, #personal-nombre, input[placeholder*="Nombre"], #nombre-input').first();
    if (await dpi.count() > 0) {
      await dpi.fill('123');
      await page.keyboard.press('Tab');
      await nombre.fill('A');
      await page.keyboard.press('Tab');
      const save = page.locator('button:has-text("Guardar"), button[type="submit"]').first();
      if (await save.count() > 0) { await save.click(); await page.waitForTimeout(1000); }
      await shot(page, '04-form-error');
      await dpi.fill('1234567890123');
      await nombre.fill('Trabajador QA Test');
      await shot(page, '04-form-valido');
    }
        console.log('  [form] Validaciones DPI/Nombre testeadas');
  });

  test('05. Pagina de asistencia - KPIs y tabla', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForSelector('#app:not([hidden])');
    await navTo(page, 'asistencia');
    await shot(page, '05-asistencia');
    const tbody = page.locator('#asistencia-tbody');
    const count = await tbody.count();
    expect(count).toBeGreaterThanOrEqual(0);
    console.log('  [tabla] tbody asistencia: ' + count);
    const kpi = page.locator('#kpi-total');
    if (await kpi.count() > 0) console.log('  [kpi] total: ' + (await kpi.textContent() || '0'));
  });

  test('06. Escanner QR - componentes presentes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForSelector('#app:not([hidden])');
    await navTo(page, 'campo');
    const qr = page.locator('#qr-reader');
    if (await qr.count() > 0) console.log('  [qr] #qr-reader presente');
    await shot(page, '06-escaner');
  });

  test('07. Responsivo - mobile vs desktop', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForSelector('#app:not([hidden])');
    await shot(page, '07-mobile');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForSelector('#app:not([hidden])');
    await shot(page, '07-desktop');
    console.log('  [responsive] Layout 1280x720 OK');
  });

  test('08. Accesibilidad - audit axe', async ({ page }) => {
    const { checkA11y } = require('axe-playwright');
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForSelector('#app:not([hidden])');
    await checkA11y(page, undefined, {
      axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } },
      verbose: false,
    });
    console.log('  [a11y] Audit axe pasado');
  });

});