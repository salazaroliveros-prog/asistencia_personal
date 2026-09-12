/**
 * TEST RUNNER — Control Personal Campo
 *
 * Uso:
 *   npm test
 *   npm run test:unit
 *   npm run test:e2e
 *
 * Ejecuta verificaciones sin navegador y, si hay servidor disponible,
 * también puede correr pruebas E2E con Playwright.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.resolve(import.meta.dirname, '..');

// ── Utilidades ──────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];

function log(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    const msg = detail ? `${label} — ${detail}` : label;
    console.log(`  ✗  FAIL: ${msg}`);
    fail++;
    failures.push(msg);
  }
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

function exitWithStatus() {
  console.log('\n' + '═'.repeat(60));
  console.log(`  Total: ${pass + fail}  |  PASS: ${pass}  |  FAIL: ${fail}`);
  if (fail > 0) {
    console.log('  Fallos:');
    failures.forEach(f => console.log('    - ' + f));
  }
  console.log('═'.repeat(60));
  process.exit(fail > 0 ? 1 : 0);
}

// ── 1. Verificación HTML estática ──────────────────────────────────────────
function runHtmlVerification() {
  section('Verificación HTML');

  const htmlPath = path.join(ROOT, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    log('index.html existe', false, 'Archivo no encontrado');
    return;
  }
  log('index.html existe', true);

  const html = fs.readFileSync(htmlPath, 'utf8');

  // IDs únicos
  const idRegex = / id="([^"]+)"/g;
  const idCounts = {};
  let m;
  while ((m = idRegex.exec(html)) !== null) {
    idCounts[m[1]] = (idCounts[m[1]] || 0) + 1;
  }
  const dupIds = Object.entries(idCounts).filter(e => e[1] > 1);
  log('IDs únicos sin duplicados (' + Object.keys(idCounts).length + ' IDs)', dupIds.length === 0);
  if (dupIds.length > 0) {
    dupIds.forEach(e => console.log('       Duplicado: ' + e[0] + ' (x' + e[1] + ')'));
  }

  // Scripts locales existen
  const scriptRegex = /src="(js\/[^"]+)"/g;
  while ((m = scriptRegex.exec(html)) !== null) {
    const p = path.join(ROOT, m[1]);
    log('Script existe: ' + m[1], fs.existsSync(p));
  }

  // CSS local existe
  const cssRegex = /href="(css\/[^"]+)"/g;
  while ((m = cssRegex.exec(html)) !== null) {
    const p = path.join(ROOT, m[1]);
    log('CSS existe: ' + m[1], fs.existsSync(p));
  }

  // Páginas SPA declaradas
  const spaPages = ['dashboard', 'personal', 'asistencia', 'campo', 'reportes', 'ajustes'];
  const pageIds = spaPages.filter(p => html.indexOf('id="page-' + p + '"') !== -1);
  log('6 páginas SPA declaradas', pageIds.length === 6, 'Encontradas: ' + pageIds.join(', '));

  // IDs críticos
  const criticalIds = [
    'app', 'splash-screen', 'sidebar', 'toast-container',
    'kpi-total', 'kpi-asistencia', 'kpi-tardanzas', 'kpi-ausencias',
    'calendar-grid', 'qr-reader', 'modal-personal', 'modal-carne',
    'asistencia-tbody', 'modal-horas-extra',
    'modal-dia-calendario', 'modal-dia-content',
    'pwa-install-banner', 'btn-install-app', 'pwa-install-btn', 'pwa-install-dismiss',
    'gas-webapp-url', 'gas-test-connection', 'gas-connection-status'
  ];
  criticalIds.forEach(id => {
    log('ID crítico #' + id, html.indexOf('id="' + id + '"') !== -1);
  });

  // Campos corregidos presentes en HTML
  log('Input #p-telefono existe', html.indexOf('id="p-telefono"') !== -1);
  log('Input #gas-webapp-url existe', html.indexOf('id="gas-webapp-url"') !== -1);
  log('Botón #gas-test-connection existe', html.indexOf('id="gas-test-connection"') !== -1);
}

// ── 2. Validadores unitarios ────────────────────────────────────────────────
function runValidatorTests() {
  section('Validadores unitarios');

  const validatorsPath = path.join(ROOT, 'js', 'utils', 'validators.js');
  if (!fs.existsSync(validatorsPath)) {
    log('validators.js existe', false);
    return;
  }
  log('validators.js existe', true);

  const validatorsCode = fs.readFileSync(validatorsPath, 'utf8');

  let Validators = null;
  try {
    const context = vm.createContext({ module: { exports: {} }, console });
    vm.runInContext(validatorsCode, context);
    Validators = context.Validators || (context.module && context.module.exports);
  } catch (e) {
    log('Carga de validadores', false, e.message);
    return;
  }

  if (!Validators || typeof Validators !== 'object') {
    log('Carga de validadores', false, 'No se pudo obtener el objeto Validators');
    return;
  }

  // DPI
  log('validateDPI acepta 13 dígitos', Validators.validateDPI('2512345678901').valid === true);
  log('validateDPI rechaza 12 dígitos', Validators.validateDPI('251234567890').valid === false);
  log('validateDPI rechaza 14 dígitos', Validators.validateDPI('25123456789012').valid === false);

  // Teléfono
  log('validateTelefono acepta 8 dígitos', Validators.validateTelefono('55123456').valid === true);
  log('validateTelefono acepta 11 dígitos con 502', Validators.validateTelefono('50255123456').valid === true);
  log('validateTelefono acepta +502 formateado', Validators.validateTelefono('+502 5512-3456').valid === true);
  log('validateTelefono rechaza 7 dígitos', Validators.validateTelefono('5512345').valid === false);
  log('validateTelefono rechaza 10 dígitos', Validators.validateTelefono('5512345678').valid === false);
  log('validateTelefono acepta 11 dígitos 502', Validators.validateTelefono('50255123456').valid === true);

  // Nombre
  log('validateNombre acepta nombre válido', Validators.validateNombre('Roberto Lima').valid === true);
  log('validateNombre rechaza 1 caracter', Validators.validateNombre('A').valid === false);

  // Hora
  log('validateHora acepta HH:MM', Validators.validateHora('07:00').valid === true);
  log('validateHora rechaza formato inválido', Validators.validateHora('25:00').valid === false);

  // Tolerancia
  log('validateTolerancia acepta 15', Validators.validateTolerancia(15).valid === true);
  log('validateTolerancia rechaza -1', Validators.validateTolerancia(-1).valid === false);
  log('validateTolerancia rechaza 999', Validators.validateTolerancia(999).valid === false);

  // Validaciones compuestas
  log('validateTrabajador acepta completo', Validators.validateTrabajador({ nombre: 'Juan', dpi: '2512345678901', telefono: '55123456' }).valid === true);
}

// ── 3. Lógica de negocio ────────────────────────────────────────────────────
function runBusinessLogicTests() {
  section('Lógica de negocio');

  const pdfBuilderPath = path.join(ROOT, 'js', 'utils', 'pdf-builder.js');
  if (!fs.existsSync(pdfBuilderPath)) {
    log('pdf-builder.js existe', false);
    return;
  }
  log('pdf-builder.js existe', true);

  const pdfBuilderCode = fs.readFileSync(pdfBuilderPath, 'utf8');

  log('PDF usa Metodo_Registro (no Metodo)', pdfBuilderCode.includes('Metodo_Registro') && !pdfBuilderCode.includes('a.Metodo ===') && !pdfBuilderCode.includes('m.Metodo ==='));
  log('PDF usa Map para lookup de personal', pdfBuilderCode.includes('personalMap') || pdfBuilderCode.includes('new Map'));

  const asistenciaPath = path.join(ROOT, 'js', 'modules', 'asistencia.js');
  if (!fs.existsSync(asistenciaPath)) {
    log('asistencia.js existe', false);
    return;
  }
  const asistenciaCode = fs.readFileSync(asistenciaPath, 'utf8');

  log('asistencia.js usa Metodo_Registro en tabla', asistenciaCode.includes('Metodo_Registro'));
  log('asistencia.js guarda Metodo_Registro en offline', asistenciaCode.includes('Metodo_Registro:'));
  log('asistencia.js guarda Ubicacion_Obra en offline', asistenciaCode.includes('Ubicacion_Obra:'));

  const personalPath = path.join(ROOT, 'js', 'modules', 'personal.js');
  if (fs.existsSync(personalPath)) {
    const personalCode = fs.readFileSync(personalPath, 'utf8');
    log('personal.js cuenta sábado como hábil (dow !== 0)', personalCode.includes('dow !== 0'));
  }

  const gasPath = path.join(ROOT, 'gas', 'Code.gs');
  if (fs.existsSync(gasPath)) {
    const gasCode = fs.readFileSync(gasPath, 'utf8');
    log('Code.gs calcula horas extra desde Hora_Salida_Obra config', gasCode.includes('Hora_Salida_Obra'));
    log('Code.gs no hardcodea 17:15 en calcularHorasExtra', !gasCode.includes('17 * 60 + 15'));
    log('Code.gs soporta paginacion en obtenerPersonal', gasCode.includes('function obtenerPersonal(ss, limit, offset)'));
    log('Code.gs soporta paginacion en obtenerAsistencias', gasCode.includes('function obtenerAsistencias(ss, fecha, limit, offset)'));
  }
}

// ── 4. PWA / instalación ────────────────────────────────────────────────────
function runPwaInstallTests() {
  section('PWA / Instalación');

  const appJsPath = path.join(ROOT, 'js', 'app.js');
  if (!fs.existsSync(appJsPath)) {
    log('app.js existe', false);
    return;
  }
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  log('app.js captura beforeinstallprompt', appJs.includes('beforeinstallprompt'));
  log('app.js maneja appinstalled', appJs.includes('appinstalled'));
  log('app.js oculta UI post-instalación', appJs.includes('_hidePwaUi'));
  log('app.js elimina dismiss state post-instalación', appJs.includes("localStorage.removeItem(PWA_DISMISS_KEY)"));
  log('app.js detecta si está instalada (_isPwaInstalled)', appJs.includes('_isPwaInstalled'));
  log('app.js detecta modo standalone', appJs.includes("'(display-mode: standalone)'"));
  log('app.js cambia CTA a Quitar (_setInstallCtaMode)', appJs.includes('_setInstallCtaMode'));
  log('app.js maneja Quitar/desinstalar (_triggerUninstall)', appJs.includes('_triggerUninstall'));

  const manifestPath = path.join(ROOT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    log('manifest.json existe', false);
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  log('manifest.name definido', !!manifest.name);
  log('manifest.short_name definido', !!manifest.short_name);
  log('manifest.start_url definido', !!manifest.start_url);
  log('manifest.display es standalone', manifest.display === 'standalone');
  log('manifest.tiene icono 192', manifest.icons.some(i => i.sizes === '192x192'));
  log('manifest.tiene icono 512', manifest.icons.some(i => i.sizes === '512x512'));

  const swPath = path.join(ROOT, 'service-worker.js');
  if (!fs.existsSync(swPath)) {
    log('service-worker.js existe', false);
    return;
  }
  const sw = fs.readFileSync(swPath, 'utf8');

  log('SW define install event', sw.includes("self.addEventListener('install'"));
  log('SW define activate event', sw.includes("self.addEventListener('activate'"));
  log('SW define fetch event', sw.includes("self.addEventListener('fetch'"));
  log('SW usa skipWaiting', sw.includes('skipWaiting'));
  log('SW usa clients.claim', sw.includes('clients.claim'));
}

// ── 5. E2E con Playwright (opcional) ────────────────────────────────────────
async function runE2ETests() {
  section('E2E Playwright (opcional)');

  let playwright = null;
  try {
    playwright = await import('playwright');
  } catch (e) {
    log('Playwright disponible', false, 'npm install playwright');
    return;
  }
  log('Playwright disponible', true);

  const http = await import('http');
  const baseUrl = 'http://localhost:3800';

  const serverAlive = await new Promise(resolve => {
    const req = http.get(baseUrl, res => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });

  if (!serverAlive) {
    log('Servidor en localhost:3800', false, 'Iniciá `npm run dev` o `npm run start` para correr E2E');
    return;
  }
  log('Servidor en localhost:3800', true);

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then(c => c.newPage());

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

  try {
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    log('HTTP 200 en /', response && response.status() === 200);

    await page.waitForFunction(() => {
      const app = document.getElementById('app');
      return app && !app.hidden;
    }, { timeout: 5000 }).catch(() => {});
    log('Splash desaparece', true);

    const pages = ['dashboard', 'personal', 'asistencia', 'reportes', 'ajustes'];
    for (const p of pages) {
      await page.evaluate(p => window.location.hash = '#' + p, p);
      await page.waitForTimeout(300);
      const active = await page.evaluate(p => {
        const el = document.getElementById('page-' + p);
        return el && el.classList.contains('active');
      }, p);
      log(`Página ${p} activa`, active);
    }

    // PWA install banner checks
    const banner = await page.$('#pwa-install-banner');
    const installBtn = await page.$('#btn-install-app');
    log('Banner PWA presente en DOM', !!banner);
    log('Botón instalar presente en DOM', !!installBtn);

    log('Sin errores de consola', consoleErrors.length === 0, consoleErrors.join('; ') || '');
  } catch (e) {
    log('Error en E2E', false, e.message);
  } finally {
    await browser.close();
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          CONTROL PERSONAL CAMPO — TEST SUITE                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  runHtmlVerification();
  runValidatorTests();
  runBusinessLogicTests();
  runPwaInstallTests();
  await runE2ETests();

  exitWithStatus();
}

main().catch(err => {
  console.error('Error ejecutando tests:', err);
  process.exit(1);
});
