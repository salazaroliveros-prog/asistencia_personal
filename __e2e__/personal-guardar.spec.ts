/**
 * Guardado de personal: el Logger no debe abortar el flujo antes de validar/guardar.
 */
import { test, expect, type Page } from '@playwright/test';

async function bootPersonal(page: Page) {
  await page.goto('/#personal', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 20000 }).catch(() => {});
  await page.waitForSelector('#app:not([hidden])', { timeout: 20000 });
  await page.waitForSelector('#page-personal', { timeout: 15000 });
}

test.describe('Personal — guardado sin errores de consola Firebase', () => {
  test('abrir modal, rellenar y guardar no lanza No Firebase App', async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await bootPersonal(page);

    await page.locator('#btn-nuevo-personal').click();
    await expect(page.locator('#modal-personal')).toBeVisible({ timeout: 10000 });

    const suffix = String(Date.now()).slice(-4);
    // Solo letras/espacios: Validators rechaza dígitos en el nombre
    await page.fill('#p-nombre', `Carlos Perez Prueba`);
    await page.fill('#p-dpi', `2988${suffix}010101`.slice(0, 13));
    const puestoSelect = page.locator('#p-puesto');
    await puestoSelect.selectOption({ index: 1 }).catch(async () => {
      const opts = puestoSelect.locator('option');
      const n = await opts.count();
      if (n > 1) await puestoSelect.selectOption({ index: Math.min(1, n - 1) });
    });
    await page.fill('#p-jefe', 'Ingeniero Salazar');
    await page.fill('#p-telefono', '55551234');

    await page.locator('#btn-guardar-personal').click();
    // Esperar cierre de modal o toast de éxito/offline
    await Promise.race([
      page.waitForSelector('#modal-personal[hidden], #modal-personal:not(.open)', { timeout: 15000 }).catch(() => null),
      page.waitForSelector('#toast-container .toast', { timeout: 15000 }),
    ]);
    await page.waitForTimeout(800);

    const fatal = consoleErrors.filter((t) =>
      /No Firebase App|shutting down/i.test(t),
    );
    expect(fatal, `Errores Firebase en consola:\n${fatal.join('\n')}`).toEqual([]);

    // Éxito: modal cerrado o toast (éxito / guardado local)
    const modalVisible = await page.locator('#modal-personal').isVisible().catch(() => false);
    const toastText = ((await page.locator('#toast-container .toast').first().textContent().catch(() => '')) || '');
    const okFeedback = /guardado|registrado|actualizado|local/i.test(toastText);
    expect(
      !modalVisible || okFeedback,
      `Modal aún abierto y toast no confirma guardado. Toast: "${toastText}"`,
    ).toBeTruthy();
  });
});
