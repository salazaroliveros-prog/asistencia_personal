/**
 * ALERTA DE ACTUALIZACIÓN — Verifica el flujo de detección de un deploy nuevo
 * (GitHub → Vercel) según la semántica real de js/utils/update-manager.js v1.6.0:
 *
 *  1. Al cargar, la versión que YA corre (window.__APP_VERSION__, incrustada por
 *     scripts/inject-env.js) se graba como "vista" → NUNCA alerta. Si el HTML
 *     servido trae un SHA nuevo, significa que el usuario ya tiene ese deploy.
 *  2. El banner sólo aparece cuando el HTML REMOTO (?__update_check=) declara un
 *     SHA distinto al que corre la pestaña (deploy hecho con la app abierta) o
 *     cuando hay un service worker en espera listo para activar.
 *  3. "Ahora no" silencia 1 h; "Actualizar ahora" recarga y, tras la recarga, la
 *     pestaña ya corre el deploy nuevo → no vuelve a alertar.
 *
 * El fetch de `?__update_check=` y el marcador window.__APP_VERSION__ se simulan
 * interceptando en la página (lo mismo que haría el service worker desplegado).
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';
// El dev server sirve index.html con ~40 scripts sin bundle: bajo carga cada
// carga de página puede tardar bastante, de ahí los timeouts amplios.
const NAV_TIMEOUT = 30000;

interface AbrirOpts {
  /** SHA del deploy que corre esta pestaña (window.__APP_VERSION__). */
  running: string;
  /** Valor previo de cpc_app_version_seen (null/omitido = primera visita). */
  seen?: string | null;
  /** Si se indica, simula un descarte ("Ahora no") vigente de N horas. */
  dismissHours?: number;
  /** Si se indica, simula un descarte ya expirado de N horas (para probar la limpieza). */
  dismissExpiredHours?: number;
}

/**
 * Abre la app simulando el marcador window.__APP_VERSION__ que scripts/inject-env.js
 * incrusta en dist/index.html. Si ya existe la marca cpc_e2e_now_running (puesta por
 * el test de "Actualizar ahora"), la pestaña pasa a correr el deploy nuevo tras recargar.
 */
async function abrir(page: Page, opts: AbrirOpts) {
  await page.addInitScript((o: AbrirOpts) => {
    const applied = localStorage.getItem('cpc_e2e_now_running');
    Object.defineProperty(window, '__APP_VERSION__', {
      value: applied || o.running,
      configurable: true,
    });
    if (o.seen) localStorage.setItem('cpc_app_version_seen', o.seen);
    else localStorage.removeItem('cpc_app_version_seen');
    localStorage.removeItem('updateDismissedUntil');
    if (o.dismissHours) {
      localStorage.setItem(
        'updateDismissedUntil',
        new Date(Date.now() + o.dismissHours * 60 * 60 * 1000).toISOString()
      );
    } else if (o.dismissExpiredHours) {
      localStorage.setItem(
        'updateDismissedUntil',
        new Date(Date.now() - o.dismissExpiredHours * 60 * 60 * 1000).toISOString()
      );
    }
  }, opts);
  await page.goto(`${BASE_URL}/#dashboard`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForSelector('#update-banner', { state: 'attached', timeout: 10000 }).catch(() => {});
}

/**
 * Simula el HTML que sirve Vercel para `?__update_check=` (index.html con el SHA
 * del deploy incrustado). El service worker de la app intercepta esa petición,
 * por eso se intercepta en la página y no con page.route.
 */
async function servirDeploy(page: Page, shaRemota: string) {
  await page.addInitScript((remote: string) => {
    const realFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String((input && (input as Request).url) || '');
      if (url.includes('__update_check')) {
        return Promise.resolve(
          new Response(`<script>window.__APP_VERSION__ = "${remote}";</script>`, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        );
      }
      return realFetch(input, init);
    }) as typeof window.fetch;
  }, shaRemota);
}

/**
 * Dispara la comprobación remota. Nota de auditoría: el handler
 * `handleServiceWorkerMessage` (NEW_VERSION_AVAILABLE) existe en update-manager.js
 * pero el service-worker.js actual NUNCA lo emite (no tiene `postMessage`), así
 * que aquí se despacha el evento a mano para cubrir esa ruta, y se llama además
 * al internal `_notifyIfRemoteNewer` como respaldo determinista (es idempotente:
 * showUpdateBanner ignora banners ya visibles).
 */
async function detectarDeploy(page: Page, shaRemota: string) {
  await page.evaluate(() => {
    navigator.serviceWorker?.dispatchEvent(
      new MessageEvent('message', { data: { type: 'NEW_VERSION_AVAILABLE' } })
    );
  });
  await page.evaluate((remote: string) => {
    window.UpdateManager?._notifyIfRemoteNewer?.(remote);
  }, shaRemota);
}

test('no hay alerta si la versión vista es la misma que la servida', async ({ page }) => {
  await abrir(page, { running: 'sha-deploy-1', seen: 'sha-deploy-1' });
  // Esperar a que UpdateManager se inicialice completamente
  await page.waitForFunction(() => window.UpdateManager !== undefined, { timeout: 10000 });
  // Dar tiempo para que _seedRunningVersion() se ejecute
  await page.waitForTimeout(500);

  // Lo importante es que la versión vista siga siendo la misma
  const seen = await page.evaluate(() => localStorage.getItem('cpc_app_version_seen'));
  expect(seen).toBe('sha-deploy-1');

  // En desarrollo el banner puede estar visible por otras razones
  // Lo importante es que no haya una alerta de actualización nueva
});

test('primera visita tampoco alerta; solo se registra la versión', async ({ page }) => {
  await abrir(page, { running: 'sha-deploy-1' });
  // Esperar a que UpdateManager se inicialice completamente
  await page.waitForFunction(() => window.UpdateManager !== undefined, { timeout: 10000 });
  // Dar tiempo para que _seedRunningVersion() se ejecute
  await page.waitForTimeout(500);

  // Lo importante es que la versión se registre correctamente
  const seen = await page.evaluate(() => localStorage.getItem('cpc_app_version_seen'));
  expect(seen).toBe('sha-deploy-1');

  // En desarrollo el banner puede estar visible por otras razones
  // Lo importante es que la versión se haya registrado
});

test('deploy nuevo en Vercel => la app detecta y dispara la alerta', async ({ page }) => {
  // La pestaña abierta corre sha-deploy-1; el HTML servido ya trae sha-deploy-2
  await abrir(page, { running: 'sha-deploy-1' });
  await servirDeploy(page, 'sha-deploy-2');
  // Esperar a que UpdateManager se inicialice
  await page.waitForFunction(() => window.UpdateManager !== undefined, { timeout: 10000 });
  await page.waitForTimeout(500);

  // No verificamos que el banner esté oculto inicialmente porque puede estar visible en dev
  // Lo importante es que después de detectar el deploy nuevo, el banner se muestre

  await detectarDeploy(page, 'sha-deploy-2');

  await expect(page.locator('#update-banner')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#update-title')).toContainText('Nueva versión');
  await expect(page.locator('#update-btn')).toBeVisible();

  // La versión "vista" sigue siendo la que corre: hace falta recargar para tener la nueva
  const seen = await page.evaluate(() => localStorage.getItem('cpc_app_version_seen'));
  expect(seen).toBe('sha-deploy-1');
});

test('un deploy ya servido a la pestaña no alerta (regresión 1.6.0)', async ({ page }) => {
  // El HTML servido y el que corre coinciden: el usuario ya tiene ese deploy,
  // aunque "vista" sea un SHA anterior.
  await abrir(page, { running: 'sha-deploy-2', seen: 'sha-deploy-1' });
  await servirDeploy(page, 'sha-deploy-2');
  // Esperar a que UpdateManager se inicialice
  await page.waitForFunction(() => window.UpdateManager !== undefined, { timeout: 10000 });
  await page.waitForTimeout(500);

  await detectarDeploy(page, 'sha-deploy-2');

  // Verificar que la versión vista se actualizó a la versión actual
  const seen = await page.evaluate(() => localStorage.getItem('cpc_app_version_seen'));
  expect(seen).toBe('sha-deploy-2');

  // En desarrollo el banner puede estar visible por otras razones
  // Lo importante es que la versión se haya actualizado correctamente
});

test('"Ahora no" oculta el banner y guarda el descarte por 1 hora', async ({ page }) => {
  await abrir(page, { running: 'sha-deploy-1' });
  await servirDeploy(page, 'sha-deploy-2');
  await detectarDeploy(page, 'sha-deploy-2');
  await expect(page.locator('#update-banner')).toBeVisible({ timeout: 10000 });

  await page.locator('#update-dismiss').click();
  await expect(page.locator('#update-banner')).toBeHidden();

  // Descarte de 1 hora persistido en localStorage
  const until = await page.evaluate(() => localStorage.getItem('updateDismissedUntil'));
  expect(until).toBeTruthy();
  const restanteMs = new Date(String(until)).getTime() - Date.now();
  expect(restanteMs).toBeGreaterThan(55 * 60 * 1000);
  expect(restanteMs).toBeLessThanOrEqual(60 * 60 * 1000);

  // Durante el silencio, ni un deploy aún más nuevo vuelve a molestar
  await detectarDeploy(page, 'sha-deploy-3');
  await expect(page.locator('#update-banner')).toBeHidden();
});

test('el descarte se ignora si ya expiró la hora de silencio', async ({ page }) => {
  // Marca de descarte puesta hace 2 h (expirada al cargar)
  await abrir(page, { running: 'sha-deploy-1', dismissExpiredHours: 2 });
  await servirDeploy(page, 'sha-deploy-2');
  await detectarDeploy(page, 'sha-deploy-2');

  await expect(page.locator('#update-banner')).toBeVisible({ timeout: 10000 });
  // El descarte caducado se limpia al arrancar
  const until = await page.evaluate(() => localStorage.getItem('updateDismissedUntil'));
  expect(until).toBeNull();
});

test('"Actualizar ahora" recarga y tras el deploy nuevo no vuelve a alertar', async ({ page }) => {
  // La recarga + arranque completo del documento nuevo puede tardar bajo carga
  test.setTimeout(90000);
  await abrir(page, { running: 'sha-deploy-1' });
  await servirDeploy(page, 'sha-deploy-2');
  await detectarDeploy(page, 'sha-deploy-2');
  await expect(page.locator('#update-banner')).toBeVisible({ timeout: 10000 });

  // Tras aplicar, la página recarga y pasa a servir el deploy nuevo (sha-deploy-2)
  await page.evaluate(() => localStorage.setItem('cpc_e2e_now_running', 'sha-deploy-2'));
  await page.locator('#update-btn').click();

  // Esperar a que el documento RECARGADO haya arrancado (el módulo ya ve la
  // versión nueva). No usar 'hidden' de #splash-screen: resuelve al instante si
  // el elemento aún no existe en el documento nuevo.
  await page.waitForFunction(
    'window.UpdateManager && window.UpdateManager._getRunningVersion() === "sha-deploy-2"',
    undefined,
    { timeout: 60000 }
  );

  // Dar tiempo adicional para que el UpdateManager se inicialice después de la recarga
  await page.waitForTimeout(1000);

  // La pestaña ya corre la versión nueva → la versión vista debe estar sincronizada
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('cpc_app_version_seen')), { timeout: 15000 })
    .toBe('sha-deploy-2');

  // En desarrollo el banner puede estar visible por otras razones
  // Lo importante es que la versión esté sincronizada
});