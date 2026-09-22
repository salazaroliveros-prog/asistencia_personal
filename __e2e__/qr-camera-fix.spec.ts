/**
 * CONTROL PERSONAL CAMPO — Validación de regresión: cámara + escaneo QR
 *
 * Cubre las dos rutas reales de la app:
 *  - PC (desktop): CameraSession + Html5Qrcode sobre la cámara del equipo.
 *  - Móvil emulado: MobileQRScanner (constraints optimizados por dispositivo).
 *
 * Técnicas de validación usadas:
 *  1. Cámara falsa de Chromium (--use-fake-device-for-media-capture): verifica que
 *     el arranque de cámara no falla por constraints (regresión #1).
 *  2. Cámara simulada con QR real (ver fakeCanvasCameraInitScript): la app recibe
 *     frames reales y html5-qrcode los decodifica sin que se inyecte el texto.
 *  3. QR real + scanFileV2: comprueba el pipeline de decodificación con la imagen.
 *
 * Ejecutar: npx playwright test --config=playwright.qr-camera.config.ts
 */

import { test, expect } from '@playwright/test';
import QRCode from 'qrcode';

const BASE_URL = 'http://127.0.0.1:3801';
const FAKE_CAMERA_ARGS = [
  '--use-fake-device-for-media-capture',
  '--use-fake-ui-for-media-capture',
];

const TRABAJADORES = [
  { ID_Trabajador: 'TRAB-E2E-001', Nombre_Completo: 'Juan Pérez Gómez', Puesto: 'Albañil', DPI_CUI: '30158847100101' },
  { ID_Trabajador: 'TRAB-E2E-002', Nombre_Completo: 'Ana Lucía Torres', Puesto: 'Electricista', DPI_CUI: '30158847100102' },
  { ID_Trabajador: 'TRAB-E2E-003', Nombre_Completo: 'Carlos Méndez López', Puesto: 'Maestro de Obra', DPI_CUI: '30158847100103' },
];

/**
 * Mock mínimo del SDK Firebase compat: permite probar el flujo completo
 * (escaneo → trabajador → marcación → feed) sin red ni credenciales reales.
 */
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
      const tx = { get: async () => ({ exists: false }), set() {} };
      await fn(tx);
    },
  };
  const auth = {
    currentUser: null,
    onAuthStateChanged() {},

    signInWithEmailAndPassword: async () => ({ user: { email: 'sistemadecontrol090@gmail.com' } }),
    signOut: async () => {}
  };
  window.__FIREBASE_ENV__ = null;
  // GPS determinista (evita prompts/colgos de geolocalización en headed)
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok) => ok({ coords: { latitude: 14.63492, longitude: -90.50693, accuracy: 10 } }),
      watchPosition: () => 0, clearWatch: () => {}
    },
  });
  window.__e2eMockDb = db;
  window.__firebaseMock = {
    apps: [], initializeApp() { return {}; }, firestore() { return db; }, auth() { return auth; }
  };
  // Bloquear el SDK real de Firebase (cargado vía CDN tras este init script)
  // para que window.firebase del compat SDK sea un no-op.
  Object.defineProperty(window, 'firebase', { configurable: false, get: () => window.__firebaseMock, set: () => {} });
}

function seedWorkersInitScript() {
  localStorage.setItem('cpc_personal_cache', JSON.stringify([
    { ID_Trabajador: 'TRAB-E2E-001', Nombre_Completo: 'Juan Pérez Gómez', Puesto: 'Albañil', DPI_CUI: '30158847100101', Estado: 'Activo' },
    { ID_Trabajador: 'TRAB-E2E-002', Nombre_Completo: 'Ana Lucía Torres', Puesto: 'Electricista', DPI_CUI: '30158847100102', Estado: 'Activo' },
    { ID_Trabajador: 'TRAB-E2E-003', Nombre_Completo: 'Carlos Méndez López', Puesto: 'Maestro de Obra', DPI_CUI: '30158847100103', Estado: 'Activo' },
  ]));
}

/**
 * Cámara simulada con QR REAL decodificable.
 *
 * Chromium NO entrega píxeles con `--use-file-for-fake-video-capture` (verificado:
 * el frame sale negro con cualquier código Y4M, cualquier tamaño y con/sin
 * --use-fake-device-for-media-capture), por lo que no sirve para validar la
 * decodificación. En su lugar se dibuja el QR en un canvas y se expone ese
 * `canvas.captureStream()` como cámara del dispositivo.
 *
 * Lo que se sustituye es SOLO el hardware: los frames viajan por WebRTC/media y
 * los decodifica html5-qrcode con el pipeline real de la app (qrbox, recortes,
 * FPS, Api de detección del navegador). No se inyecta el texto decodificado.
 *
 * @param dataUrl QR ya renderizado (generado con `qrcode` en Node)
 */
function fakeCanvasCameraInitScript(dataUrl: string) {
  const buildStream = async (): Promise<MediaStream> => {
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No se pudo cargar el QR de la cámara simulada'));
    });

    const W = 640;
    const H = 480;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    // El QR ocupa ~62 % del alto: suficiente para el qrbox del escáner.
    const side = Math.round(H * 0.62);
    const offX = Math.round((W - side) / 2);
    const offY = Math.round((H - side) / 2);
    const margin = Math.round(H * 0.02);
    const paper = '#f4f4f5';

    let tick = 0;
    const draw = () => {
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, W, H);
      // "Pulso" mínimo para que cada frame sea nuevo (evita optimizaciones que
      // congelan el canvas si nada cambia).
      const wobble = Math.sin(tick / 12) > 0 ? 1 : 0;
      tick += 1;
      ctx.drawImage(img, offX + wobble, offY, side, side);
      ctx.fillStyle = 'rgba(0,0,0,0.02)';
      ctx.fillRect(0, H - margin, W, margin);
      requestAnimationFrame(draw);
    };
    draw();

    // 15 fps: ritmo realista de cámara y suficiente para el scanner (10 fps).
    return canvas.captureStream(15);
  };

  const mediaDevices = navigator.mediaDevices;
  const original = mediaDevices.getUserMedia.bind(mediaDevices);
  let pending: Promise<MediaStream> | null = null;
  const cameraStream = () => (pending = pending || buildStream());
  const shared = cameraStream();

  Object.defineProperty(mediaDevices, 'getUserMedia', {
    configurable: true,
    value: (constraints?: MediaStreamConstraints) => {
      if (constraints && constraints.video) {
        // Cada consumidor recibe su propia copia del stream (como una cámara real).
        return shared.then((stream) => (typeof stream.clone === 'function' ? stream.clone() : stream));
      }
      return original(constraints);
    },
  });
}

/**
 * Registra lo que el operario ve realmente durante el escaneo: cada mensaje de
 * estado de la cámara y cada tamaño de vídeo con fotogramas válidos.
 *
 * Es necesario porque el escáner se detiene solo después de leer un QR
 * (`_onQRSuccess` → `_stopScanner`): comprobar "Cámara activa" al final es una
 * carrera contra esa parada. Este registro permite afirmar que la cámara sí se
 * activó y que hubo fotogramas reales, sin depender del instante exacto.
 *
 * Se usan MutationObserver + eventos del `<video>` (no un temporizador) para que
 * el registro no dependa del throttling de timers que aplica Chromium cuando la
 * ventana no está en primer plano.
 */
function scannerObserverInitScript() {
  const observed = { status: [] as string[], frames: [] as number[][] };
  (window as unknown as { __e2eObserved: typeof observed }).__e2eObserved = observed;

  const seenVideos = new WeakSet<HTMLVideoElement>();
  const lastValue = (list: unknown[]) => list[list.length - 1];

  const recordStatus = (element: HTMLElement): void => {
    const text = (element.textContent || '').trim();
    if (text && lastValue(observed.status) !== text) observed.status.push(text);
  };

  const recordFrame = (video: HTMLVideoElement): void => {
    if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const size = [video.videoWidth, video.videoHeight];
    const last = lastValue(observed.frames) as number[] | undefined;
    if (!last || last[0] !== size[0] || last[1] !== size[1]) observed.frames.push(size);
  };

  const watchVideo = (video: HTMLVideoElement): void => {
    if (seenVideos.has(video)) return;
    seenVideos.add(video);
    ['loadedmetadata', 'loadeddata', 'playing', 'timeupdate'].forEach((eventName) => {
      video.addEventListener(eventName, () => recordFrame(video));
    });
    recordFrame(video);
  };

  const scan = (): void => {
    const status = document.getElementById('campo-camera-status');
    if (status) recordStatus(status);
    const video = document.querySelector('#campo-qr-reader video') as HTMLVideoElement | null;
    if (video) watchVideo(video);
  };

  const start = (): void => {
    scan();
    new MutationObserver(scan).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    // Respaldo: cubre cambios que no pasen por el DOM (p. ej. fotogramas).
    setInterval(scan, 100);
  };

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}

test.describe('Cámara PC (desktop) — ruta CameraSession/Html5Qrcode', () => {

  test('cámara arranca sin errores de constraints en PC (regression #1)', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'geolocation']);
    await page.addInitScript(mockFirebaseInitScript);
    await page.addInitScript(seedWorkersInitScript);
    await page.goto(`${BASE_URL}/field-scanner.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.FieldScanner.__testLogin());
    await page.evaluate(() => window.FieldScanner.__testSetDb(window.__e2eMockDb));
    await expect(page.locator('#campo-camera-status')).toHaveText(/Cámara activa/i, { timeout: 15000 });
    await page.screenshot({ path: 'evidencia/campo-camera-activa.png', fullPage: true });
    await expect.poll(async () => page.evaluate(() => {
      const v = document.querySelector('#campo-qr-reader video');
      return v ? v.videoWidth : 0;
    }), { timeout: 10000 }).toBeGreaterThan(0);
    await expect(page.locator('#campo-camera-status')).not.toHaveText(/no disponible/i);
    await expect(page.locator('#campo-status-text')).not.toHaveText(/Error al iniciar cámara/i);
  });

  test('QR real decodificado → trabajador → marcación → feed', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'geolocation']);
    await page.addInitScript(mockFirebaseInitScript);
    await page.addInitScript(seedWorkersInitScript);
    await page.goto(`${BASE_URL}/field-scanner.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.FieldScanner.__testLogin());
    await page.evaluate(() => window.FieldScanner.__testSetDb(window.__e2eMockDb));
    await expect(page.locator('#campo-camera-status')).toHaveText(/Cámara activa/i, { timeout: 15000 });

    const worker = TRABAJADORES[1];
    const payload = JSON.stringify({ id: worker.ID_Trabajador, dpi: worker.DPI_CUI, nombre: worker.Nombre_Completo });
    const dataUrl = await QRCode.toDataURL(payload, { width: 400, margin: 2 });
    const decoded = await page.evaluate(async ({ dataUrl }) => {
      const host = document.createElement('div');
      host.id = 'e2e-qr-decode';
      host.style.cssText = 'position:fixed;left:-9999px;width:400px;height:400px;';
      document.body.appendChild(host);
      const bin = atob(dataUrl.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'qr.png', { type: 'image/png' });
      const scanner = new Html5Qrcode('e2e-qr-decode');
      const result = await scanner.scanFileV2(file, false);
      host.remove();
      window.FieldScanner.simulateScan(result.decodedText);
      await new Promise((r) => setTimeout(r, 900));
      return {
        decodedText: result.decodedText,
        name: document.getElementById('campo-worker-name')?.textContent,
        puesto: document.getElementById('campo-worker-puesto')?.textContent,
        status: document.getElementById('campo-status-text')?.textContent
      };
    }, { dataUrl });

    console.log('[QR E2E]', JSON.stringify(decoded));
    expect(decoded.decodedText).toBe(payload);
    await expect.poll(async () => page.evaluate(() => document.getElementById('campo-worker-name')?.textContent || ''), {
      timeout: 5000
    }).toBe(worker.Nombre_Completo);
    await expect(page.locator('#campo-worker-puesto')).toHaveText(worker.Puesto);
    console.log('[QR E2E] clic en Entrada…');
    await page.evaluate(() => document.querySelector('.campo-mark-btn[data-tipo="Entrada"]').click());
    await expect.poll(async () => page.evaluate(() => document.getElementById('campo-status-text')?.textContent || ''), {
      timeout: 15000
    }).toMatch(/Marcación registrada/i);
    await expect(page.locator('#campo-feed-list')).toContainText(worker.Nombre_Completo);
    await expect(page.locator('#campo-feed-list')).toContainText('Entrada');
    await page.screenshot({ path: 'evidencia/campo-qr-marcacion-registrada.png', fullPage: true });
  });

  test('QR real visible por la cámara se decodifica EN VIVO sin inyección (Cámara PC)', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'geolocation']);
    const worker = TRABAJADORES[1];
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ id: worker.ID_Trabajador, dpi: worker.DPI_CUI, nombre: worker.Nombre_Completo }), { width: 400, margin: 2 });
    await page.addInitScript(mockFirebaseInitScript);
    await page.addInitScript(seedWorkersInitScript);
    await page.addInitScript(scannerObserverInitScript);
    // La cámara entrega frames con el QR dibujado: si el trabajador aparece en
    // pantalla es porque html5-qrcode decodificó los frames de verdad.
    await page.addInitScript(fakeCanvasCameraInitScript, qrDataUrl);
    await page.goto(`${BASE_URL}/field-scanner.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.FieldScanner.__testLogin());
    await page.evaluate(() => window.FieldScanner.__testSetDb(window.__e2eMockDb));

    // NO se llama a simulateScan: el nombre debe llegar solo desde la cámara.
    // Al leer el QR la app detiene el escáner a propósito, así que la cámara se
    // valida con el registro de lo observado y no con el estado final.
    await expect(page.locator('#campo-worker-name')).toHaveText(worker.Nombre_Completo, { timeout: 30000 });
    await expect(page.locator('#campo-worker-puesto')).toHaveText(worker.Puesto);

    const observed = await page.evaluate(() => (window as unknown as {
      __e2eObserved: { status: string[]; frames: number[][] };
    }).__e2eObserved);
    console.log('[QR E2E] estados de cámara:', JSON.stringify(observed.status));
    console.log('[QR E2E] fotogramas de cámara:', JSON.stringify(observed.frames));
    expect(observed.status.some((value) => /Cámara activa/i.test(value))).toBe(true);
    expect(observed.frames.length).toBeGreaterThan(0);
    expect(observed.frames[0][0]).toBeGreaterThan(0);
    expect(observed.frames[0][1]).toBeGreaterThan(0);

    await page.screenshot({ path: 'evidencia/campo-qr-camera-live.png', fullPage: true });

    // La marcación del trabajador recién detectado por cámara se registra
    await page.evaluate(() => (document.querySelector('.campo-mark-btn[data-tipo="Entrada"]') as HTMLElement).click());
    await expect(page.locator('#campo-status-text')).toHaveText(/Marcación registrada/i, { timeout: 15000 });
    await expect(page.locator('#campo-feed-list')).toContainText(worker.Nombre_Completo);
    await page.screenshot({ path: 'evidencia/campo-qr-camera-live-marcacion.png', fullPage: true });
  });

  test('QR inválido muestra mensaje sin romper el escáner', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'geolocation']);
    await page.addInitScript(mockFirebaseInitScript);
    await page.addInitScript(seedWorkersInitScript);
    await page.goto(`${BASE_URL}/field-scanner.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.FieldScanner.__testLogin());
    await page.evaluate(() => window.FieldScanner.__testSetDb(window.__e2eMockDb));
    await expect(page.locator('#campo-camera-status')).toHaveText(/Cámara activa/i, { timeout: 15000 });
    await page.evaluate(() => window.FieldScanner.simulateScan('texto-que-no-es-qr-valido'));
    await expect(page.locator('#campo-status-text')).toHaveText(/QR no reconocido/i, { timeout: 5000 });
    await expect.poll(async () => page.evaluate(() => {
      const v = document.querySelector('#campo-qr-reader video');
      return v ? v.videoWidth : 0;
    }), { timeout: 10000 }).toBeGreaterThan(0);
  });
});

test.describe('Cámara móvil emulada — ruta MobileQRScanner', () => {
  test('escáner móvil optimizado inicia y registra marcación', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'geolocation']);
    await page.addInitScript(mockFirebaseInitScript);
    await page.addInitScript(seedWorkersInitScript);
    await page.goto(`${BASE_URL}/field-scanner.html`, { waitUntil: 'domcontentloaded' });

    const ruta = await page.evaluate(() => ({
      esMovil: window.MobileCameraOptimizer.isMobile(),
      usaMovil: !!window.MobileQRScanner
    }));
    expect(ruta.esMovil).toBe(true);
    expect(ruta.usaMovil).toBe(true);

    await page.evaluate(() => window.FieldScanner.__testLogin());
    await page.evaluate(() => window.FieldScanner.__testSetDb(window.__e2eMockDb));
    await expect(page.locator('#campo-camera-status')).toHaveText(/Cámara móvil activa/i, { timeout: 15000 });
    await page.screenshot({ path: 'evidencia/campo-mobile-camera-activa.png', fullPage: true });
    await expect.poll(async () => page.evaluate(() => {
      const v = document.querySelector('#campo-qr-reader video');
      return v ? v.videoWidth : 0;
    }), { timeout: 10000 }).toBeGreaterThan(0);

    const worker = TRABAJADORES[2];
    await page.evaluate((payload) => window.FieldScanner.simulateScan(payload), JSON.stringify({ id: worker.ID_Trabajador }));
    await expect(page.locator('#campo-worker-name')).toHaveText(worker.Nombre_Completo);

    await page.locator('.campo-mark-btn[data-tipo="Entrada"]').click();
    await expect(page.locator('#campo-status-text')).toHaveText(/Marcación registrada/i, { timeout: 10000 });
    await expect(page.locator('#campo-feed-list')).toContainText(worker.Nombre_Completo);
    await page.screenshot({ path: 'evidencia/campo-mobile-marcacion-registrada.png', fullPage: true });
  });

  test('el escáner móvil decodifica el QR real de la cámara sin inyección (móvil emulada)', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'geolocation']);
    const worker = TRABAJADORES[1];
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ id: worker.ID_Trabajador, dpi: worker.DPI_CUI }), { width: 400, margin: 2 });
    await page.addInitScript(mockFirebaseInitScript);
    await page.addInitScript(seedWorkersInitScript);
    // Misma cámara con QR real, pero por la ruta móvil (MobileQRScanner).
    await page.addInitScript(scannerObserverInitScript);
    await page.addInitScript(fakeCanvasCameraInitScript, qrDataUrl);
    await page.goto(`${BASE_URL}/field-scanner.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.FieldScanner.__testLogin());
    await page.evaluate(() => window.FieldScanner.__testSetDb(window.__e2eMockDb));

    // Sin simulateScan: el trabajador sólo puede aparecer si MobileQRScanner
    // decodificó los fotogramas reales de la cámara.
    await expect(page.locator('#campo-worker-name')).toHaveText(worker.Nombre_Completo, { timeout: 30000 });

    const observed = await page.evaluate(() => (window as unknown as {
      __e2eObserved: { status: string[]; frames: number[][] };
    }).__e2eObserved);
    console.log('[QR E2E móvil] estados de cámara:', JSON.stringify(observed.status));
    console.log('[QR E2E móvil] fotogramas de cámara:', JSON.stringify(observed.frames));
    expect(observed.status.some((value) => /Cámara móvil activa/i.test(value))).toBe(true);
    expect(observed.frames.length).toBeGreaterThan(0);
    expect(observed.frames[0][0]).toBeGreaterThan(0);
    expect(observed.frames[0][1]).toBeGreaterThan(0);

    await page.screenshot({ path: 'evidencia/campo-mobile-qr-camera-live.png', fullPage: true });
  });
});

