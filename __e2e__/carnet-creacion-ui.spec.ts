/**
 * CONTROL PERSONAL CAMPO — E2E: alta de trabajadores por la UI y validación
 * visual COMPLETA del carné y de su código QR.
 *
 * Qué se demuestra (nada se simula a mano):
 *  1. Los trabajadores se registran con el FORMULARIO REAL de la app
 *     (`#btn-nuevo-personal` → campos `#p-*` → `#btn-guardar-personal`) y se
 *     comprueba que aparecen en la tabla y en `AppState.personal`.
 *  2. El carné se abre con el mismo botón que usa el operador
 *     (`[data-action="qr"]` de la fila) y se verifican TODOS sus datos.
 *  3. El QR se decodifica con el MISMO motor del escáner de campo
 *     (`Html5Qrcode.scanFileV2`) desde tres artefactos independientes:
 *       a) el <canvas> que se ve en pantalla,
 *       b) una CAPTURA de pantalla del carné (lo que "vería" una cámara),
 *       c) el PNG que el usuario descarga e imprime.
 *  4. Se analiza la MATRIZ del símbolo (nº de módulos, finder/timing patterns,
 *     píxeles recortados, coincidencia con el modelo) y el CONTRASTE real
 *     módulo/fondo medido píxel a píxel.
 *  5. Se repite en TEMA OSCURO y TEMA CLARO (cambiando el tema con el botón
 *     real del topbar) porque el fondo del panel del QR depende del tema.
 *
 * Ejecutar: npx playwright test __e2e__/carnet-creacion-ui.spec.ts --reporter=line
 */

import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import zlib from 'node:zlib';

const BASE_URL = 'http://127.0.0.1:3801';
/** Carpeta de evidencias visuales de esta suite. */
const SHOTS = '__e2e__/screenshots/carnet-ui';

// ─────────────────────────────────────────────────────────────────────────────
// PNG mínimo generado en memoria (sin dependencias) para la foto del trabajador
// ─────────────────────────────────────────────────────────────────────────────
const TABLA_CRC = (() => {
  const tabla = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c;
  }
  return tabla;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunkPng(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** PNG RGB sólido válido (para probar la ruta "trabajador con foto"). */
function crearPng(ancho: number, alto: number, rgb: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;   // profundidad de bits
  ihdr[9] = 2;   // color type: RGB
  const filas: Buffer[] = [];
  for (let y = 0; y < alto; y += 1) {
    const fila = Buffer.alloc(1 + ancho * 3);
    for (let x = 0; x < ancho; x += 1) {
      fila[1 + x * 3] = rgb[0];
      fila[2 + x * 3] = rgb[1];
      fila[3 + x * 3] = rgb[2];
    }
    filas.push(fila);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkPng('IHDR', ihdr),
    chunkPng('IDAT', zlib.deflateSync(Buffer.concat(filas))),
    chunkPng('IEND', Buffer.alloc(0)),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos y utilidades
// ─────────────────────────────────────────────────────────────────────────────
type TrabajadorUI = {
  nombre: string;
  dpi: string;
  puesto: string;
  jefe?: string;
  telefono?: string;
  whatsapp?: string;
  direccion?: string;
};

type TrabajadorGuardado = TrabajadorUI & { ID_Trabajador: string };

type ResultadoDecode = { ok: boolean; decodedText?: string; formato?: string; error?: string };

type ReporteMatriz = {
  ok: boolean;
  error?: string;
  canvas?: { width: number; height: number };
  simbolo?: { ancho: number; alto: number };
  moduloPx?: number;
  modulos?: number;
  pixelesRecortados?: number;
  coincidenciaModulos?: number;
  proporcionOscura?: number;
  findersOk?: number;
  timingOk?: boolean;
  moduloOscuroOk?: boolean;
  fondoContenedor?: string;
};

const slug = (texto: string): string =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Fuerza la creación de la carpeta de evidencias. */
function prepararEvidencias(): void {
  fs.mkdirSync(SHOTS, { recursive: true });
}


// ─────────────────────────────────────────────────────────────────────────────
// Arranque determinista: Firebase simulado (sin red) + tema elegido
// ─────────────────────────────────────────────────────────────────────────────
// addInitScript serializa la función SIN su closure: todo lo que use debe ser
// literal aquí dentro.
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
    currentUser: null,           // sin sesión ⇒ guardado local honesto, sin nube
    onAuthStateChanged() {},
    signInWithEmailAndPassword: async () => ({ user: { email: 'e2e@local.test' } }),
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
  const mock = { apps: [], initializeApp() { return {}; }, firestore() { return db; }, auth() { return auth; } };
  (window as unknown as { __firebaseMock: unknown }).__firebaseMock = mock;
  Object.defineProperty(window, 'firebase', { configurable: false, get: () => mock, set: () => {} });
}

/** Arranca la app en Personal con el tema indicado. */
async function boot(page: Page, tema: 'dark' | 'light' = 'dark'): Promise<void> {
  await page.addInitScript(mockFirebaseInitScript);
  await page.addInitScript((t: string) => { localStorage.setItem('cpc_theme', t); }, tema);
  await page.goto(`${BASE_URL}/index.html#personal`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash-screen', { state: 'hidden', timeout: 20000 }).catch(() => {});
  await expect(page.locator('#personal-tbody')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', tema);
  await page.waitForTimeout(500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Alta de trabajador por la UI real
// ─────────────────────────────────────────────────────────────────────────────
async function crearTrabajador(page: Page, datos: TrabajadorUI, foto?: Buffer): Promise<TrabajadorGuardado> {
  await page.locator('#btn-nuevo-personal').click();
  await expect(page.locator('#modal-personal')).toBeVisible({ timeout: 10000 });

  await page.fill('#p-nombre', datos.nombre);
  await page.fill('#p-dpi', datos.dpi);
  await page.selectOption('#p-puesto', datos.puesto);
  if (datos.jefe) await page.fill('#p-jefe', datos.jefe);
  if (datos.telefono) await page.fill('#p-telefono', datos.telefono);
  if (datos.whatsapp) await page.fill('#p-whatsapp', datos.whatsapp);
  if (datos.direccion) await page.fill('#p-direccion', datos.direccion);

  if (foto) {
    await page.setInputFiles('#foto-input', {
      name: 'foto-trabajador.png', mimeType: 'image/png', buffer: foto,
    });
    // La app comprime la imagen y muestra la vista previa.
    await expect(page.locator('#foto-preview')).toBeVisible({ timeout: 10000 });
  }

  await page.screenshot({ path: `${SHOTS}/formulario-${slug(datos.nombre)}.png` });

  await page.locator('#btn-guardar-personal').click();
  // Sin sesión Firebase el guardado es local: el modal se cierra y hay toast.
  await expect(page.locator('#modal-personal')).toBeHidden({ timeout: 15000 });
  // Ojo: Alerts.loading deja su propio toast ("Registrando trabajador...") que se
  // cierra después; hay que esperar al toast de CONFIRMACIÓN, no leer el primero.
  const confirmacion = page
    .locator('#toast-container .toast')
    .filter({ hasText: /registrado|guardado|actualizado/i })
    .first();
  await expect(
    confirmacion,
    `el alta de "${datos.nombre}" no mostró confirmación`,
  ).toBeVisible({ timeout: 15000 });
  console.log(`[carné UI] alta confirmada: "${((await confirmacion.textContent()) || '').trim()}"`);

  const guardado = await page.evaluate((nombre: string) => {
    const personal = (window as any).AppState.get('personal') || [];
    const w = personal.find((p: any) => p.Nombre_Completo === nombre);
    return w ? (JSON.parse(JSON.stringify(w)) as any) : null;
  }, datos.nombre);

  expect(guardado, `"${datos.nombre}" no quedó registrado en AppState.personal`).not.toBeNull();
  expect(guardado!.Estado).toBe('Activo');

  // La fila del trabajador recién creado debe estar visible en la tabla.
  const fila = page.locator(`#personal-tbody tr[data-id="${guardado!.ID_Trabajador}"]`);
  await expect(fila).toBeVisible({ timeout: 10000 });
  await expect(fila).toContainText(datos.dpi);
  await expect(fila).toContainText(datos.puesto);

  return { ...datos, ID_Trabajador: guardado!.ID_Trabajador };
}

// ─────────────────────────────────────────────────────────────────────────────
// Carné: apertura y lectura de sus datos
// ─────────────────────────────────────────────────────────────────────────────
/** Abre el carné del trabajador con el botón QR de su fila (flujo del operador). */
async function abrirCarne(page: Page, id: string): Promise<void> {
  const fila = page.locator(`#personal-tbody tr[data-id="${id}"]`).first();
  await expect(fila).toBeVisible({ timeout: 10000 });
  const boton = fila.locator('[data-action="qr"]');
  await boton.scrollIntoViewIfNeeded().catch(() => {});
  await boton.click({ force: true });
  await expect(page.locator('#modal-carne')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#carne-print-area')).toBeVisible();
  // El QR se dibuja en el requestAnimationFrame siguiente a la apertura.
  await expect.poll(
    async () => page.locator('#carne-qr-container canvas').count(),
    { timeout: 10000 },
  ).toBeGreaterThan(0);
  await page.waitForTimeout(300);
}

/** Cierra el modal del carné. */
async function cerrarCarne(page: Page): Promise<void> {
  await page.locator('#modal-carne .modal-close').first().click({ force: true }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await expect(page.locator('#modal-carne')).toBeHidden({ timeout: 5000 });
  await page.waitForTimeout(250);
}

/** Texto y estado visual de cada dato del carné. */
async function datosCarne(page: Page) {
  return page.evaluate(() => {
    const texto = (id: string) => (document.getElementById(id)?.textContent || '').trim();
    const foto = document.getElementById('carne-foto') as HTMLImageElement | null;
    const placeholder = document.getElementById('carne-foto-placeholder');
    const iniciales = document.getElementById('carne-foto-iniciales');
    const carne = document.getElementById('carne-print-area');
    return {
      nombre: texto('carne-nombre'),
      puesto: texto('carne-puesto'),
      id: texto('carne-id'),
      dpi: texto('carne-dpi'),
      empresa: texto('carne-empresa-nombre'),
      obra: texto('carne-obra-nombre'),
      footer: (carne?.querySelector('.carne-footer p')?.textContent || '').trim(),
      fotoVisible: !!foto && !foto.hidden && (foto.getAttribute('src') || '').startsWith('data:image'),
      placeholderVisible: !!placeholder && !placeholder.hidden,
      iniciales: (iniciales?.textContent || '').trim(),
      anchoCarne: carne ? Math.round(carne.getBoundingClientRect().width) : 0,
    };
  });
}

/** Nodos que "pintan" el QR dentro del carné: debe haber EXACTAMENTE uno. */
async function nodosQr(page: Page) {
  return page.evaluate(() => {
    const cont = document.getElementById('carne-qr-container');
    const canvas = cont?.querySelector('canvas') as HTMLCanvasElement | null;
    const estilo = canvas ? getComputedStyle(canvas) : null;
    return {
      canvas: cont ? cont.querySelectorAll('canvas').length : 0,
      img: cont ? cont.querySelectorAll('img').length : 0,
      anchoAtributo: canvas ? canvas.width : 0,
      altoAtributo: canvas ? canvas.height : 0,
      anchoCss: estilo ? estilo.width : '',
      altoCss: estilo ? estilo.height : '',
      display: estilo ? estilo.display : '',
      radiusCss: estilo ? estilo.borderRadius : '',
      fondoContenedor: cont ? getComputedStyle(cont).backgroundColor : '',
    };
  });
}

/**
 * Decodifica una imagen PNG con el MISMO motor del escáner de campo
 * (`Html5Qrcode.scanFileV2`). Devuelve el texto realmente grabado en el QR.
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

/** Data URL del QR dibujado en el carné abierto. */
async function dataUrlQrDelCarne(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#carne-qr-container canvas') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('El carné no tiene <canvas> de QR (¿QR no generado?)');
    return canvas.toDataURL('image/png');
  });
}

/**
 * Mide el contraste REAL del QR: luminancia media de los píxeles oscuros
 * (módulos) frente a la de los claros, más el fondo del contenedor. Un QR
 * "oscuro sobre oscuro" se ve en pantalla pero ninguna cámara lo lee.
 */
async function medirContrasteQr(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#carne-qr-container canvas') as HTMLCanvasElement | null;
    if (!canvas) return { ok: false as const, error: 'sin canvas' };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false as const, error: 'sin contexto 2d' };
    const W = canvas.width;
    const H = canvas.height;
    const px = ctx.getImageData(0, 0, W, H).data;
    let sumaOscuros = 0, nOscuros = 0, sumaClaros = 0, nClaros = 0;
    for (let i = 0; i < px.length; i += 4) {
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (l < 128) { sumaOscuros += l; nOscuros += 1; } else { sumaClaros += l; nClaros += 1; }
    }
    const prom = (suma: number, n: number) => (n ? suma / n : 0);
    const oscuros = prom(sumaOscuros, nOscuros);
    const claros = prom(sumaClaros, nClaros);
    const rel = (l: number) => {
      const c = l / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const ratio = (rel(claros) + 0.05) / (rel(oscuros) + 0.05);
    const cont = document.getElementById('carne-qr-container');
    return {
      ok: true as const,
      luminanciaOscuros: Number(oscuros.toFixed(1)),
      luminanciaClaros: Number(claros.toFixed(1)),
      ratioContraste: Number(ratio.toFixed(2)),
      pixelesOscuros: nOscuros,
      pixelesClaros: nClaros,
      fondoContenedor: cont ? getComputedStyle(cont).backgroundColor : '',
    };
  });
}

/**
 * Analiza la matriz del símbolo QR del carné a nivel de píxel: tamaño de
 * módulo, nº de módulos (21 + 4k), los tres finder patterns, el timing
 * pattern, el módulo oscuro fijo y la coincidencia con el modelo re-codificado.
 * Detecta un QR truncado o en blanco aunque el canvas "tenga píxeles".
 */
async function analizarMatrizQr(page: Page, payload: string): Promise<ReporteMatriz> {
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
      return px[i + 3] > 128 && (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) < 128;
    };

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

    // Referencia: se re-codifica el MISMO payload con las MISMAS opciones para
    // obtener la matriz de módulos esperada y compararla con los píxeles.
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

    const moduloEntero = Math.round(W / modulos);
    const simboloRenderizado = modulos * moduloEntero;
    const pixelesRecortados = Math.max(0, simboloRenderizado - W);
    const m = W / modulos;

    const centro = (mx: number, my: number): boolean =>
      esOscuro(
        Math.min(W - 1, Math.max(0, Math.floor((mx + 0.5) * m))),
        Math.min(H - 1, Math.max(0, Math.floor((my + 0.5) * m))),
      );

    let coincidencias = 0;
    for (let r = 0; r < modulos; r += 1) {
      for (let c = 0; c < modulos; c += 1) if (centro(c, r) === matriz[r][c]) coincidencias += 1;
    }
    const coincidenciaModulos = Number((coincidencias / (modulos * modulos)).toFixed(4));

    const finderEn = (col0: number, fila0: number): number => {
      let aciertos = 0;
      for (let r = 0; r < 7; r += 1) {
        for (let c = 0; c < 7; c += 1) {
          const borde = r === 0 || r === 6 || c === 0 || c === 6;
          const anillo = !borde && (r === 1 || r === 5 || c === 1 || c === 5);
          if (centro(col0 + c, fila0 + r) === !anillo) aciertos += 1;
        }
      }
      return aciertos / 49;
    };
    const puntajes = [finderEn(0, 0), finderEn(modulos - 7, 0), finderEn(0, modulos - 7)];
    const findersOk = puntajes.filter((p) => p >= 0.95).length;

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

    const contenedor = document.getElementById('carne-qr-container');
    return {
      ok: true,
      canvas: { width: W, height: H },
      simbolo: { ancho: maxX - minX + 1, alto: maxY - minY + 1 },
      moduloPx: Number(m.toFixed(3)),
      modulos,
      pixelesRecortados,
      coincidenciaModulos,
      proporcionOscura: Number((oscuros / (W * H)).toFixed(4)),
      findersOk,
      timingOk: timingTotal > 0 && timingAciertos / timingTotal >= 0.9,
      moduloOscuroOk: centro(8, modulos - 8) === true,
      fondoContenedor: contenedor ? getComputedStyle(contenedor).backgroundColor : 'n/a',
    };
  }, payload);
}

/**
 * Ejecuta el payload decodificado por las rutas de escaneo del sistema:
 *  - QRGenerator.parseQRData + buscarTrabajadorPorQR (asistencia.js / campo.js)
 *  - reglas de field-scanner (JSON con id)
 * Devuelve a qué trabajador resuelve cada una.
 */
async function interpretarPayload(page: Page, decodedText: string, personal: unknown[]) {
  return page.evaluate(
    ({ texto, lista }: { texto: string; lista: unknown[] }) => {
      const w = window as any;
      let viaQrGenerator: any = null;
      let errorQrGenerator: string | null = null;
      try {
        const parsed = w.QRGenerator?.parseQRData(texto);
        viaQrGenerator = parsed
          ? { parsed, encontrado: w.QRGenerator.buscarTrabajadorPorQR(parsed)?.ID_Trabajador || null }
          : null;
      } catch (err) {
        errorQrGenerator = String((err as Error)?.message || err);
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

      return { viaQrGenerator, errorQrGenerator, viaFieldScanner, lista: lista.length };
    },
    { texto: decodedText, lista: personal },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación completa de un carné abierto
// ─────────────────────────────────────────────────────────────────────────────
async function validarCarneCompleto(
  page: Page,
  trabajador: TrabajadorGuardado,
  etiqueta: string,
  opciones: { conFoto?: boolean; capturar?: boolean } = {},
): Promise<void> {
  const payloadEsperado = JSON.stringify({ id: trabajador.ID_Trabajador, dpi: trabajador.dpi });

  // ── 1. Datos impresos en el carné ───────────────────────────────────────
  const datos = await datosCarne(page);
  expect(datos.nombre).toBe(trabajador.nombre);
  expect(datos.puesto).toBe(trabajador.puesto);
  expect(datos.id).toBe(trabajador.ID_Trabajador);
  expect(datos.dpi).toBe(trabajador.dpi);
  expect(datos.empresa.length, 'el carné no muestra el nombre de la empresa').toBeGreaterThan(3);
  expect(datos.obra.length, 'el carné no muestra la obra').toBeGreaterThan(2);
  expect(datos.footer.toLowerCase()).toContain('portación obligatoria');
  expect(datos.anchoCarne, 'el carné debe medir ~320px (menos en pantallas pequeñas)').toBeGreaterThanOrEqual(240);

  if (opciones.conFoto) {
    expect(datos.fotoVisible, 'el carné debe mostrar la fotografía del trabajador').toBe(true);
  } else {
    expect(datos.placeholderVisible, 'sin foto debe verse el marcador con iniciales').toBe(true);
    expect(datos.iniciales, `iniciales inesperadas: "${datos.iniciales}"`).toMatch(/^[A-ZÁÉÍÓÚÑ]{1,3}$/);
  }

  // ── 2. Un único QR, 1:1 y sin esquinas recortadas ───────────────────────
  const nodos = await nodosQr(page);
  expect(nodos.canvas, 'el carné debe tener UN solo QR (canvas)').toBe(1);
  expect(nodos.img, 'la <img> de respaldo de qrcodejs no debe quedar (dibujaba un 2º QR)').toBe(0);
  expect(nodos.display).toBe('block');
  expect(nodos.anchoAtributo).toBe(nodos.altoAtributo);
  expect(nodos.anchoAtributo).toBeGreaterThanOrEqual(130);
  expect(parseFloat(nodos.anchoCss), 'el QR no debe reescalarse (1px real = 1px CSS)').toBe(nodos.anchoAtributo);
  expect(nodos.radiusCss, 'las esquinas redondeadas recortarían módulos del QR').toBe('0px');

  // ── 3. Contraste real módulos/fondo ─────────────────────────────────────
  const contraste = await medirContrasteQr(page);
  expect(contraste.ok, `no se pudo medir el contraste del QR: ${(contraste as { error?: string }).error}`).toBe(true);
  const ratio = (contraste as { ratioContraste?: number }).ratioContraste || 0;
  console.log(
    `[carné UI] ${etiqueta} · contraste ${ratio}:1 · fondo ${nodos.fondoContenedor}`,
  );
  expect(
    ratio,
    `el QR es ilegible para una cámara: contraste ${ratio}:1 (fondo ${nodos.fondoContenedor})`,
  ).toBeGreaterThanOrEqual(7);

  // ── 4. Decodificación del canvas con el motor del escáner de campo ──────
  const decCanvas = await decodificarPng(page, await dataUrlQrDelCarne(page));
  expect(decCanvas.ok, `el QR del canvas no decodifica: ${decCanvas.error}`).toBe(true);
  expect(decCanvas.decodedText).toBe(payloadEsperado);
  expect(decCanvas.formato).toBe('QR_CODE');

  // ── 5. Matriz del símbolo (no truncado, no en blanco, sin módulos cortados)
  const matriz = await analizarMatrizQr(page, payloadEsperado);
  expect(matriz.ok, `análisis de matriz falló: ${matriz.error}`).toBe(true);
  expect(matriz.canvas!.width).toBe(matriz.canvas!.height);
  expect(matriz.canvas!.width % matriz.modulos!).toBe(0);
  expect(matriz.pixelesRecortados).toBe(0);
  expect((matriz.modulos! - 21) % 4).toBe(0);
  expect(matriz.moduloPx!).toBeGreaterThanOrEqual(3);
  expect(matriz.coincidenciaModulos!).toBeGreaterThanOrEqual(0.99);
  expect(matriz.findersOk).toBe(3);
  expect(matriz.timingOk).toBe(true);
  expect(matriz.moduloOscuroOk).toBe(true);
  expect(matriz.proporcionOscura!).toBeGreaterThan(0.15);
  expect(matriz.proporcionOscura!).toBeLessThan(0.6);
  console.log(
    `[carné UI] ${etiqueta} · ${matriz.modulos} módulos · ${matriz.moduloPx}px/módulo · ` +
    `coincidencia ${(matriz.coincidenciaModulos! * 100).toFixed(2)}% · recortados ${matriz.pixelesRecortados}px`,
  );

  // ── 6. Captura visual del carné (lo que "vería" una cámara) ─────────────
  const captura = await page.locator('#carne-print-area').screenshot();
  fs.writeFileSync(`${SHOTS}/carne-${etiqueta}.png`, captura);
  const decCaptura = await decodificarPng(page, `data:image/png;base64,${captura.toString('base64')}`);
  expect(decCaptura.ok, `el QR no se lee de la captura visual del carné: ${decCaptura.error}`).toBe(true);
  expect(decCaptura.decodedText).toBe(payloadEsperado);

  if (opciones.capturar !== false) {
    await page.screenshot({ path: `${SHOTS}/modal-carne-${etiqueta}.png` });
  }
}

/** Descarga el PNG del carné (artefacto real del usuario) y lo decodifica. */
async function validarPngDescargado(
  page: Page,
  trabajador: TrabajadorGuardado,
  etiqueta: string,
): Promise<void> {
  const payloadEsperado = JSON.stringify({ id: trabajador.ID_Trabajador, dpi: trabajador.dpi });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.locator('#btn-descargar-carne-png').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^carne-.+\.png$/);
  const ruta = await download.path();
  expect(ruta).toBeTruthy();
  const buffer = fs.readFileSync(ruta!);
  expect(buffer.subarray(0, 4).toString('hex'), 'el PNG descargado no es un PNG válido').toBe('89504e47');
  expect(buffer.length).toBeGreaterThan(10000);
  fs.writeFileSync(`${SHOTS}/carne-descargado-${etiqueta}.png`, buffer);
  console.log(`[carné UI] ${etiqueta} · PNG descargado: ${download.suggestedFilename()} (${buffer.length} bytes)`);

  const dec = await decodificarPng(page, `data:image/png;base64,${buffer.toString('base64')}`);
  expect(dec.ok, `el QR del PNG descargado no decodifica: ${dec.error}`).toBe(true);
  expect(dec.decodedText).toBe(payloadEsperado);
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE PRUEBA
// ─────────────────────────────────────────────────────────────────────────────
const ANA: TrabajadorUI = {
  nombre: 'Andrea Sofía López Méndez',
  dpi: '2481375901025',
  puesto: 'Albañil',
  jefe: 'Ing. Roberto Salazar',
  telefono: '55551234',
  whatsapp: '55551234',
  direccion: 'Guatemala, Villa Nueva',
};

const JOSE: TrabajadorUI = {
  nombre: 'José Ángel Peña Núñez',
  dpi: '3015884710011',
  puesto: 'Maestro de Obra',
  jefe: 'Ing. Roberto Salazar',
  direccion: 'Escuintla, Puerto San José',
};

const TERCERO: TrabajadorUI = {
  nombre: 'Luis Fernando Martínez Ortiz',
  dpi: '1994567810233',
  puesto: 'Soldador',
  telefono: '44443333',
  direccion: 'Mixco, Guatemala',
};

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Alta de trabajadores por la UI → carné y QR correctos', () => {
  test.beforeAll(() => prepararEvidencias());

  test('registra un trabajador con foto y su carné + QR son válidos en canvas, captura y PNG', async ({ page }) => {
    test.setTimeout(120000);
    await boot(page);

    const trabajador = await crearTrabajador(page, ANA, crearPng(8, 8, [200, 60, 60]));
    await expect(page.locator('#personal-count')).toContainText('1 trabajador');

    await abrirCarne(page, trabajador.ID_Trabajador);
    await validarCarneCompleto(page, trabajador, 'con-foto', { conFoto: true });

    // El payload decodificado debe localizar al trabajador por las rutas de escaneo.
    const decodificado = await decodificarPng(page, await dataUrlQrDelCarne(page));
    const personal = await page.evaluate(() => (window as any).AppState.get('personal'));
    const rutas = await interpretarPayload(page, decodificado.decodedText!, personal);
    expect(rutas.errorQrGenerator).toBeNull();
    expect(rutas.viaQrGenerator.parsed).toEqual({ id: trabajador.ID_Trabajador, dpi: trabajador.dpi });
    expect(rutas.viaQrGenerator.encontrado).toBe(trabajador.ID_Trabajador);
    expect(rutas.viaFieldScanner).toEqual({ id: trabajador.ID_Trabajador, dpi: trabajador.dpi });

    await validarPngDescargado(page, trabajador, 'con-foto');
  });

  test('un segundo trabajador (sin foto, nombre con acentos) mantiene el carné correcto', async ({ page }) => {
    test.setTimeout(120000);
    await boot(page);

    const trabajador = await crearTrabajador(page, JOSE);
    await abrirCarne(page, trabajador.ID_Trabajador);
    await validarCarneCompleto(page, trabajador, 'sin-foto');
    await validarPngDescargado(page, trabajador, 'sin-foto');
  });
});

test.describe('Tres trabajadores creados por la UI generan tres carnés únicos', () => {
  test.beforeAll(() => prepararEvidencias());

  test('cada carné tiene su propio QR decodificable y coincide con su trabajador', async ({ page }) => {
    test.setTimeout(240000);
    await boot(page);

    const creados: TrabajadorGuardado[] = [];
    for (const datos of [ANA, JOSE, TERCERO]) {
      creados.push(await crearTrabajador(page, datos));
    }
    await expect(page.locator('#personal-count')).toContainText('3 trabajadores');
    await page.screenshot({ path: `${SHOTS}/tabla-tres-trabajadores.png`, fullPage: true });

    const payloads = new Set<string>();
    for (const trabajador of creados) {
      await abrirCarne(page, trabajador.ID_Trabajador);
      const etiqueta = slug(trabajador.nombre);
      await validarCarneCompleto(page, trabajador, etiqueta, { capturar: false });
      const dec = await decodificarPng(page, await dataUrlQrDelCarne(page));
      payloads.add(dec.decodedText!);
      await cerrarCarne(page);
    }

    // Tres carnés ⇒ tres payloads distintos (nadie comparte el QR de otro).
    expect(payloads.size, 'los tres carnés devolvieron el mismo payload de QR').toBe(3);
    console.log('[carné UI] payloads únicos:', JSON.stringify([...payloads]));
  });
});

test.describe('Tema claro y oscuro', () => {
  test.beforeAll(() => prepararEvidencias());

  test('el carné y su QR siguen legibles al pasar a tema claro y al volver a oscuro', async ({ page }) => {
    test.setTimeout(180000);
    await boot(page, 'dark');

    const trabajador = await crearTrabajador(page, TERCERO);

    await abrirCarne(page, trabajador.ID_Trabajador);
    await validarCarneCompleto(page, trabajador, 'tema-oscuro');
    await cerrarCarne(page);

    // Cambio de tema con el botón real del topbar (no inyectando el atributo).
    await page.locator('#theme-toggle').click({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await abrirCarne(page, trabajador.ID_Trabajador);
    await validarCarneCompleto(page, trabajador, 'tema-claro');
    await cerrarCarne(page);

    await page.locator('#theme-toggle').click({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

/** Secciones de la SPA (router por hash + sidebar). */
const PAGINAS = ['dashboard', 'personal', 'asistencia', 'campo', 'reportes', 'ajustes'];

test.describe('Análisis de toda la UI', () => {
  test.beforeAll(() => prepararEvidencias());

  test('las 6 secciones renderizan sin errores JS ni desbordes horizontales en móvil', async ({ page }) => {
    test.setTimeout(240000);

    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const texto = msg.text();
      // Ruido esperado sin red ni sesión: Firebase no configurado y recursos externos.
      if (/firebase|firestore|Failed to load resource|net::|ERR_|favicon/i.test(texto)) return;
      errores.push(`console: ${texto}`);
    });

    await boot(page);
    const trabajador = await crearTrabajador(page, ANA);

    const resumen: Record<string, { titulo: string; desborde: number; activo: boolean }> = {};
    for (const pagina of PAGINAS) {
      await page.evaluate((p: string) => { window.location.hash = `#${p}`; }, pagina);
      await expect(page.locator(`#page-${pagina}`)).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(700);
      resumen[pagina] = await page.evaluate((p: string) => ({
        titulo: (document.getElementById('page-title')?.textContent || '').trim(),
        desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        activo: !!document.querySelector(`.sidebar-nav .nav-link[data-page="${p}"].active`),
      }), pagina);
      await page.screenshot({ path: `${SHOTS}/ui-${pagina}.png`, fullPage: true });
    }
    console.log('[carné UI] resumen de UI:', JSON.stringify(resumen));

    for (const pagina of PAGINAS) {
      expect(resumen[pagina].titulo.length, `la sección ${pagina} no actualizó el título`).toBeGreaterThan(2);
      expect(resumen[pagina].activo, `el enlace de ${pagina} no quedó activo en el sidebar`).toBe(true);
      expect(
        resumen[pagina].desborde,
        `la sección ${pagina} desborda horizontalmente en móvil`,
      ).toBeLessThanOrEqual(2);
    }

    // Con el carné abierto desde la tabla tampoco debe haber desborde.
    await abrirCarne(page, trabajador.ID_Trabajador);
    const caja = await page.locator('#carne-print-area').boundingBox();
    expect(caja!.width, 'el carné no cabe en un móvil de 390px').toBeLessThanOrEqual(390);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      'el modal del carné provoca scroll horizontal',
    ).toBeLessThanOrEqual(2);

    expect(errores, `errores JS durante el recorrido de la UI:\n${errores.join('\n')}`).toEqual([]);
  });
});

test.describe('Escritorio (1366×768)', () => {
  test.use({ viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  test.beforeAll(() => prepararEvidencias());

  test('la navegación por clics del sidebar y el carné funcionan en escritorio', async ({ page }) => {
    test.setTimeout(240000);
    await boot(page);
    const trabajador = await crearTrabajador(page, JOSE);

    for (const pagina of ['dashboard', 'asistencia', 'reportes', 'ajustes', 'personal']) {
      const link = page.locator(`.sidebar-nav .nav-link[data-page="${pagina}"]`);
      await link.click({ force: true });
      await expect(page.locator(`#page-${pagina}`)).toBeVisible({ timeout: 15000 });
      await expect(link).toHaveClass(/active/, { timeout: 5000 });
    }
    await page.screenshot({ path: `${SHOTS}/ui-escritorio-personal.png`, fullPage: false });

    await abrirCarne(page, trabajador.ID_Trabajador);
    await validarCarneCompleto(page, trabajador, 'escritorio');
    const modal = await page.locator('#modal-carne .modal-carne').boundingBox();
    expect(modal!.width).toBeLessThanOrEqual(1366);
  });
});

test.describe('Pantalla estrecha (320×568)', () => {
  test.use({ viewport: { width: 320, height: 568 } });
  test.beforeAll(() => prepararEvidencias());

  test('el carné cabe en pantalla y su QR sigue decodificando', async ({ page }) => {
    test.setTimeout(180000);
    await boot(page);
    const trabajador = await crearTrabajador(page, TERCERO);
    await abrirCarne(page, trabajador.ID_Trabajador);
    await validarCarneCompleto(page, trabajador, 'estrecho');
    const caja = await page.locator('#carne-print-area').boundingBox();
    expect(caja!.width, 'el carné desborda una pantalla de 320px').toBeLessThanOrEqual(320);
  });
});
