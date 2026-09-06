/**
 * Screenshots de verificación con datos demo
 */
const { chromium } = require('playwright');
const fs = require('fs');

const DIR = '__tests__/screenshots/demo';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('pageerror', e => console.warn('  [JS ERROR]', e.message));

  await page.goto('http://localhost:3800', { waitUntil: 'networkidle' });

  // Esperar splash
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.hidden;
  }, { timeout: 10000 });
  await page.waitForTimeout(2500); // Esperar que demo-data inyecte y módulos carguen

  // Helper de navegación
  async function goTo(pageName, waitMs = 1500) {
    await page.evaluate(p => window.location.hash = '#' + p, pageName);
    await page.waitForTimeout(300);
    await page.waitForFunction(p => {
      const el = document.getElementById('page-' + p);
      return el && el.classList.contains('active');
    }, pageName, { timeout: 5000 });
    await page.waitForTimeout(waitMs);
  }

  // Verificar datos demo en AppState
  const estado = await page.evaluate(() => ({
    personal:    (AppState.get('personal') || []).length,
    asistencias: (AppState.get('asistencias') || []).length,
    alertas:     (AppState.get('alertas') || []).length,
    config:      AppState.get('config')?.Nombre_Obra || 'N/A',
    demoLoaded:  localStorage.getItem('cpc_demo_loaded'),
  }));
  console.log('\n📊 Estado AppState con datos demo:');
  console.log(`   Personal:    ${estado.personal} trabajadores`);
  console.log(`   Asistencias: ${estado.asistencias} marcaciones hoy`);
  console.log(`   Alertas:     ${estado.alertas} pendientes`);
  console.log(`   Obra:        ${estado.config}`);
  console.log(`   Demo loaded: ${estado.demoLoaded}`);

  // 1. Dashboard completo (scroll al top)
  await goTo('dashboard', 2000);
  await page.screenshot({ path: `${DIR}/01-dashboard-datos.png`, fullPage: true });
  console.log('✓ 01-dashboard-datos.png (fullPage)');

  // 2. Dashboard scroll para ver gráficas y panel turno
  await goTo('dashboard', 1500);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/02-dashboard-graficas.png` });
  console.log('✓ 02-dashboard-graficas.png');

  // 3. Panel turno
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/03-dashboard-turno.png` });
  console.log('✓ 03-dashboard-turno.png');

  // 4. Personal — tabla con trabajadores
  await goTo('personal', 1500);
  await page.screenshot({ path: `${DIR}/04-personal-tabla.png` });
  console.log('✓ 04-personal-tabla.png');

  // 5. Personal — tabla fullpage para ver más trabajadores
  await page.screenshot({ path: `${DIR}/05-personal-tabla-full.png`, fullPage: true });
  console.log('✓ 05-personal-tabla-full.png (fullPage)');

  // 6. Personal — abrir historial del primer trabajador
  await page.click('.table-action-btn.historial', { timeout: 5000 }).catch(() => {
    console.log('  (sin botón historial visible aún)');
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DIR}/06-historial-trabajador.png` });
  console.log('✓ 06-historial-trabajador.png');

  // Cerrar modal historial
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 7. Asistencia — tabla con marcaciones de hoy
  await goTo('asistencia', 1500);
  await page.screenshot({ path: `${DIR}/07-asistencia-vista.png` });
  console.log('✓ 07-asistencia-vista.png');

  // Tabla de marcaciones
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/08-asistencia-tabla-marcaciones.png` });
  console.log('✓ 08-asistencia-tabla-marcaciones.png');

  // 8. Asistencia manual — buscar trabajador demo
  await page.click('[data-tab="manual"]');
  await page.waitForTimeout(300);
  await page.fill('#manual-worker-search', 'Juan');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/09-asistencia-autocomplete.png` });
  console.log('✓ 09-asistencia-autocomplete.png');

  // 9. Reportes — generar preview
  await goTo('reportes', 1000);
  await page.click('#btn-preview-diario');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DIR}/10-reporte-preview.png`, fullPage: true });
  console.log('✓ 10-reporte-preview.png (fullPage)');

  // 10. Dashboard — modal detalle día (click en hoy)
  await goTo('dashboard', 1500);
  const hoy = await page.evaluate(() => AppState.today());
  await page.click(`[data-fecha="${hoy}"]`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DIR}/11-modal-detalle-dia.png` });
  console.log('✓ 11-modal-detalle-dia.png');

  // 11. Personal — abrir carné QR
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await goTo('personal', 1000);
  await page.click('.table-action-btn.qr');
  // Esperar más tiempo para que QRCode.js termine de renderizar el canvas
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DIR}/12-modal-carne-qr.png` });
  console.log('✓ 12-modal-carne-qr.png');

  // Verificación final de datos
  const kpis = await page.evaluate(() => {
    if (document.getElementById('page-personal').classList.contains('active')) {
      // Estamos en personal, ir a dashboard para los KPIs
    }
    return {
      total:      document.getElementById('kpi-total')?.textContent,
      asistencia: document.getElementById('kpi-asistencia')?.textContent,
      tardanzas:  document.getElementById('kpi-tardanzas')?.textContent,
      ausencias:  document.getElementById('kpi-ausencias')?.textContent,
      filasTbody: document.querySelectorAll('#personal-tbody tr:not(.empty-row)').length,
    };
  });
  console.log('\n📈 KPIs verificados (desde DOM):');
  console.log(`   Personal Activo:    ${kpis.total}`);
  console.log(`   Asistencia:         ${kpis.asistencia}`);
  console.log(`   Tardanzas:          ${kpis.tardanzas}`);
  console.log(`   Ausencias:          ${kpis.ausencias}`);
  console.log(`   Filas en tabla:     ${kpis.filasTbody} trabajadores visibles`);

  await browser.close();
  console.log('\n✅ Screenshots de verificación demo completados en:', DIR);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
