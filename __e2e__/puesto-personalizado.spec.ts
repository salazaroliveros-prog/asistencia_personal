/**
 * CONTROL PERSONAL CAMPO — Puesto de trabajo personalizado (E2E)
 *
 * Verifica en navegador real que el usuario pueda crear un puesto que no está
 * en el catálogo base desde el formulario de Personal:
 *   1. Al elegir "Otro (personalizado)…" aparece el campo de texto.
 *   2. Enter guarda el puesto en localStorage y en el <select>.
 *   3. El trabajador se guarda con ese puesto nuevo.
 *   4. Tras recargar, el puesto sigue disponible en el formulario y el filtro.
 *   5. Escape cancela y el guardado sin texto muestra el error de validación.
 *
 * Ejecutar: npx playwright test __e2e__/puesto-personalizado.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';
const CUSTOM_KEY = 'cpc_puestos_custom';
const PUESTO_NUEVO = 'Ferrallista';

/** Mock del SDK compat de Firebase (evita llamadas reales en el E2E). */
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
      await fn({ get: async () => ({ exists: false }), set() {} });
    },
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
    auth() {
      return {
        currentUser: null,
        onAuthStateChanged() {},
        signInWithEmailAndPassword: async () => ({ user: { email: 'sistemadecontrol090@gmail.com' } }),
        signOut: async () => {},
      };
    },
  };
  Object.defineProperty(window, 'firebase', {
    configurable: false,
    get: () => window.__firebaseMock,
    set: () => {},
  });
}

/** Un trabajador sembrado para que la tabla no esté vacía. */
function seedWorkersInitScript() {
  localStorage.setItem('cpc_personal_cache', JSON.stringify([
    {
      ID_Trabajador: 'TRAB-PUESTO-001',
      Nombre_Completo: 'Juan Pérez Gómez',
      Puesto: 'Albañil',
      DPI_CUI: '30158847100101',
      Estado: 'Activo',
    },
  ]));
}

test.describe('Personal — puesto de trabajo personalizado', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(mockFirebaseInitScript);
    await page.addInitScript(seedWorkersInitScript);
    await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#personal-tbody')).toBeVisible({ timeout: 15000 });
    await page.locator('#btn-nuevo-personal').click();
    await expect(page.locator('#modal-personal')).toBeVisible();
  });

  test('muestra el campo de texto al elegir "Otro (personalizado)…"', async ({ page }) => {
    const input = page.locator('#p-puesto-custom');
    await expect(input).toBeHidden();

    await page.selectOption('#p-puesto', '__custom__');

    await expect(input).toBeVisible();
  });

  test('Enter registra el puesto y lo deja disponible en el select', async ({ page }) => {
    await page.selectOption('#p-puesto', '__custom__');
    await page.fill('#p-puesto-custom', PUESTO_NUEVO);
    await page.locator('#p-puesto-custom').press('Enter');

    // Persistido en localStorage
    const guardados = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || '[]'),
      CUSTOM_KEY,
    );
    expect(guardados).toContain(PUESTO_NUEVO);

    // Disponible como opción del formulario (antes de "Otro…")
    const valores = await page.locator('#p-puesto option').evaluateAll(
      (opts) => opts.map((o) => (o as HTMLOptionElement).value),
    );
    expect(valores).toContain(PUESTO_NUEVO);
    expect(valores.indexOf(PUESTO_NUEVO)).toBeLessThan(valores.indexOf('__custom__'));
  });

  test('el trabajador se guarda con el puesto personalizado', async ({ page }) => {
    await page.selectOption('#p-puesto', '__custom__');
    await page.fill('#p-puesto-custom', PUESTO_NUEVO);
    await page.fill('#p-nombre', 'Pedro Ramírez Solís');
    await page.fill('#p-dpi', '30158847100107');
    await page.locator('#btn-guardar-personal').click();

    await expect(page.locator('#modal-personal')).toBeHidden({ timeout: 10000 });
    await expect(page.locator('#personal-tbody')).toContainText('Pedro Ramírez Solís');
    await expect(page.locator('#personal-tbody')).toContainText(PUESTO_NUEVO);

    const cache = await page.evaluate(() => JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]'));
    const nuevo = cache.find((p: { Nombre_Completo: string }) => p.Nombre_Completo === 'Pedro Ramírez Solís');
    expect(nuevo.Puesto).toBe(PUESTO_NUEVO);
  });

  test('el puesto personalizado sobrevive a una recarga', async ({ page }) => {
    await page.selectOption('#p-puesto', '__custom__');
    await page.fill('#p-puesto-custom', PUESTO_NUEVO);
    await page.locator('#p-puesto-custom').press('Enter');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#personal-tbody')).toBeVisible({ timeout: 15000 });

    // En el filtro de la tabla
    const filtro = await page.locator('#filter-puesto option').evaluateAll(
      (opts) => opts.map((o) => (o as HTMLOptionElement).value),
    );
    expect(filtro).toContain(PUESTO_NUEVO);

    // Y de nuevo en el formulario
    await page.locator('#btn-nuevo-personal').click();
    await expect(page.locator('#modal-personal')).toBeVisible();
    const formSelect = await page.locator('#p-puesto option').evaluateAll(
      (opts) => opts.map((o) => (o as HTMLOptionElement).value),
    );
    expect(formSelect).toContain(PUESTO_NUEVO);
  });

  test('Escape cancela la opción personalizada', async ({ page }) => {
    await page.selectOption('#p-puesto', '__custom__');
    await page.fill('#p-puesto-custom', 'Temporal');

    await page.locator('#p-puesto-custom').press('Escape');

    await expect(page.locator('#p-puesto-custom')).toBeHidden();
    await expect(page.locator('#p-puesto')).toHaveValue('');
  });

  test('guardar sin texto muestra el error de validación', async ({ page }) => {
    await page.selectOption('#p-puesto', '__custom__');
    await page.fill('#p-nombre', 'Sin Puesto Válido');
    await page.fill('#p-dpi', '30158847100108');
    await page.locator('#btn-guardar-personal').click();

    await expect(page.locator('#modal-personal')).toBeVisible();
    await expect(page.locator('#p-puesto-error')).toContainText(/nuevo puesto/i);
  });
});
