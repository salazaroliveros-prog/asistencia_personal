import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3801';

function mockFirebase() {
  window.__FIREBASE_ENV__ = null;
  const db = {
    collection: () => ({ doc: () => ({ get: async () => ({ exists: false }), set: async () => {}, update: async () => {}, delete: async () => {} }) }),
    runTransaction: async (fn) => fn({ get: async () => ({ exists: false }), set: async () => {} }),
  };
  const auth = { currentUser: null, onAuthStateChanged() {}, setPersistence: async () => {}, signInWithEmailAndPassword: async () => ({ user: { email: 'x@y.com' } }), signOut: async () => {} };
  window.__e2eMockDb = db;
  window.__firebaseMock = { apps: [], initializeApp() { return {}; }, firestore() { return db; }, auth() { return auth; } };
  Object.defineProperty(window, 'firebase', { configurable: false, get: () => window.__firebaseMock, set: () => {} });
}

test('ajustes: generate + toggle install QR', async ({ page }) => {
  await page.addInitScript(mockFirebase);
  await page.goto(`${BASE_URL}/index.html#ajustes`, { waitUntil: 'domcontentloaded' });
  const btn = page.locator('#btn-qr-scanner-instalacion');
  await expect(btn).toBeVisible({ timeout: 15000 });
  const box = page.locator('#scanner-install-qr');
  await expect(box).toBeHidden();
  await btn.click();
  await expect(box).toBeVisible();
  const code = page.locator('#scanner-install-qr-code');
  await expect.poll(() => code.locator('canvas, img').count()).toBeGreaterThanOrEqual(1);
  const url = await page.locator('#scanner-install-url').textContent();
  expect(url).toBe(`${BASE_URL}/field-scanner.html`);
  await btn.click();
  await expect(box).toBeHidden();
});

test('field-scanner: install banner shows on beforeinstallprompt and dismiss persists', async ({ page }) => {
  await page.addInitScript(mockFirebase);
  await page.goto(`${BASE_URL}/field-scanner.html`, { waitUntil: 'domcontentloaded' });
  const banner = page.locator('#fs-pwa-install-banner');
  await expect(banner).toBeHidden({ timeout: 10000 });
  await page.evaluate(() => {
    const ev = new Event('beforeinstallprompt');
    ev.preventDefault = () => {};
    window.dispatchEvent(ev);
  });
  await expect(banner).toBeVisible({ timeout: 5000 });
  await page.locator('#fs-install-dismiss').click();
  await expect(banner).toBeHidden();
  const persisted = await page.evaluate(() => localStorage.getItem('cpc_fs_pwa_install_dismissed'));
  expect(persisted).toBe('1');
});