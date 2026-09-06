/**
 * verify-empty-state.js
 * Verifica que la app funcione correctamente sin datos (estado inicial limpio).
 * Limpia el localStorage antes de cargar la app y valida cada módulo.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const DIR = '__tests__/screenshots/empty';
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

let errores = 0;

function check(condition, descripcion) {
  if (condition) {
    console.log(`  ✓ ${descripcion}`);
  } else {
    console.error(`  ✗ FALLO: ${descripcion}`);
    errores++;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Contexto nuevo sin ningún localStorage/cookie previo
  const ctx     = await browser.newContext({
    viewport:     { width: 1280, height: 800 },
    storageState: undefined,  // Sin estado persistido
  });
  const page    = await ctx.newPage();

  // Capturar errores JS
  const jsErrors = [];
  page.on('pageerror', e => {
    jsErrors.push(e.message);
    console.warn('  [JS ERROR]', e.message);
  });

  // Cargar directamente con localStorage vacío (contexto nuevo = limpio)
  await page.goto('http://localhost:3800', { waitUntil: 'networkidle' });

  // Esperar splash
  await page.waitForFunction(() => {
    const app = document.getElementById('app');
    return app && !app.hidden;
  }, { timeout: 12000 });
  await page.waitForTimeout(2000);

  // ── Verificar estado inicial ──────────────────────────────────────────────
  const estado = await page.evaluate(() => ({
    personal:    (AppState.get('personal')    || []).length,
    asistencias: (AppState.get('asistencias') || []).length,
    alertas:     (AppState.get('alertas')     || []).length,
    gasUrl:      AppState.get('gasUrl')       || '',
    connected:   AppState.get('connected'),
    demoLoaded:  localStorage.getItem('cpc_demo_loaded'),
    demoUrl:     (localStorage.getItem('cpc_gas_url') || '').includes('demo'),
  }));

  console.log('\n📊 Estado AppState en inicio limpio:');
  console.log(`   Personal:    ${estado.personal}`);
  console.log(`   Asistencias: ${estado.asistencias}`);
  console.log(`   GAS URL:     "${estado.gasUrl}"`);
  console.log(`   Conectado:   ${estado.connected}`);
  console.log(`   Demo loaded: ${estado.demoLoaded}`);

  check(estado.personal    === 0, 'AppState.personal arranca vacío (0 trabajadores)');
  check(estado.asistencias === 0, 'AppState.asistencias arranca vacío');
  check(estado.gasUrl      === '', 'No hay GAS URL configurada');
  check(estado.connected   === false, 'No está conectado');
  check(estado.demoLoaded  === null, 'No hay cpc_demo_loaded en localStorage');
  check(!estado.demoUrl,   'No hay URL demo en localStorage');

  // ── 1. Dashboard vacío ────────────────────────────────────────────────────
  console.log('\n📋 Dashboard vacío:');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/01-dashboard-vacio.png`, clip: { x:0, y:0, width:1280, height:700 } });

  const kpis = await page.evaluate(() => ({
    total:      document.getElementById('kpi-total')?.textContent?.trim(),
    asistencia: document.getElementById('kpi-asistencia')?.textContent?.trim(),
    tardanzas:  document.getElementById('kpi-tardanzas')?.textContent?.trim(),
    ausencias:  document.getElementById('kpi-ausencias')?.textContent?.trim(),
  }));
  console.log(`   KPI Total:      "${kpis.total}"`);
  console.log(`   KPI Asistencia: "${kpis.asistencia}"`);

  check(kpis.total      === '0',  'KPI Personal Activo muestra 0');
  check(kpis.asistencia === '0%', 'KPI Asistencia muestra 0%');
  check(kpis.tardanzas  === '0',  'KPI Tardanzas muestra 0');
  check(kpis.ausencias  === '0',  'KPI Ausencias muestra 0');

  const emptyAttendance = await page.evaluate(() =>
    !!document.querySelector('#attendance-today-list .empty-state')
  );
  check(emptyAttendance, 'Lista "Asistencia de Hoy" muestra empty-state');

  // Conexión: dot sin clase connected/disconnected/connecting
  const connText = await page.evaluate(() =>
    document.getElementById('connection-text')?.textContent?.trim()
  );
  console.log(`   Indicador conexión: "${connText}"`);
  check(connText === 'Sin configurar', 'Indicador de conexión muestra "Sin configurar"');

  // Banner demo debe estar oculto
  const demoBannerVisible = await page.evaluate(() => {
    const b = document.getElementById('demo-banner');
    return b && !b.hidden;
  });
  check(!demoBannerVisible, 'Banner MODO DEMO está oculto');

  await page.screenshot({ path: `${DIR}/01-dashboard-vacio.png`, clip: { x:0, y:0, width:1280, height:700 } });
  console.log('✓ 01-dashboard-vacio.png');

  // Scroll para ver gráficas y panel turno
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/02-dashboard-graficas-vacias.png`, clip: { x:0, y:0, width:1280, height:700 } });
  console.log('✓ 02-dashboard-graficas-vacias.png');

  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/03-dashboard-turno-vacio.png`, clip: { x:0, y:0, width:1280, height:600 } });
  console.log('✓ 03-dashboard-turno-vacio.png');

  const emptyTurno = await page.evaluate(() =>
    !!document.querySelector('#turno-lista .empty-state')
  );
  check(emptyTurno, 'Panel turno muestra empty-state');

  // ── 2. Personal vacío ─────────────────────────────────────────────────────
  console.log('\n👤 Personal vacío:');
  await page.evaluate(() => window.location.hash = '#personal');
  await page.waitForFunction(() => {
    const el = document.getElementById('page-personal');
    return el && el.classList.contains('active');
  }, { timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/04-personal-vacio.png`, clip: { x:0, y:0, width:1280, height:600 } });
  console.log('✓ 04-personal-vacio.png');

  const emptyPersonal = await page.evaluate(() =>
    !!document.querySelector('#personal-tbody .empty-state')
  );
  check(emptyPersonal, 'Tabla personal muestra empty-state');

  const btnNuevoVisible = await page.evaluate(() => {
    const btn = document.getElementById('btn-nuevo-personal');
    return btn && !btn.disabled && btn.offsetParent !== null;
  });
  check(btnNuevoVisible, 'Botón "Nuevo Trabajador" está visible y activo');

  // ── 3. Asistencia vacía ───────────────────────────────────────────────────
  console.log('\n📍 Asistencia vacía:');
  await page.evaluate(() => window.location.hash = '#asistencia');
  await page.waitForFunction(() => {
    const el = document.getElementById('page-asistencia');
    return el && el.classList.contains('active');
  }, { timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/05-asistencia-vacia.png`, clip: { x:0, y:0, width:1280, height:600 } });
  console.log('✓ 05-asistencia-vacia.png');

  // Probar autocomplete con personal vacío
  await page.click('[data-tab="manual"]');
  await page.waitForTimeout(300);
  await page.fill('#manual-worker-search', 'Ju');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/06-autocomplete-vacio.png`, clip: { x:0, y:0, width:1280, height:500 } });
  console.log('✓ 06-autocomplete-vacio.png');

  const autocompleteMsg = await page.evaluate(() =>
    document.querySelector('#autocomplete-list')?.textContent?.includes('Sin trabajadores') || false
  );
  check(autocompleteMsg, 'Autocomplete muestra "Sin trabajadores registrados" cuando personal=[]');

  // ── 4. Ajustes — indicador Sin configurar ────────────────────────────────
  console.log('\n⚙️ Ajustes:');
  await page.evaluate(() => window.location.hash = '#ajustes');
  await page.waitForFunction(() => {
    const el = document.getElementById('page-ajustes');
    return el && el.classList.contains('active');
  }, { timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/07-ajustes-sin-url.png`, clip: { x:0, y:0, width:1280, height:600 } });
  console.log('✓ 07-ajustes-sin-url.png');

  // ── 5. Verificar sin errores JS graves ───────────────────────────────────
  console.log('\n🔍 Errores JavaScript:');
  const erroresGraves = jsErrors.filter(e =>
    !e.includes('html5-qrcode') && !e.includes('Script error')
  );
  if (erroresGraves.length === 0) {
    console.log('  ✓ Sin errores JS graves');
  } else {
    erroresGraves.forEach(e => console.error(`  ✗ ${e}`));
    errores += erroresGraves.length;
  }

  await browser.close();

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  if (errores === 0) {
    console.log('✅ TODAS las verificaciones pasaron — App funciona en estado vacío');
  } else {
    console.log(`❌ ${errores} verificación(es) fallaron`);
    process.exit(1);
  }
})().catch(e => { console.error('Error fatal:', e.message); process.exit(1); });
