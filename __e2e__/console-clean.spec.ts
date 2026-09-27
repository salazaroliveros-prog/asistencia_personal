/**
 * AUDITORÍA DE CONSOLA — 0 errores / 0 warnings
 *
 * Guarda de regresión: la app no debe escribir nada en console.error ni
 * console.warn durante el arranque (splash → dashboard) ni en las vistas
 * auxiliares (escáner de campo, escáner PWA).
 *
 * Uso:
 *   · Local  (servidor dev de `playwright.config.ts`):
 *       npx playwright test __e2e__/console-clean.spec.ts --reporter=list
 *   · Producción / staging:
 *       AUDIT_BASE_URL=https://controlasistenciaapp.vercel.app \
 *       npx playwright test __e2e__/console-clean.spec.ts --reporter=list
 */
import { test, expect } from '@playwright/test';

const BASE = (process.env.AUDIT_BASE_URL || '').replace(/\/$/, '');

/** Páginas auditadas: rutas relativas al host de la app. */
const PAGES = ['/', '/field-scanner.html', '/pwa/scanner.html'];

/**
 * Warnings/errores de terceros tolerados (CDN, extensiones del navegador…).
 * Debe permanecer vacío: cualquier entrada aquí es deuda técnica explícita.
 */
const ALLOWED: RegExp[] = [];

function url(path: string): string {
  return BASE ? `${BASE}${path}` : path;
}

for (const path of PAGES) {
  test(`consola limpia en ${path}`, async ({ page }) => {
    const messages: string[] = [];

    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        messages.push(`[${type}] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => messages.push(`[pageerror] ${err.message}`));

    const response = await page.goto(url(path), {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    expect(response?.status() ?? 0, `HTTP de ${path}`).toBeLessThan(400);

    // Margen para listeners async (auth/estado de conexión).
    await page.waitForTimeout(2500);

    const bad = messages.filter((m) => !ALLOWED.some((re) => re.test(m)));
    expect(bad, `Mensajes de consola no permitidos en ${path}:\n${bad.join('\n')}`).toEqual([]);
  });
}
