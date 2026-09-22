/**
 * ALERTA DE ACTUALIZACIÓN — Verifica el flujo completo de detección de un
 * deploy nuevo (GitHub → Vercel): cuando la versión servida cambia, la app
 * detecta el update y dispara el banner "#update-banner" para que el usuario
 * actualice. Se simula el marcador window.__APP_VERSION__ que scripts/inject-env.js
 * incrusta en dist/index.html con el commit SHA del deploy.
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';
const NAV_TIMEOUT = 20000;

async function abrir(page: Page, vistaVersion: string, vistoVersion: string | null) {
  await page.addInitScript(
    ([v, seen]) => {
      Object.defineProperty(window, '__APP_VERSION__', { value: v, configurable: true });
      if (seen) {
        localStorage.setItem('cpc_app_version_seen', seen);
      } else {
        localStorage.removeItem('cpc_app_version_seen');
      }
    },
    [vistaVersion, vistoVersion] as [string, string | null]
  );
  await page.goto(`${BASE_URL}/#dashboard`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForSelector('#update-banner', { state: 'attached', timeout: 10000 }).catch(() => {});
}

test('no hay alerta si la versión vista es la misma que la servida', async ({ page }) => {
  await abrir(page, 'sha-deploy-1', 'sha-deploy-1');
  await expect(page.locator('#update-banner')).toBeHidden();
});

test('primera visita tampoco alerta; solo se registra la versión', async ({ page }) => {
  await abrir(page, 'sha-deploy-1', null);
  await expect(page.locator('#update-banner')).toBeHidden();
  const seen = await page.evaluate(() => localStorage.getItem('cpc_app_version_seen'));
  expect(seen).toBe('sha-deploy-1');
});

test('deploy nuevo en Vercel => la app detecta y dispara la alerta', async ({ page }) => {
  await abrir(page, 'sha-deploy-2', 'sha-deploy-1');
  await expect(page.locator('#update-banner')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#update-title')).toContainText('Nueva versión');
  // Tras detectar, se graba la versión nueva para no repetir la alerta
  const seen = await page.evaluate(() => localStorage.getItem('cpc_app_version_seen'));
  expect(seen).toBe('sha-deploy-2');
});

test('"Ahora no" oculta el banner y guarda el descarte por 1 hora', async ({ page }) => {
  await abrir(page, 'sha-deploy-2', 'sha-deploy-1');
  await expect(page.locator('#update-banner')).toBeVisible({ timeout: 10000 });
  await page.locator('#update-dismiss').click();
  await expect(page.locator('#update-banner')).toBeHidden();
  const dismissed = await page.evaluate(() => localStorage.getItem('updateDismissedUntil'));
  expect(dismissed).toBeTruthy();
});

test('"Actualizar ahora" aplica y tras recargar no vuelve a alertar', async ({ page }) => {
  await abrir(page, 'sha-deploy-2', 'sha-deploy-1');
  await expect(page.locator('#update-banner')).toBeVisible({ timeout: 10000 });

  await page.locator('#update-btn').click();
  // El botón recarga la página; esperar el ciclo de navegación
  await page.waitForTimeout(1200);
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 15000 }).catch(() => {});

  // Misma versión servida y ya vista → sin alerta de nuevo
  await expect(page.locator('#update-banner')).toBeHidden();
});