/** Runner por fases QA — CONTROL PERSONAL CAMPO. Uso: node _qa_phase.mjs <fase> */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  BASE, ROOT, report, section, check, warn, info, shot, gotoPage,
  startServer, openApp, saveState, emitResults, scanOverflow, scanTextClip,
} from './_qa_lib.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = path.join(__dir, 'screenshots', 'qa_full');
const RESULTS = path.join(__dir, 'results');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const TRABAJADORES = [
  { nombre: 'Roberto Estuardo Lima Cifuentes', dpi: '2512345678901', puesto: 'Maestro de Obra', jefe: 'Ing. Ana López', telefono: '55123456', whatsapp: '55123456', direccion: 'Guatemala, Zona 10' },
  { nombre: 'Luisa Fernanda Reyes Ajú',        dpi: '1823456789012', puesto: 'Residente',       jefe: 'Ing. Ana López', telefono: '44987654', whatsapp: '44987654', direccion: 'Mixco, Guatemala' },
  { nombre: 'Martín Alejandro Chávez Pac',     dpi: '3045678901234', puesto: 'Albañil',         jefe: 'Roberto Lima',   telefono: '55678901', whatsapp: '',         direccion: 'Villa Nueva, Guatemala' },
];

let browser = null;
let page = null;

async function navegarA(sec) { await gotoPage(page, sec, 550); }

/** Clic programático (element.click) — evita el auto-wait de Playwright que hace
 *  timeout con los botones de acción (quirk de renderizado de esta app). */
async function qclick(selector) {
  await page.locator(selector).evaluate((el) => el.click());
}
async function qclickLoc(loc) {
  await loc.evaluate((el) => el.click());
}

async function registrarTrabajador(t) {
  await qclick('#btn-nuevo-personal');
  await page.waitForFunction(() => {
    const m = document.getElementById('modal-personal');
    return m && !m.hidden;
  }, { timeout: 6000 });
  await page.waitForTimeout(250);
  await page.fill('#p-nombre', t.nombre);
  await page.fill('#p-dpi', t.dpi);
  await page.selectOption('#p-puesto', t.puesto);
  if (t.jefe) await page.fill('#p-jefe', t.jefe);
  if (t.telefono) await page.fill('#p-telefono', t.telefono);
  if (t.whatsapp) await page.fill('#p-whatsapp', t.whatsapp);
  if (t.direccion) await page.fill('#p-direccion', t.direccion);
  await qclick('#btn-guardar-personal');
  await page.waitForFunction(() => {
    const m = document.getElementById('modal-personal');
    return m && m.hidden;
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(250);
  return await page.evaluate(() => document.getElementById('modal-personal').hidden);
}

/** Ejecuta una fase con servidor+navegador y emite resultados. */
async function run(phase, fn, opts = {}) {
  section('FASE — ' + phase);
  const server = await startServer();
  browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  let err = null;
  try {
    const { page: p } = await openApp(browser, { seed: opts.seed, viewport: opts.viewport });
    page = p;
    await fn();
    if (opts.saveState) { const n = await saveState(page); info('estado guardado (' + n + ' claves localStorage)'); }
  } catch (e) {
    err = e;
    console.log('  [FASE-ERROR] ' + (e.message || e).split('\n')[0]);
    warn('Excepción en fase: ' + (e.message || e).split('\n')[0]);
  } finally {
    try { await browser.close(); } catch {}
    try { server.close(); } catch {}
    emitResults(phase, RESULTS);
  }
  if (err) process.exit(2);
}

// ── Fase 1: Carga y navegación ───────────────────────────────────────────────
async function fase1_loadnav() {
  const errs = [];
  page.on('pageerror', (e) => { if (!/qrcode|html5-qrcode|Script error/.test(e.message)) errs.push('JS:' + e.message); });
  const currentPage = await page.evaluate(() => AppState.get('currentPage'));
  check(currentPage === 'dashboard', 'Página inicial = dashboard (obtenido "' + currentPage + '")');
  const fichas = {
    dashboard:['.kpi-grid','#calendar-grid'],
    personal:['#btn-nuevo-personal','#personal-tbody'],
    asistencia:['#btn-start-scan','#asistencia-tbody'],
    reportes:['#btn-pdf-diario'],
    ajustes:['#gas-url','#btn-test-connection'],
  };
  for (const [sec, sels] of Object.entries(fichas)) {
    await navegarA(sec);
    const activo = await page.evaluate((s) => {
      const el = document.getElementById('page-' + s);
      return el && el.classList.contains('active') && !el.hasAttribute('hidden');
    }, sec);
    check(activo, 'Módulo "' + sec + '" se activa correctamente');
    let ok = 0;
    for (const sel of sels) if (await page.locator(sel).count() > 0) ok++;
    check(ok === sels.length, 'Claves de "' + sec + '" presentes (' + ok + '/' + sels.length + ')');
    shot(page, SHOT_DIR, '01-nav-' + sec + '.png');
  }
  check(errs.length === 0, 'Sin errores de consola JS en navegación' + (errs.length ? ' -> ' + errs.slice(0,3).join(' | ') : ''));
}

// ── Fase 2: Crear trabajadores (una alta por fase para respetar límite 30s) ──
async function fase2_createOne(t) {
  await navegarA('personal');
  const cerrado = await registrarTrabajador(t);
  check(cerrado, 'Alta de "' + t.nombre + '" — modal se cierra tras Guardar');
}
async function fase2_integrity() {
  await navegarA('personal');
  await page.waitForTimeout(600);
  const total = await page.evaluate(() => (AppState.get('personal') || []).length);
  check(total === 3, 'AppState contiene ' + total + ' trabajadores (esperado: 3)');
  const rows = await page.locator('#personal-tbody tr:not(.empty-row)').count();
  check(rows === 3, 'La tabla de personal renderiza ' + rows + ' fila(s)');
  const puestos = await page.evaluate(() => (AppState.get('personal') || []).map((p) => p.Puesto));
  const dpis = await page.evaluate(() => (AppState.get('personal') || []).map((p) => p.DPI_CUI));
  for (let i = 0; i < 3; i++) {
    check(puestos[i] === TRABAJADORES[i].puesto, 'Integridad Puesto[' + i + ']="' + puestos[i] + '"');
    check(dpis[i] === TRABAJADORES[i].dpi, 'Integridad DPI[' + i + ']="' + dpis[i] + '"');
  }
  await navegarA('personal');
  shot(page, SHOT_DIR, '02-personal-3-trabajadores.png');
}

// ── Fase 3: Validación, búsqueda/filtros, edición ────────────────────────────
async function fase3_validate_read_edit() {
  await navegarA('personal');
  // Validación negativa
  await qclick('#btn-nuevo-personal');
  await page.waitForFunction(() => {
    const m = document.getElementById('modal-personal');
    return m && !m.hidden;
  }, { timeout: 6000 });
  await page.waitForTimeout(250);
  await page.fill('#p-nombre', 'AB');
  await page.fill('#p-dpi', '123456789012');
  await page.selectOption('#p-puesto', 'Albañil');
  await qclick('#btn-guardar-personal');
  await page.waitForTimeout(500);
  const dpiErr = await page.evaluate(() => {
    const el = document.getElementById('p-dpi-error');
    return el && !el.hidden;
  });
  check(dpiErr, 'Error inline mostrado para DPI de 12 dígitos');
  const quedAbierto = await page.evaluate(() => {
    const m = document.getElementById('modal-personal');
    return m && !m.hidden;
  });
  check(quedAbierto, 'El modal NO se cierra con datos inválidos (bloqueo)');
  await qclick('#modal-personal .modal-close');
  await page.waitForTimeout(250);

  // Búsqueda y filtros
  await page.fill('#personal-search', 'Roberto');
  await page.waitForTimeout(600);
  const resBus = await page.locator('#personal-tbody tr:not(.empty-row)').count();
  check(resBus >= 1, 'Búsqueda "Roberto" devuelve ' + resBus + ' resultado(s)');
  await page.fill('#personal-search', '');
  await page.selectOption('#filter-puesto', 'Albañil');
  await page.waitForTimeout(600);
  const resFiltro = await page.locator('#personal-tbody tr:not(.empty-row)').count();
  check(resFiltro === 1, 'Filtro Albañil muestra ' + resFiltro + ' resultado(s) (esperado: 1)');
  await page.selectOption('#filter-puesto', '');
  await page.waitForTimeout(300);

  // Edición (fila de Roberto Estuardo — primera coincidencia)
  await qclickLoc(page.locator('#personal-tbody tr', { hasText: 'Roberto Estuardo' }).locator('.table-action-btn.edit').first());
  await page.waitForFunction(() => {
    const m = document.getElementById('modal-personal');
    return m && !m.hidden;
  }, { timeout: 6000 });
  await page.waitForTimeout(350);
  const titulo = await page.evaluate(() => document.getElementById('modal-personal-title')?.textContent?.trim());
  check(titulo === 'Editar Trabajador', 'Título del modal en edición: "' + titulo + '"');
  const preNombre = await page.evaluate(() => document.getElementById('p-nombre')?.value?.trim());
  check(preNombre === TRABAJADORES[0].nombre, 'Datos precargados en edición');
  await page.fill('#p-jefe', 'Ing. Roberto Fuentes');
  await qclick('#btn-guardar-personal');
  await page.waitForFunction(() => {
    const m = document.getElementById('modal-personal');
    return m && m.hidden;
  }, { timeout: 8000 }).catch(() => {});
  const editOk = await page.evaluate(() => (AppState.get('personal') || [])[0]?.Jefe_Inmediato === 'Ing. Roberto Fuentes');
  check(editOk, 'La edición persiste el nuevo Jefe Inmediato en AppState');
}

// ── Fase 4: Baja, cámara, foto y carné ───────────────────────────────────────
async function fase4_cud_camera_carne() {
  await navegarA('personal');
  // Baja (Delete)
  const antes = await page.evaluate(() => (AppState.get('personal') || []).length);
  const dels = page.locator('#personal-tbody .table-action-btn.delete');
  const nDels = await dels.count();
  if (nDels > 0) {
    await qclickLoc(dels.nth(nDels - 1));
    await page.waitForTimeout(500);
    const confirmVisible = await page.evaluate(() => {
      const m = document.getElementById('modal-confirm');
      return m && !m.hidden;
    });
    if (confirmVisible) { await qclick('#btn-confirm-ok'); await page.waitForTimeout(700); }
  }
  const despues = await page.evaluate(() => (AppState.get('personal') || []).length);
  // La baja es LÓGICA: cambia Estado a 'Inactivo' sin remover el registro.
  const estadoObj = await page.evaluate(() => {
    const lista = AppState.get('personal') || [];
    const t = lista.find((p) => p.Nombre_Completo === 'Martín Alejandro Chávez Pac');
    return { total: lista.length, estado: t ? t.Estado : null };
  });
  check(estadoObj.total === antes && estadoObj.estado === 'Inactivo',
    'Baja lógica exitosa: registro conservado (' + antes + ') y Estado="Inactivo" (obtenido: ' + estadoObj.estado + ')');

  // Subida de foto (galería)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAI0lEQVR4AdzKMQ0AAAwCwQZ5VVd7VQMOYOeT3w57Tzcm1AEEAAD//yOnY6YAAAAGSURBVAMA2pQVoZP1V9UAAAAASUVORK5CYII=', 'base64');
  await qclick('#btn-nuevo-personal');
  await page.waitForFunction(() => {
    const m = document.getElementById('modal-personal');
    return m && !m.hidden;
  }, { timeout: 6000 });
  await page.waitForTimeout(250);
  const inputFoto = page.locator('#foto-input');
  if (await inputFoto.count() > 0) {
    await inputFoto.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => {
      const el = document.getElementById('foto-preview');
      return el && (el.src || '').startsWith('data:');
    }, { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);
    const preview = await page.evaluate(() => {
      const el = document.getElementById('foto-preview');
      return el ? (el.src || '').slice(0, 30) : '';
    });
    check(preview.startsWith('data:'), 'Vista previa de foto cargada (src=' + preview + '...)');
    shot(page, SHOT_DIR, '03-foto-preview.png');
  } else { warn('No se encontró #foto-input para probar la subida'); }
  await qclick('#modal-personal .modal-close');
  await page.waitForTimeout(250);

  // Modal de cámara
  await qclick('#btn-nuevo-personal');
  await page.waitForFunction(() => {
    const m = document.getElementById('modal-personal');
    return m && !m.hidden;
  }, { timeout: 6000 });
  await page.waitForTimeout(250);
  const btnTomar = page.locator('#btn-tomar-foto');
  if (await btnTomar.count() > 0) {
    await qclickLoc(btnTomar.first());
    await page.waitForFunction(() => {
      const m = document.getElementById('modal-camera');
      return m && !m.hidden;
    }, { timeout: 6000 });
    await page.waitForTimeout(900);
    const estado = await page.evaluate(() => ({
      status: document.getElementById('camera-status-label')?.textContent?.trim(),
      errorVisible: !document.getElementById('camera-error-msg')?.hidden,
      errorText: document.getElementById('camera-error-text')?.textContent?.trim(),
      streamActivo: !!(document.getElementById('camera-video')?.srcObject),
      soporta: typeof navigator.mediaDevices !== 'undefined' && !!navigator.mediaDevices.getUserMedia,
    }));
    info('Cámara: ' + JSON.stringify(estado));
    check(estado.soporta, 'API getUserMedia disponible (contexto con cámara fake)');
    check(estado.streamActivo && !estado.errorVisible,
      'Stream de cámara activo sin errores (estado: "' + estado.status + '")');
    if (estado.streamActivo) {
      // Capturar foto y confirmar vista previa
      await qclick('#btn-capturar-foto');
      await page.waitForFunction(() => !document.getElementById('camera-preview-section')?.hidden, { timeout: 6000 }).catch(() => {});
      const capturada = await page.evaluate(() => ({
        preview: (document.getElementById('camera-captured-img')?.src || '').startsWith('data:'),
        footerPreviewVisible: !document.getElementById('camera-footer-preview')?.hidden,
      }));
      check(capturada.preview && capturada.footerPreviewVisible, 'Captura de foto genera imagen (dataURL) y muestra vista previa');
      shot(page, SHOT_DIR, '04b-camara-captura.png');
    }
    shot(page, SHOT_DIR, '04-camara-modal.png');
    await qclick('#btn-camera-close');
    await page.waitForTimeout(300);
  } else { warn('No se encontró #btn-tomar-foto'); }
  const camCerrada = await page.evaluate(() => document.getElementById('modal-camera').hidden);
  check(camCerrada, 'El modal de cámara se cierra correctamente');
  await qclick('#modal-personal .modal-close');
  await page.waitForTimeout(200);

  // Carné QR
  const qrBtn = page.locator('#personal-tbody .table-action-btn.qr');
  if (await qrBtn.count() > 0) {
    await qrBtn.first().click();
    await page.waitForFunction(() => {
      const m = document.getElementById('modal-carne');
      return m && !m.hidden;
    }, { timeout: 6000 });
    await page.waitForTimeout(1400);
    const carne = await page.evaluate(() => ({
      nombre: document.getElementById('carne-nombre')?.textContent?.trim(),
      tieneQR: (() => {
        const c = document.getElementById('carne-qr-container');
        return c && (c.querySelector('canvas') || c.querySelector('img') || c.querySelector('svg'));
      })(),
    }));
    check(carne.nombre === TRABAJADORES[0].nombre, 'Carné muestra nombre: "' + carne.nombre + '"');
    check(!!carne.tieneQR, 'Carné genera código QR (canvas/img/svg)');
    const carneOverflow = await page.evaluate(() => {
      const m = document.getElementById('modal-carne');
      if (!m) return [];
      const vw = document.documentElement.clientWidth;
      const items = [];
      [...m.querySelectorAll('*')].forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 4) items.push(el.id || el.className);
      });
      return items.slice(0, 8);
    });
    check(!(carneOverflow.length), 'Carné sin desbordes horizontales (' + carneOverflow.length + ')');
    shot(page, SHOT_DIR, '05-carne-qr.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else { warn('No hay .qr button para probar carné'); }
}
// ── Fase 5: Asistencia, Reportes, Ajustes ────────────────────────────────────
async function fase5_asistencia_reportes_ajustes() {
  await navegarA('asistencia');
  await qclick('[data-tab="manual"]');
  await page.waitForTimeout(350);
  await page.fill('#manual-worker-search', 'Roberto');
  await page.waitForTimeout(850);
  const items = await page.locator('.autocomplete-item').count();
  if (items > 0) {
    await qclickLoc(page.locator('.autocomplete-item').first());
    await page.waitForTimeout(350);
    const nombre = await page.evaluate(() => document.getElementById('manual-worker-name')?.textContent?.trim());
    check(nombre.includes('Roberto'), 'Autocomplete de asistencia selecciona trabajador ("' + nombre + '")');
    await qclickLoc(page.locator('.btn-marcacion[data-tipo="Entrada"]').first());
    await page.waitForTimeout(1100);
    const filas = await page.locator('#asistencia-tbody tr:not(.empty-row)').count();
    check(filas >= 1, 'Se registra la marcación (' + filas + ' fila(s) en la tabla del día)');
    const marcaciones = await page.evaluate(() => AppState.get('asistencias') || []);
    check(Array.isArray(marcaciones) && marcaciones.length >= 1, 'La marcación persiste en AppState (' + (Array.isArray(marcaciones) ? marcaciones.length : 0) + ' registro(s))');
    shot(page, SHOT_DIR, '06-asistencia-marcada.png');
  } else { warn('No se mostraron resultados en el autocomplete de asistencia'); }
  await qclick('[data-tab="qr-scanner"]');
  await page.waitForTimeout(350);
  check(await page.locator('#btn-start-scan').count() > 0, 'Tab QR expone el botón Iniciar Cámara (escáner)');

  await navegarA('reportes');
  const btnPreview = page.locator('#btn-preview-diario');
  if (await btnPreview.count() > 0) {
    await btnPreview.click();
    await page.waitForTimeout(1800);
    const preview = await page.evaluate(() => {
      const card = document.getElementById('reporte-preview-card');
      const content = document.getElementById('reporte-preview-content');
      return card && !card.hidden && content && content.childElementCount > 0;
    });
    check(preview, 'Vista previa del reporte diario se genera');
    shot(page, SHOT_DIR, '07-reporte-preview.png');
  } else { warn('Botón #btn-preview-diario no encontrado'); }

  await navegarA('ajustes');
  const gasUrl = page.locator('#gas-url');
  if (await gasUrl.count() > 0) {
    await gasUrl.fill('https://script.google.com/macros/s/AKfyc_TEST/dep.js/exec');
    const guardar = page.locator('#btn-save-url');
    if (await guardar.count() > 0) await qclickLoc(guardar.first());
    await page.waitForTimeout(700);
    const stored = await page.evaluate(() => localStorage.getItem('cpc_gas_url'));
    check(stored !== null, 'La URL de GAS se persiste en localStorage');
  } else { warn('No se encontró #gas-url en Ajustes'); }
  check(await page.locator('#btn-test-connection').count() > 0, 'Ajustes expone "Probar conexión"');
  shot(page, SHOT_DIR, '08-ajustes.png');
}
// ── Fase 6: Responsive (UI/UX) ───────────────────────────────────────────────
const MODULOS = ['dashboard', 'personal', 'asistencia', 'reportes', 'ajustes'];

async function fase6_responsive(viewports) {
  for (const [w, h, etiqueta] of viewports) {
    await page.setViewportSize({ width: w, height: h });
    let overflowEnModulo = [];
    for (const mod of MODULOS) {
      await navegarA(mod);
      await page.waitForTimeout(350);
      const of = await scanOverflow(page);
      if (of.bodyHScroll) overflowEnModulo.push(mod + '.scrollY(horizontal)');
      for (const el of of.elements) overflowEnModulo.push(mod + ': ' + el.sel + ' (der=' + el.right + 'px > ' + el.vw + 'px)');
    }
    if (overflowEnModulo.length === 0) check(true, '[' + etiqueta + ' ' + w + 'x' + h + '] sin desbordes horizontales en 5 módulos');
    else {
      check(false, '[' + etiqueta + ' ' + w + 'x' + h + '] con desbordes horizontales');
      for (const it of overflowEnModulo.slice(0, 6)) warn('  · ' + it);
    }
    await navegarA('dashboard'); shot(page, SHOT_DIR, 'resp-' + etiqueta + '-dashboard.png');
    await navegarA('personal');  shot(page, SHOT_DIR, 'resp-' + etiqueta + '-personal.png');
    await navegarA('asistencia'); shot(page, SHOT_DIR, 'resp-' + etiqueta + '-asistencia.png');

    if (w <= 1024) {
      const toggle = page.locator('#menu-toggle, #sidebar-toggle, #btn-menu');
      if (await toggle.count() > 0) {
        await qclickLoc(toggle.first());
        await page.waitForTimeout(450);
        const abierto = await page.evaluate(() => document.body.classList.contains('sidebar-open') || !!document.querySelector('.glass-sidebar.open'));
        check(abierto, '[' + etiqueta + '] El menú hamburguesa abre el sidebar (overlay)');
        shot(page, SHOT_DIR, 'resp-' + etiqueta + '-sidebar.png');
        await qclickLoc(toggle.first());
        await page.waitForTimeout(250);
      } else { warn('[' + etiqueta + '] No se halló toggle de menú'); }
    }
  }
}

// ── Despacho de fases ────────────────────────────────────────────────────────
const FASE = process.argv[2] || '';
const dispatch = {
  p1: () => run('p1_loadnav', fase1_loadnav),
  p2a: () => run('p2_create_1', () => fase2_createOne(TRABAJADORES[0]), { saveState: true }),
  p2b: () => run('p2_create_2', () => fase2_createOne(TRABAJADORES[1]), { seed: true, saveState: true }),
  p2c: () => run('p2_create_3', () => fase2_createOne(TRABAJADORES[2]), { seed: true, saveState: true }),
  p2d: () => run('p2_integrity', fase2_integrity, { seed: true }),
  p3: () => run('p3_validate', fase3_validate_read_edit, { seed: true }),
  p4: () => run('p4_camera', fase4_cud_camera_carne, { seed: true }),
  p5: () => run('p5_asi', fase5_asistencia_reportes_ajustes, { seed: true }),
  p6a: () => run('p6_responsive_a', () => fase6_responsive([[320,568,'phone-320'],[390,844,'phone-390']]), { seed: true }),
  p6b: () => run('p6_responsive_b', () => fase6_responsive([[844,390,'phone-390-landscape'],[768,1024,'tablet-768']]), { seed: true }),
  p6c: () => run('p6_responsive_c', () => fase6_responsive([[1024,768,'tablet-1024'],[1366,768,'laptop'],[1920,1080,'desktop']]), { seed: true }),
};

if (dispatch[FASE]) {
  await dispatch[FASE]();
} else {
  console.log('Fase desconocida: ' + FASE);
  console.log('Fases: ' + Object.keys(dispatch).join(', '));
  process.exit(1);
}
process.exit(report.fail > 0 ? 1 : 0);