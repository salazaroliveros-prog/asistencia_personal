import { defineConfig } from '@playwright/test';

/**
 * Suite E2E de cámara + QR del escáner de campo (PC y móvil emulado).
 *
 * Cómo se simula "la cámara real":
 * los tests sustituyen SOLO el hardware —igual que un dispositivo virtual tipo
 * OBS Virtual Camera—. El QR real se dibuja en un canvas y se publica con
 * `canvas.captureStream()`; la app lo recibe como MediaStream normal y
 * html5-qrcode decodifica los frames con su pipeline real (qrbox, recortes,
 * fps, API de detección del navegador). No se inyecta texto decodificado.
 * Ver `fakeCanvasCameraInitScript` en __e2e__/qr-camera-fix.spec.ts.
 *
 * Por qué NO se usa `--use-file-for-fake-video-capture` con un vídeo Y4M:
 * en este entorno (Chromium de Playwright sobre Windows) Chromium no entrega
 * píxeles de ese archivo —el frame capturado es negro— probado con varios
 * códigos Y4M (C420, C420jpeg, C420mpeg2, C444), varios tamaños y con/sin
 * `--use-fake-device-for-media-capture`. Por eso el vídeo con QR no sirve para
 * validar la decodificación y se usa la cámara virtual del propio navegador.
 *
 * `--use-fake-device-for-media-capture` se conserva para que
 * `enumerateDevices()` reporte un dispositivo de vídeo aunque el equipo no
 * tenga webcam (evita falsos negativos de "cámara no disponible").
 *
 * Ejecutar: npx playwright test --config=playwright.qr-camera.config.ts
 */
const CAMERA_ARGS = ['--use-fake-ui-for-media-capture', '--use-fake-device-for-media-capture'];

// El headless de Chromium no expone cámara real; se acepta el modo sin ventana
// cuando el entorno no puede abrir UI (CI) mediante HEADLESS=1.
const HEADLESS = process.env.HEADLESS === '1';

const CAMERA_LAUNCH = {
  headless: HEADLESS,
  args: CAMERA_ARGS,
};

export default defineConfig({
  testDir: '__e2e__',
  // qr-camera-fix.spec.ts  → cámara + QR (PC y móvil emulado)
  // app-integral.spec.ts   → trabajadores, asistencias, inasistencias, reportes
  testMatch: ['qr-camera-fix.spec.ts', 'app-integral.spec.ts'],
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
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'desktop-pc',
      // Escritorio: cámara PC + validación integral de la app
      grep: /Cámara PC|App integral/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        launchOptions: CAMERA_LAUNCH,
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
        launchOptions: CAMERA_LAUNCH,
      },
    },
  ],
});

