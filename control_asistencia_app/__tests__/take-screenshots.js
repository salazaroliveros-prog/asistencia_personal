const { chromium } = require('playwright');
const fs = require('fs');

const DIR = '__tests__/screenshots';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

// Borrar screenshots anteriores
fs.readdirSync(DIR).filter(f => f.endsWith('.png')).forEach(f => fs.unlinkSync(DIR + '/' + f));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Capturar errores
  page.on('pageerror', e => console.warn('  [JS ERROR]', e.message));

  await page.goto('http://localhost:3800', { waitUntil: 'domcontentloaded' });

  // Esperar splash
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.hidden;
  }, { timeout: 8000 });
  await page.waitForTimeout(800);

  // Helper: navegar a página y esperar que su contenido se estabilice
  async function goTo(pageName, waitForSelector, extraWait = 600) {
    // Usar el router programáticamente vía hash
    await page.evaluate((p) => {
      window.location.hash = '#' + p;
    }, pageName);
    await page.waitForTimeout(300);

    // Esperar que la página esté activa en el DOM
    await page.waitForFunction((p) => {
      const el = document.getElementById('page-' + p);
      return el && el.classList.contains('active') && !el.hidden;
    }, pageName, { timeout: 5000 });

    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, { state: 'visible', timeout: 3000 });
      } catch (e) { /* no crítico */ }
    }
    await page.waitForTimeout(extraWait);
  }

  async function shot(filename, fullPage) {
    await page.screenshot({ path: DIR + '/' + filename, fullPage: !!fullPage });
    const kb = Math.round(fs.statSync(DIR + '/' + filename).size / 1024);
    console.log('  ✓ ' + filename + ' (' + kb + ' KB)');
  }

  // ─── 1. DASHBOARD ─────────────────────────────────────────────────────
  console.log('\n[1] Dashboard — Panel de Control');
  await goTo('dashboard', '#calendar-grid .cal-day', 800);
  await shot('01-dashboard.png');

  // ─── 2. DASHBOARD con toasts ──────────────────────────────────────────
  console.log('[2] Dashboard — Toast notifications');
  await page.evaluate(() => {
    Alerts.success('Bienvenido al sistema de Control de Asistencia', 'Control Personal Campo');
    setTimeout(() => Alerts.info('Configura el URL del Web App en Ajustes para conectarte'), 500);
    setTimeout(() => Alerts.warning('Sin conexión a Google Sheets — modo offline activo'), 1000);
  });
  await page.waitForTimeout(1400);
  await shot('02-dashboard-toasts.png');
  await page.waitForTimeout(5500); // esperar auto-close toasts

  // ─── 3. CALENDARIO mes anterior ───────────────────────────────────────
  console.log('[3] Dashboard — Calendario navegación');
  await page.click('#cal-prev');
  await page.waitForTimeout(400);
  await shot('03-calendario-agosto.png');
  await page.click('#cal-next');
  await page.waitForTimeout(300);

  // ─── 4. PERSONAL — Lista vacía ────────────────────────────────────────
  console.log('[4] Personal — Lista vacía');
  await goTo('personal', '#personal-tbody', 700);
  await shot('04-personal-lista.png');

  // ─── 5. PERSONAL — Modal nuevo (vacío) ───────────────────────────────
  console.log('[5] Personal — Modal nuevo trabajador');
  await page.click('#btn-nuevo-personal');
  await page.waitForSelector('#modal-personal:not([hidden])', { timeout: 3000 });
  await page.waitForTimeout(300);
  await shot('05-modal-nuevo-vacio.png');

  // ─── 6. PERSONAL — Modal con datos llenados ──────────────────────────
  console.log('[6] Personal — Formulario con datos demo');
  await page.fill('#p-nombre', 'Juan Carlos López Pérez');
  await page.fill('#p-dpi', '1234567890123');
  await page.selectOption('#p-puesto', 'Maestro de Obra');
  await page.fill('#p-telefono', '50212345678');
  await page.fill('#p-jefe', 'Residente de Obra');
  await page.fill('#p-direccion', 'Zona 12, Ciudad de Guatemala');
  await page.waitForTimeout(200);
  await shot('06-modal-form-llenado.png');

  // ─── 7. PERSONAL — Validación DPI incorrecto ─────────────────────────
  console.log('[7] Personal — Validación DPI 12 dígitos');
  await page.fill('#p-dpi', '123456789012'); // 12 dígitos — debe rechazar
  await page.click('#btn-guardar-personal');
  await page.waitForTimeout(400);
  await shot('07-validacion-dpi-error.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ─── 8. ASISTENCIA — Tab QR Scanner ──────────────────────────────────
  console.log('[8] Asistencia — Tab QR Scanner');
  await goTo('asistencia', '#btn-start-scan', 600);
  await shot('08-asistencia-qr.png');

  // ─── 9. ASISTENCIA — Tab Manual ──────────────────────────────────────
  console.log('[9] Asistencia — Tab Marcación Manual');
  await page.click('[data-tab="manual"]');
  await page.waitForTimeout(400);
  await shot('09-asistencia-manual.png');

  // ─── 10. ASISTENCIA — Tabla de marcaciones ───────────────────────────
  console.log('[10] Asistencia — Tabla de marcaciones (vacía)');
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await shot('10-asistencia-tabla.png');
  await page.evaluate(() => window.scrollTo({ top: 0 }));

  // ─── 11. REPORTES ────────────────────────────────────────────────────
  console.log('[11] Reportes');
  await goTo('reportes', '#btn-pdf-diario', 600);
  await shot('11-reportes.png');

  // ─── 12. AJUSTES — Conexión ──────────────────────────────────────────
  console.log('[12] Ajustes — Configuración de conexión GAS');
  await goTo('ajustes', '#gas-url', 600);
  await shot('12-ajustes-conexion.png');

  // ─── 13. AJUSTES — Horarios (scroll) ─────────────────────────────────
  console.log('[13] Ajustes — Sección Horarios');
  await page.evaluate(() => window.scrollTo({ top: 750, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await shot('13-ajustes-horarios.png');
  await page.evaluate(() => window.scrollTo({ top: 0 }));

  // ─── 14. MOBILE 390px — Dashboard ────────────────────────────────────
  console.log('[14] Vista móvil 390px — Dashboard');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.location.hash = '#dashboard'; });
  await page.waitForTimeout(600);
  await shot('14-mobile-dashboard.png');

  // ─── 15. MOBILE — Sidebar abierto ────────────────────────────────────
  console.log('[15] Vista móvil — Sidebar desplegado');
  await page.click('#menu-toggle');
  await page.waitForTimeout(400);
  await shot('15-mobile-sidebar.png');
  await page.click('#menu-toggle');
  await page.waitForTimeout(200);

  // ─── 16. MOBILE — Personal ───────────────────────────────────────────
  console.log('[16] Vista móvil — Personal');
  await page.evaluate(() => { window.location.hash = '#personal'; });
  await page.waitForTimeout(600);
  await shot('16-mobile-personal.png');

  // ─── 17. MOBILE — Asistencia ─────────────────────────────────────────
  console.log('[17] Vista móvil — Asistencia');
  await page.evaluate(() => { window.location.hash = '#asistencia'; });
  await page.waitForTimeout(600);
  await shot('17-mobile-asistencia.png');

  await browser.close();

  // ─── Reporte final ───────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────');
  console.log('  Screenshots en __tests__/screenshots/');
  console.log('─────────────────────────────────────────────────');
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();
  let totalKB = 0;
  files.forEach(f => {
    const kb = Math.round(fs.statSync(DIR + '/' + f).size / 1024);
    totalKB += kb;
    console.log('  ' + f + ' — ' + kb + ' KB');
  });
  console.log('─────────────────────────────────────────────────');
  console.log('  Total: ' + files.length + ' capturas, ' + totalKB + ' KB (' + Math.round(totalKB/1024) + ' MB)');

})().catch(err => {
  console.error('\nError fatal:', err.message);
  process.exit(1);
});
