import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '__e2e__',
  // Suite E2E LOCAL (determinista): corre contra el dev server de Vite y no
  // depende de servicios externos. Los specs que SÍ necesitan el deploy real,
  // cámara simulada o un backend Firebase se ejecutan con su propia config:
  //   npm run test:e2e:live         → playwright.live.config.ts
  //   npm run test:e2e:live-mobile  → playwright.live-mobile.config.ts
  //   npm run test:e2e:integral     → playwright.integral.config.ts
  //   npm run test:e2e:qr           → playwright.qr-camera.config.ts
  testIgnore: [
    '**/live-production-audit.spec.ts',
    '**/live-mobile-smoke.spec.ts',
    '**/app-integral.spec.ts',
    '**/puesto-personalizado.spec.ts',
    '**/qr-camera-fix.spec.ts',
    '**/console-clean.spec.ts',      // requiere AUDIT_BASE_URL
    '**/production-validation.spec.js', // auditoría contra un deploy concreto
  ],
  testTimeout: 45000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: '__e2e__/output',
  snapshotDir: '__e2e__/snapshots',

  // Arrancar el servidor de desarrollo automáticamente antes de los tests
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 3801',
    url: 'http://127.0.0.1:3801',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },

  use: {
    baseURL: 'http://127.0.0.1:3801',
    viewport: { width: 390, height: 844 }, // iPhone 12-like
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    actionTimeout: 10000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
