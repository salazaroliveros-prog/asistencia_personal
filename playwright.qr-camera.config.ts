import { defineConfig } from '@playwright/test';

const FAKE_CAMERA_ARGS = [
  '--use-fake-device-for-media-capture',
  '--use-fake-ui-for-media-capture',
];

export default defineConfig({
  testDir: '__e2e__',
  testMatch: 'qr-camera-fix.spec.ts',
  testTimeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: '__e2e__/output/qr-camera-fix',
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 3801',
    url: 'http://127.0.0.1:3801',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3801',
    geolocation: { latitude: 14.63492, longitude: -90.50693 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-pc',
      // Solo los tests de cámara de escritorio (el file spec contiene ambos)
      grep: /Cámara PC/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        // headless nuevo de Chromium NO soporta cámara falsa (NotSupportedError)
        launchOptions: { headless: false, args: FAKE_CAMERA_ARGS },
      },
    },
    {
      name: 'mobile-emulado',
      // Solo los tests de la ruta móvil emulada
      grep: /móvil emulada/i,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        launchOptions: { headless: false, args: FAKE_CAMERA_ARGS },
      },
    },
  ],
});
