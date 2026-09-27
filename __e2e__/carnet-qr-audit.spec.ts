/**
 * CONTROL PERSONAL CAMPO — Auditoría de integridad de carnés y QR
 *
 * Objetivo: demostrar, con evidencia comprobable, que el carné que la app
 * entrega al trabajador NO está corrupto ni incompleto y que su QR se puede
 * escanear por la app de campo.
 *
 * Cómo se valida (sin simular texto):
 *  1. Se abre el MODAL REAL del carné (`#modal-carne`) desde la tabla de
 *     Personal — el mismo camino que usa el usuario.
 *  2. Se extrae el <canvas> del QR y se DECODIFICA con el mismo motor que usa
 *     el escáner de campo (`Html5Qrcode.scanFileV2`). Si el texto decodificado
 *     no coincide carácter a carácter con el payload esperado, el QR está
 *     corrupto aunque "se vea bonito".
 *  3. Se analiza la MATRIZ del símbolo (finder patterns, timing pattern, módulo
 *     oscuro fijo, número de módulos 21+4k) para descartar un QR truncado.
 *  4. Se comprueba que el payload decodificado es interpretable por las tres
 *     rutas de escaneo del sistema (QRGenerator, CarnetValidator y
 *     field-scanner) y que localiza al trabajador correcto.
 *  5. Se descarga el PNG del carné (html2canvas) y se decodifica el QR dentro
 *     de la imagen final: el artefacto que el usuario guarda/imprime.
 *
 * Ejecutar: npx playwright test __e2e__/carnet-qr-audit.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:3801';

/** Trabajador "realista": ID con el formato que genera API (TRAB-<ts>-<rand>). */
const TRABAJADOR = {
  ID_Trabajador: 'TRAB-1789583331223-A3F9K',
  Nombre_Completo: 'María José Ramírez Sosa',
  Puesto: 'Albañil',
  DPI_CUI: '30158847100101',
  Estado: 'Activo',
  Fotografia_URL: '',
  Codigo_QR_Data: JSON.stringify({
    id: 'TRAB-1789583331223-A3F9K',
    dpi: '30158847100101',
    nombre: 'María José Ramírez Sosa',
  }),
};

/** Trabajador SIN DPI: caso legítimo (importaciones/legacy pueden no traerlo). */
const SIN_DPI = {
  ID_Trabajador: 'TRAB-1789583331224-B7Q2M',
  Nombre_Completo: 'Pedro Antonio Solís',
  Puesto: 'Soldador',
  DPI_CUI: '',
  Estado: 'Activo',
  Fotografia_URL: '',
  Codigo_QR_Data: JSON.stringify({ id: 'TRAB-1789583331224-B7Q2M', dpi: '', nombre: 'Pedro Antonio Solís' }),
};

type ReporteEstructura = {
  ok: boolean;
  error?: string;
  canvas?: { width: number; height: number };
  simbolo?: { ancho: number; alto: number };
  moduloPx?: number;
  moduloEntero?: number;
  modulos?: number;
  simboloRenderizado?: number;
  pixelesRecortados?: number;
  coincidenciaModulos?: number;
  versionQr?: number;
  proporcionOscura?: number;
  margenModulos?: number;
  findersOk?: number;
  timingOk?: boolean;
  moduloOscuroOk?: boolean;
  fondoContenedor?: string;
};

type ResultadoDecode = { ok: boolean; decodedText?: string; formato?: string; error?: string };

/** Inyecta el mock de Firebase y la caché de personal antes de cargar la app. */
function mockFirebaseInitScript() {
  function makeQuery() {
    return {
      where() { return makeQuery(); },
      limit() { return makeQuery(); },
      onSnapshot(cb: (snap: unknown) => void) { setTimeout(() => cb({ docs: [] }), 0); return () => {}; },
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
    runTransaction: async (fn: (tx: unknown) => unknown) => {
      await fn({ get: async () => ({ exists: false }), set() {} });
    },
  };
  const auth = {
    currentUser: null,
    onAuthStateChanged() {},
    signInWithEmailAndPassword: async () => ({ user: { email: 'sistemadecontrol090@gmail.com' } }),
    signOut: async () => {},
  };
  (window as unknown as { __FIREBASE_ENV__: unknown }).__FIREBASE_ENV__ = null;
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 14.63492, longitude: -90.50693, accuracy: 10 } }),
      watchPosition: () => 0,
      clearWatch: () => {},
    },
  });
  (window as unknown as { __e2eMockDb: unknown }).__e2eMockDb = db;
  const mock = { apps: [], initializeApp() { return {}; }, firestore() { return db; }, auth() { return auth; } };
  (window as unknown as { __firebaseMock: unknown }).__firebaseMock = mock;
  Object.defineProperty(window, 'firebase', { configurable: false, get: () => mock, set: () => {} });
}

// NOTA: addInitScript serializa la función SIN su closure, por eso los datos de
// los trabajadores van literales aquí dentro (no se pueden referenciar las
// constantes TRABAJADOR / SIN_DPI del módulo).
function seedWorkersInitScript() {
  // 'Activo' es obligatorio: el filtro de Personal viene en 'Activo' y sin el
  // campo los trabajadores no aparecen en la tabla.
  localStorage.setItem('cpc_personal_cache', JSON.stringify([
    {
      ID_Trabajador: 'TRAB-1789583331223-A3F9K',
      Nombre_Completo: 'María José Ramírez Sosa',
      Puesto: 'Albañil',
      DPI_CUI: '30158847100101',
      Estado: 'Activo',
      Fotografia_URL: '',
      Codigo_QR_Data: JSON.stringify({
        id: 'TRAB-1789583331223-A3F9K',
        dpi: '30158847100101',
        nombre: 'María José Ramírez Sosa',
      }),
    },
    {
      ID_Trabajador: 'TRAB-1789583331224-B7Q2M',
      Nombre_Completo: 'Pedro Antonio Solís',
      Puesto: 'Soldador',
      DPI_CUI: '',
      Estado: 'Activo',
      Fotografia_URL: '',
      Codigo_QR_Data: JSON.stringify({
        id: 'TRAB-1789583331224-B7Q2M',
        dpi: '',
        nombre: 'Pedro Antonio Solís',
      }),
    },
  ]));
}

/** Arranca la app en la página de Personal con la caché sembrada. */
async function boot(page: Page) {
  await page.addInitScript(mockFirebaseInitScript);
  await page.addInitScript(seedWorkersInitScript);
  await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#personal-tbody')).toBeVisible({ timeout: 20000 });
}

/** Abre el modal del carné del trabajador indicado, igual que el usuario. */
async function abrirCarne(page: Page, workerId: string) {
  const row = page.locator(`tr[data-id="${workerId}"]`).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  const btn = row.locator('[data-action="qr"]');
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.click({ force: true });
  await expect(page.locator('#modal-carne')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#carne-print-area')).toBeVisible();
  // El QR se dibuja en un requestAnimationFrame posterior a la apertura del modal.
  await expect.poll(
    async () => page.locator('#carne-qr-container canvas').count(),
    { timeout: 10000 },
  ).toBeGreaterThan(0);
  await page.waitForTimeout(300);
}

/** Data URL del QR dibujado en el carné abierto. */
async function dataUrlQrDelCarne(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#carne-qr-container canvas') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('El carné no tiene <canvas> de QR (¿QR no generado?)');
    return canvas.toDataURL('image/png');
  });
}

/**
 * Decodifica una imagen PNG con el MISMO motor del escáner de campo
 * (Html5Qrcode.scanFileV2). Devuelve el texto realmente grabado en el QR.
 */
async function decodificarPng(page: Page, dataUrl: string): Promise<ResultadoDecode> {
  return page.evaluate(async (url: string) => {
    const host = document.createElement('div');
    host.id = 'e2e-carnet-decode';
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:400px;';
    document.body.appendChild(host);
    try {
      const bin = atob(url.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'carnet-qr.png', { type: 'image/png' });
      const scanner = new Html5Qrcode('e2e-carnet-decode');
      const result = await scanner.scanFileV2(file, false);
      return {
        ok: true,
        decodedText: result.decodedText,
        formato: (result.result as any)?.format?.formatName,
      } as { ok: boolean; decodedText: string; formato?: string };
    } catch (err) {
      return { ok: false, error: String((err as Error)?.message || err) };
    } finally {
      host.remove();
    }
  }, dataUrl);
}

/**
 * Analiza la matriz del símbolo QR del carné a nivel de píxel: tamaño de
 * módulo, número de módulos (debe ser 21 + 4k), los tres finder patterns, el
 * timing pattern, el módulo oscuro fijo y la proporción de píxeles oscuros.
 * Detecta un QR truncado o en blanco aunque el canvas tenga "píxeles".
 */
async function analizarMatrizQr(page: Page, payload: string): Promise<ReporteEstructura> {
  return page.evaluate((texto: string) => {
    const canvas = document.querySelector('#carne-qr-container canvas') as HTMLCanvasElement | null;
    if (!canvas) return { ok: false, error: 'sin canvas de QR' };

    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: 'sin contexto 2d' };
    const px = ctx.getImageData(0, 0, W, H).data;

    const esOscuro = (x: number, y: number): boolean => {
      const i = (y * W + x) * 4;
      const alpha = px[i + 3];
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      return alpha > 128 && lum < 128;
    };

    // ── Caja del símbolo (ignora el margen claro alrededor) ────────────────
    let minX = W, minY = H, maxX = -1, maxY = -1, oscuros = 0;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (esOscuro(x, y)) {
          oscuros += 1;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { ok: false, error: 'canvas totalmente claro (QR en blanco)' };

    const anchoSimbolo = maxX - minX + 1;

    // ── Fuente de verdad: se vuelve a codificar el MISMO payload con las
    //    MISMAS opciones para obtener el número de módulos y la matriz de
    //    módulos esperada. Después se compara esa matriz con los píxeles del
    //    canvas del carné: si no coinciden, el QR renderizado está corrupto,
    //    cortado o incompleto. ─────────────────────────────────────────────
    const referencia = document.createElement('div');
    referencia.style.cssText = 'position:absolute;left:-9999px;top:0;';
    document.body.appendChild(referencia);

    let modulos = 0;
    const matriz: boolean[][] = [];
    try {
      const modelo = new QRCode(referencia, {
        text: texto,
        width: 130,
        height: 130,
        colorDark: '#003459',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M,
      });
      const nucleo = (modelo as any)._oQRCode;
      modulos = nucleo.getModuleCount();
      for (let r = 0; r < modulos; r += 1) {
        const fila: boolean[] = [];
        for (let c = 0; c < modulos; c += 1) fila.push(nucleo.isDark(r, c) === true);
        matriz.push(fila);
      }
    } catch (err) {
      return { ok: false, error: 'no se pudo codificar el modelo de referencia: ' + String((err as Error)?.message || err) };
    } finally {
      referencia.remove();
    }
    if (!modulos) return { ok: false, error: 'el modelo de referencia no tiene módulos' };

    // qrcodejs redondea el tamaño de módulo hacia arriba: el símbolo dibujado
    // puede exceder el canvas y recortarse en el borde inferior/derecho.
    const moduloEntero = Math.round(W / modulos);
    const simboloRenderizado = modulos * moduloEntero;
    const pixelesRecortados = Math.max(0, simboloRenderizado - W);
    const m = W / modulos;

    // Muestreo del canvas en el centro de cada módulo esperado.
    const centro = (mx: number, my: number): boolean =>
      esOscuro(
        Math.min(W - 1, Math.max(0, Math.floor((mx + 0.5) * m))),
        Math.min(H - 1, Math.max(0, Math.floor((my + 0.5) * m))),
      );

    let coincidencias = 0;
    for (let r = 0; r < modulos; r += 1) {
      for (let c = 0; c < modulos; c += 1) {
        if (centro(c, r) === matriz[r][c]) coincidencias += 1;
      }
    }
    const coincidenciaModulos = Number((coincidencias / (modulos * modulos)).toFixed(4));

    // ── Finder patterns (7x7: borde oscuro, anillo claro, núcleo 3x3 oscuro) ─
    const finderEn = (col0: number, fila0: number): number => {
      let aciertos = 0;
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < 7; c += 1) {
          const borde = r === 0 || r === 6 || c === 0 || c === 6;
          const anillo = !borde && (r === 1 || r === 5 || c === 1 || c === 5);
          const esperado = !anillo;
          if (centro(col0 + c, fila0 + r) === esperado) aciertos += 1;
        }
      }
      return aciertos / 49;
    };
    const puntajes = [finderEn(0, 0), finderEn(modulos - 7, 0), finderEn(0, modulos - 7)];
    const findersOk = puntajes.filter((p) => p >= 0.95).length;

    // ── Timing pattern: fila/columna de módulo 6 alterna oscuro en índice par ─
    const inicio = 8;
    const fin = modulos - 9;
    let timingAciertos = 0;
    let timingTotal = 0;
    for (let i = inicio; i <= fin; i += 1) {
      const esperado = i % 2 === 0;
      if (centro(i, 6) === esperado) timingAciertos += 1;
      if (centro(6, i) === esperado) timingAciertos += 1;
      timingTotal += 2;
    }
    const timingOk = timingTotal > 0 && timingAciertos / timingTotal >= 0.9;

    // ── Módulo oscuro fijo: fila (módulos - 8), columna 8, siempre oscuro ────
    const moduloOscuroOk = centro(8, modulos - 8) === true;

    const contenedor = document.getElementById('carne-qr-container');

    return {
      ok: true,
      canvas: { width: W, height: H },
      simbolo: { ancho: anchoSimbolo, alto: maxY - minY + 1 },
      moduloPx: Number(m.toFixed(3)),
      moduloEntero,
      modulos,
      simboloRenderizado,
      pixelesRecortados,
      coincidenciaModulos,
      versionQr: (modulos - 17) / 4,
      proporcionOscura: Number((oscuros / (W * H)).toFixed(4)),
      margenModulos: Number((minX / m).toFixed(2)),
      findersOk,
      timingOk,
      moduloOscuroOk,
      fondoContenedor: contenedor ? getComputedStyle(contenedor).backgroundColor : 'n/a',
    };
  }, payload);
}

/**
 * Ejecuta el payload decodificado por las TRES rutas de escaneo del sistema:
 *  - QRGenerator.parseQRData + buscarTrabajadorPorQR (asistencia.js / campo.js)
 *  - CarnetValidator.validateQR (módulo de validación de carnés)
 *  - reglas de field-scanner (JSON con id, o texto [A-Z0-9-]{5+})
 * Devuelve qué ruta lo acepta y a qué trabajador resuelve.
 */
async function interpretarPayload(page: Page, decodedText: string, personal: unknown[]) {
  return page.evaluate(
    ({ texto, lista }: { texto: string; lista: unknown[] }) => {
      const w = window as any;

      let viaQrGenerator: unknown = null;
      let errorQrGenerator: string | null = null;
      try {
        const parsed = w.QRGenerator?.parseQRData(texto);
        viaQrGenerator = parsed
          ? { parsed, encontrado: w.QRGenerator.buscarTrabajadorPorQR(parsed)?.ID_Trabajador || null }
          : null;
      } catch (err) {
        errorQrGenerator = String((err as Error)?.message || err);
      }

      let viaValidator: unknown = null;
      let errorValidator: string | null = null;
      try {
        const r = w.CarnetValidator?.validateQR(texto, lista);
        viaValidator = r
          ? { valid: r.valid, trabajador: r.worker?.ID_Trabajador || null, errores: r.errors, avisos: r.warnings }
          : null;
      } catch (err) {
        errorValidator = String((err as Error)?.message || err);
      }

      // Réplica exacta de la lógica de _parseQRData() en field-scanner.js
      let viaFieldScanner: any = null;
      try {
        let dato: any = null;
        try {
          const json = JSON.parse(texto);
          if (json && json.id) dato = json;
        } catch (_) { /* no es JSON */ }
        if (!dato && /^[A-Z0-9-]+$/.test(texto) && texto.length >= 5) dato = { id: texto };
        viaFieldScanner = dato;
      } catch (err) {
        viaFieldScanner = { error: String((err as Error)?.message || err) };
      }

      return { viaQrGenerator, errorQrGenerator, viaValidator, errorValidator, viaFieldScanner };
    },
    { texto: decodedText, lista: personal },
  );
}

test.describe('Auditoría de integridad — carnés y QR', () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test('el carné del modal está completo y su QR decodifica el payload exacto', async ({ page }) => {
    await abrirCarne(page, TRABAJADOR.ID_Trabajador);

    // ── 1. Datos del carné: nada vacío ni con placeholders ────────────────
    await expect(page.locator('#carne-nombre')).toHaveText(TRABAJADOR.Nombre_Completo);
    await expect(page.locator('#carne-puesto')).toHaveText(TRABAJADOR.Puesto);
    await expect(page.locator('#carne-id')).toHaveText(TRABAJADOR.ID_Trabajador);
    await expect(page.locator('#carne-dpi')).toContainText(TRABAJADOR.DPI_CUI);
    const iniciales = ((await page.locator('#carne-foto-iniciales').textContent()) || '').trim();
    expect(iniciales.length).toBeGreaterThan(0);
    expect(iniciales).not.toBe('??');

    // ── 2. Decodificación REAL del QR del carné ───────────────────────────
    const dataUrl = await dataUrlQrDelCarne(page);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const decodificado = await decodificarPng(page, dataUrl);
    expect(decodificado.ok, `no se pudo decodificar el QR: ${decodificado.error}`).toBe(true);
    expect(decodificado.formato).toBe('QR_CODE');

    const payloadEsperado = JSON.stringify({ id: TRABAJADOR.ID_Trabajador, dpi: TRABAJADOR.DPI_CUI });
    expect(decodificado.decodedText).toBe(payloadEsperado);

    console.log('[auditoría carné] payload del QR:', decodificado.decodedText);
    console.log('[auditoría carné] longitud del payload:', payloadEsperado.length, 'caracteres');

    await page.screenshot({ path: '__e2e__/screenshots/carnet-audit-completo.png', fullPage: false });
  });

  test('la matriz del QR del carné es un símbolo QR válido (no truncado ni en blanco)', async ({ page }) => {
    await abrirCarne(page, TRABAJADOR.ID_Trabajador);

    const reporte = await analizarMatrizQr(page, JSON.stringify({ id: TRABAJADOR.ID_Trabajador, dpi: TRABAJADOR.DPI_CUI }));
    console.log('[auditoría carné] matriz del QR:', JSON.stringify(reporte));

    expect(reporte.ok, `análisis falló: ${reporte.error}`).toBe(true);
    // Canvas cuadrado y con un número ENTERO de píxeles por módulo: si no,
    // qrcodejs recorta la última columna/fila y esos módulos quedan a medias.
    expect(reporte.canvas!.width).toBe(reporte.canvas!.height);
    expect(reporte.canvas!.width % reporte.modulos!).toBe(0);
    expect(reporte.pixelesRecortados).toBe(0);
    expect(reporte.canvas!.width).toBeGreaterThanOrEqual(130);
    // El símbolo debe ser cuadrado: un QR cortado deja lados distintos.
    expect(Math.abs((reporte.simbolo?.ancho || 0) - (reporte.simbolo?.alto || 0))).toBeLessThanOrEqual(2);
    // Un QR real tiene 21 + 4k módulos.
    expect(reporte.modulos! >= 21).toBe(true);
    expect((reporte.modulos! - 21) % 4).toBe(0);
    expect(reporte.moduloPx!).toBeGreaterThanOrEqual(3); // módulos legibles al escanear
    // El canvas debe reproducir fielmente la matriz de módulos del modelo:
    // ≥99 % de coincidencia ⇒ el QR renderizado no está corrupto ni cortado.
    expect(reporte.coincidenciaModulos!).toBeGreaterThanOrEqual(0.99);
    // Los tres finder patterns, el timing pattern y el módulo oscuro fijo.
    expect(reporte.findersOk).toBe(3);
    expect(reporte.timingOk).toBe(true);
    expect(reporte.moduloOscuroOk).toBe(true);
    // Densidad sana: ni vacío ni una mancha negra.
    expect(reporte.proporcionOscura!).toBeGreaterThan(0.15);
    expect(reporte.proporcionOscura!).toBeLessThan(0.6);
    console.log(
      `[auditoría carné] ${reporte.modulos} módulos · ${reporte.moduloPx}px/módulo · ` +
      `símbolo dibujado ${reporte.simboloRenderizado}px en canvas de ${reporte.canvas?.width}px ` +
      `(píxeles recortados: ${reporte.pixelesRecortados}) · coincidencia con el modelo: ` +
      `${(reporte.coincidenciaModulos! * 100).toFixed(2)}% · fondo del contenedor: ${reporte.fondoContenedor}`,
    );
  });

  test('el payload del carné resuelve al trabajador correcto en las rutas de escaneo', async ({ page }) => {
    // El módulo de validación no lo carga index.html (solo el harness de prueba),
    // así que se inyecta para auditar su contrato contra el QR real del carné.
    await page.addScriptTag({ path: 'js/utils/carnet-validator.js' });
    expect(await page.evaluate(() => typeof (window as any).CarnetValidator)).toBe('object');

    await abrirCarne(page, TRABAJADOR.ID_Trabajador);
    const decodificado = await decodificarPng(page, await dataUrlQrDelCarne(page));
    expect(decodificado.ok, `no se pudo decodificar: ${decodificado.error}`).toBe(true);

    const personal = await page.evaluate(() => (window as any).AppState.get('personal'));
    const rutas: any = await interpretarPayload(page, decodificado.decodedText!, personal);
    console.log('[auditoría carné] rutas de escaneo:', JSON.stringify(rutas));

    // Ruta 1: app principal (asistencia.js / campo.js)
    expect(rutas.errorQrGenerator).toBeNull();
    expect(rutas.viaQrGenerator).not.toBeNull();
    expect(rutas.viaQrGenerator.parsed).toEqual({ id: TRABAJADOR.ID_Trabajador, dpi: TRABAJADOR.DPI_CUI });
    expect(rutas.viaQrGenerator.encontrado).toBe(TRABAJADOR.ID_Trabajador);

    // Ruta 2: módulo de validación de carnés
    expect(rutas.errorValidator).toBeNull();
    expect(rutas.viaValidator.valid).toBe(true);
    expect(rutas.viaValidator.trabajador).toBe(TRABAJADOR.ID_Trabajador);
    expect(rutas.viaValidator.errores).toEqual([]);

    // Ruta 3: escáner de campo (field-scanner.html)
    expect(rutas.viaFieldScanner).toEqual({ id: TRABAJADOR.ID_Trabajador, dpi: TRABAJADOR.DPI_CUI });
  });

  test('un trabajador sin DPI sigue siendo escaneable (el ID por sí solo basta)', async ({ page }) => {
    await abrirCarne(page, SIN_DPI.ID_Trabajador);

    const decodificado = await decodificarPng(page, await dataUrlQrDelCarne(page));
    expect(decodificado.ok, `no se pudo decodificar: ${decodificado.error}`).toBe(true);
    expect(decodificado.decodedText).toBe(JSON.stringify({ id: SIN_DPI.ID_Trabajador, dpi: '' }));

    const personal = await page.evaluate(() => (window as any).AppState.get('personal'));
    const rutas: any = await interpretarPayload(page, decodificado.decodedText!, personal);
    console.log('[auditoría carné] sin DPI → rutas:', JSON.stringify(rutas));

    expect(
      rutas.viaQrGenerator,
      'QRGenerator.parseQRData rechazó el QR de un carné sin DPI: el trabajador no podría marcar asistencia',
    ).not.toBeNull();
    expect(rutas.viaQrGenerator.encontrado).toBe(SIN_DPI.ID_Trabajador);
    expect(rutas.viaFieldScanner).toEqual({ id: SIN_DPI.ID_Trabajador, dpi: '' });
  });

  test('el PNG descargado del carné conserva el QR y los datos completos', async ({ page }) => {
    await abrirCarne(page, TRABAJADOR.ID_Trabajador);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      page.locator('#btn-descargar-carne-png').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^carne-.+\.png$/);

    const ruta = await download.path();
    expect(ruta).toBeTruthy();
    const buffer = fs.readFileSync(ruta!);
    // Firma PNG: el archivo no está corrupto ni vacío.
    expect(buffer.subarray(0, 4).toString('hex')).toBe('89504e47');
    expect(buffer.length).toBeGreaterThan(10000);
    // Se conserva el artefacto para inspección manual (evidencia de auditoría).
    fs.writeFileSync('__e2e__/screenshots/carnet-audit-descargado.png', buffer);
    console.log(`[auditoría carné] PNG descargado: ${download.suggestedFilename()} (${buffer.length} bytes)`);

    const decodificado = await decodificarPng(page, `data:image/png;base64,${buffer.toString('base64')}`);
    console.log('[auditoría carné] QR dentro del PNG descargado:', JSON.stringify(decodificado));
    expect(
      decodificado.ok,
      `el PNG del carné no contiene un QR decodificable: ${decodificado.error}`,
    ).toBe(true);
    expect(decodificado.decodedText).toBe(JSON.stringify({ id: TRABAJADOR.ID_Trabajador, dpi: TRABAJADOR.DPI_CUI }));
  });
});

