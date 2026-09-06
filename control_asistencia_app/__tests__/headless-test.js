/**
 * PRUEBAS HEADLESS — Control Personal Campo
 * Playwright + Chromium. Valida la app corriendo en http://localhost:3800
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3800';
const PAGES    = ['dashboard', 'personal', 'asistencia', 'reportes', 'ajustes'];

let pass = 0, fail = 0;
const failures = [];

function log(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✓  ${label}`);
    pass++;
  } else {
    console.log(`  ✗  FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    fail++;
    failures.push(label + (detail ? ': ' + detail : ''));
  }
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Recolectar errores de consola y de red
  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push('PAGE ERROR: ' + err.message);
  });
  page.on('requestfailed', req => {
    networkErrors.push(req.url() + ' — ' + req.failure().errorText);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. CARGA INICIAL
  // ─────────────────────────────────────────────────────────────
  section('1. Carga Inicial');

  try {
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    log('HTTP 200 en /', response && response.status() === 200);
  } catch (e) {
    log('HTTP 200 en /', false, e.message);
    await browser.close();
    process.exit(1);
  }

  // Esperar a que desaparezca el splash (máx 5s)
  try {
    await page.waitForFunction(() => {
      const app = document.getElementById('app');
      return app && !app.hidden;
    }, { timeout: 5000 });
    log('Splash desaparece y app es visible', true);
  } catch (e) {
    log('Splash desaparece y app es visible', false, 'Timeout 5s');
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CONSTANTES Y ESTADO GLOBAL
  // ─────────────────────────────────────────────────────────────
  section('2. Constantes / AppState');

  const version = await page.evaluate(() => typeof APP_VERSION !== 'undefined' ? APP_VERSION : null);
  log('APP_VERSION definido = "1.0.0"', version === '1.0.0', version);

  const defaultConfig = await page.evaluate(() => typeof DEFAULT_CONFIG !== 'undefined' ? DEFAULT_CONFIG : null);
  log('DEFAULT_CONFIG cargado', !!defaultConfig);
  log('Hora_Entrada = 07:00', defaultConfig && defaultConfig.Hora_Entrada === '07:00');
  log('Tolerancia_Minutos = 15', defaultConfig && defaultConfig.Tolerancia_Minutos === 15);

  const lsKeys = await page.evaluate(() => typeof LS_KEYS !== 'undefined' ? LS_KEYS : null);
  log('LS_KEYS.GAS_URL correcto', lsKeys && lsKeys.GAS_URL === 'cpc_gas_url');

  const puestos = await page.evaluate(() => typeof PUESTOS !== 'undefined' ? PUESTOS.length : 0);
  log(`PUESTOS tiene ${puestos} items`, puestos === 10, `${puestos}`);

  const tiposMarcacion = await page.evaluate(() => typeof TIPOS_MARCACION !== 'undefined' ? TIPOS_MARCACION.length : 0);
  log(`TIPOS_MARCACION tiene 4`, tiposMarcacion === 4, `${tiposMarcacion}`);

  const today = await page.evaluate(() => AppState.today());
  log(`AppState.today() formato YYYY-MM-DD`, /^\d{4}-\d{2}-\d{2}$/.test(today), today);

  const stateReactive = await page.evaluate(() => {
    let fired = false;
    AppState.on('__pw_test', () => fired = true);
    AppState.set('__pw_test', 99);
    return fired;
  });
  log('AppState reactivo (set → on dispara)', stateReactive === true);

  // ─────────────────────────────────────────────────────────────
  // 3. MÓDULOS JS CARGADOS
  // ─────────────────────────────────────────────────────────────
  section('3. Módulos JS');

  const modules = await page.evaluate(() => ({
    API:              typeof API === 'object' && typeof API.ping === 'function',
    API_obtenerPers:  typeof API.obtenerPersonal === 'function',
    API_marcacion:    typeof API.registrarMarcacion === 'function',
    API_isOffline:    typeof API.isOffline === 'function',
    Alerts:           typeof Alerts === 'object',
    Alerts_marcacion: typeof Alerts.marcacion === 'function',
    Alerts_loading:   typeof Alerts.loading === 'function',
    Alerts_confirm:   typeof Alerts.confirm === 'function',
    QRGenerator:      typeof QRGenerator === 'object' && typeof QRGenerator.parseQRData === 'function',
    PDFBuilder:       typeof PDFBuilder === 'object',
    PDF_reporteDiar:  typeof PDFBuilder.reporteDiario === 'function',
    PDF_consolidado:  typeof PDFBuilder.reporteConsolidado === 'function',
    PDF_exportCSV:    typeof PDFBuilder.exportarCSV === 'function',
    PDF_htmlPreview:  typeof PDFBuilder.generarHTMLPreview === 'function',
    ModPersonal:      typeof ModuloPersonal === 'object' && typeof ModuloPersonal.init === 'function',
    ModAsistencia:    typeof ModuloAsistencia === 'object' && typeof ModuloAsistencia.cleanup === 'function',
    ModDashboard:     typeof ModuloDashboard === 'object' && typeof ModuloDashboard.cargar === 'function',
    ModReportes:      typeof ModuloReportes === 'object' && typeof ModuloReportes.cargar === 'function',
    ModAjustes:       typeof ModuloAjustes === 'object' && typeof ModuloAjustes.cargar === 'function',
  }));

  Object.entries(modules).forEach(([k, v]) => log(k, v));

  // ─────────────────────────────────────────────────────────────
  // 4. CDN LIBS
  // ─────────────────────────────────────────────────────────────
  section('4. Librerías CDN');

  const cdns = await page.evaluate(() => ({
    'Lucide (window.lucide)':       typeof window.lucide === 'object',
    'QRCode (qrcodejs)':            typeof QRCode !== 'undefined',
    'Html5Qrcode':                  typeof Html5Qrcode !== 'undefined',
    // jsPDF UMD expone window.jspdf.jsPDF (namespace), no window.jsPDF directamente
    'jspdf (window.jspdf.jsPDF)':   typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF === 'function',
  }));

  Object.entries(cdns).forEach(([k, v]) => log(k, v));

  // Iconos renderizados
  const iconCount = await page.evaluate(() => document.querySelectorAll('svg.lucide').length);
  log(`Lucide SVGs renderizados (>${5})`, iconCount > 5, `${iconCount} íconos`);

  // ─────────────────────────────────────────────────────────────
  // 5. DOM — IDs CRÍTICOS
  // ─────────────────────────────────────────────────────────────
  section('5. DOM — Elementos críticos');

  const domIds = [
    'app', 'splash-screen', 'sidebar', 'toast-container', 'sidebar-overlay',
    'menu-toggle', 'live-clock', 'refresh-btn', 'alerts-btn', 'alerts-badge',
    'connection-text', 'page-title',
    'kpi-total', 'kpi-asistencia', 'kpi-tardanzas', 'kpi-ausencias',
    'calendar-grid', 'cal-month-year', 'cal-prev', 'cal-next',
    'attendance-today-list', 'today-count', 'alerts-list', 'dashboard-date',
    'personal-table', 'personal-tbody', 'btn-nuevo-personal', 'personal-search',
    'modal-personal', 'form-personal', 'modal-carne', 'p-nombre', 'p-dpi',
    'btn-start-scan', 'btn-stop-scan', 'qr-reader',
    'manual-worker-search', 'autocomplete-list',
    'asistencia-tbody', 'asistencia-filter-date', 'modal-horas-extra',
    'reporte-fecha-diario', 'btn-pdf-diario', 'btn-csv-diario',
    'reporte-semana-inicio', 'reporte-mes', 'reporte-preview-card',
    'gas-url', 'btn-test-connection', 'btn-save-url',
    'cfg-nombre-obra', 'cfg-tolerancia', 'cfg-hora-entrada',
    'logo-drop-area', 'btn-export-backup', 'btn-import-backup',
    'modal-dia-calendario', 'modal-dia-content', 'modal-dia-title',
  ];

  const missingIds = await page.evaluate((ids) => {
    return ids.filter(id => !document.getElementById(id));
  }, domIds);

  domIds.forEach(id => log(`#${id}`, !missingIds.includes(id)));

  // ─────────────────────────────────────────────────────────────
  // 6. ROUTER SPA — Navegación entre páginas
  // ─────────────────────────────────────────────────────────────
  section('6. Router SPA — Navegación');

  for (const pageName of PAGES) {
    // Click en el nav link
    await page.click(`[data-page="${pageName}"]`);
    await page.waitForTimeout(300);

    const activePageId = await page.evaluate(() => {
      const active = document.querySelector('.page.active');
      return active ? active.dataset.page : null;
    });
    log(`Navegar a "${pageName}" → página activa correcta`, activePageId === pageName, `activa: ${activePageId}`);

    // Solo 1 página activa
    const activeCount = await page.evaluate(() => document.querySelectorAll('.page.active').length);
    log(`  Solo 1 página activa en "${pageName}"`, activeCount === 1, `count=${activeCount}`);

    // URL hash actualizado
    const hash = await page.evaluate(() => window.location.hash);
    log(`  Hash URL = #${pageName}`, hash === `#${pageName}`, `hash=${hash}`);
  }

  // ─────────────────────────────────────────────────────────────
  // 7. DASHBOARD — KPIs y Calendario
  // ─────────────────────────────────────────────────────────────
  section('7. Dashboard — KPIs y Calendario');

  await page.click('[data-page="dashboard"]');
  await page.waitForTimeout(400);

  const kpiTotalText = await page.textContent('#kpi-total');
  log('KPI Total tiene valor', kpiTotalText !== undefined && kpiTotalText.trim() !== '');

  const calendarHtml = await page.innerHTML('#calendar-grid');
  const hasDays = calendarHtml.includes('cal-day');
  log('Calendario renderizado con celdas de días', hasDays);

  const calMonthText = await page.textContent('#cal-month-year');
  log('Mes del calendario tiene texto', calMonthText && calMonthText.trim().length > 3, calMonthText);

  // Reloj en tiempo real
  const clock1 = await page.textContent('#live-clock');
  await page.waitForTimeout(1100);
  const clock2 = await page.textContent('#live-clock');
  log('Reloj en tiempo real cambia cada segundo', clock1 !== clock2, `${clock1} → ${clock2}`);

  // Navegar calendario: mes anterior
  await page.click('#cal-prev');
  await page.waitForTimeout(200);
  const calAfterPrev = await page.textContent('#cal-month-year');
  log('Botón ← cambia el mes', calAfterPrev !== calMonthText, `${calMonthText} → ${calAfterPrev}`);

  await page.click('#cal-next');
  await page.waitForTimeout(200);
  const calAfterNext = await page.textContent('#cal-month-year');
  log('Botón → restaura el mes', calAfterNext === calMonthText, `${calAfterPrev} → ${calAfterNext}`);

  // ─────────────────────────────────────────────────────────────
  // 8. MODAL PERSONAL — Abrir/Cerrar
  // ─────────────────────────────────────────────────────────────
  section('8. Modal Personal — Abrir / Cerrar');

  await page.click('[data-page="personal"]');
  await page.waitForTimeout(300);

  // Abrir modal
  await page.click('#btn-nuevo-personal');
  await page.waitForTimeout(200);

  const modalVisible = await page.evaluate(() => {
    const m = document.getElementById('modal-personal');
    return m && !m.hidden;
  });
  log('Modal de nuevo personal se abre', modalVisible);

  // Cerrar con botón X
  await page.click('#modal-personal .modal-close');
  await page.waitForTimeout(200);

  const modalClosed = await page.evaluate(() => {
    const m = document.getElementById('modal-personal');
    return m && m.hidden;
  });
  log('Modal se cierra con botón X', modalClosed);

  // Abrir y cerrar con ESC
  await page.click('#btn-nuevo-personal');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const modalClosedEsc = await page.evaluate(() => {
    const m = document.getElementById('modal-personal');
    return m && m.hidden;
  });
  log('Modal se cierra con tecla ESC', modalClosedEsc);

  // ─────────────────────────────────────────────────────────────
  // 9. FORMULARIO PERSONAL — Validación DPI Guatemala
  // ─────────────────────────────────────────────────────────────
  section('9. Validación DPI — Guatemala 13 dígitos');

  await page.click('#btn-nuevo-personal');
  await page.waitForTimeout(200);

  // Rellenar nombre y DPI inválido (12 dígitos)
  await page.fill('#p-nombre', 'Juan Test');
  await page.fill('#p-dpi', '123456789012');  // solo 12 dígitos
  await page.selectOption('#p-puesto', 'Albañil');
  await page.click('#btn-guardar-personal');
  await page.waitForTimeout(300);

  // La validación muestra mensaje de error INLINE en #p-dpi-error (no toast)
  const dpiErrorVisible = await page.evaluate(() => {
    const el = document.getElementById('p-dpi-error');
    return el && !el.hidden && el.textContent.includes('13');
  });
  log('Validación: DPI de 12 dígitos muestra error inline', dpiErrorVisible);

  // Cerrar modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ─────────────────────────────────────────────────────────────
  // 10. ASISTENCIA — Tabs QR / Manual
  // ─────────────────────────────────────────────────────────────
  section('10. Asistencia — Tabs');

  await page.click('[data-page="asistencia"]');
  await page.waitForTimeout(400);

  // Tab QR activo por defecto
  const qrTabActive = await page.evaluate(() => {
    const tab = document.querySelector('[data-tab="qr-scanner"]');
    return tab && tab.classList.contains('active');
  });
  log('Tab QR activo por defecto', qrTabActive);

  // Cambiar a tab manual
  await page.click('[data-tab="manual"]');
  await page.waitForTimeout(200);

  const manualTabActive = await page.evaluate(() => {
    const tab = document.querySelector('[data-tab="manual"]');
    return tab && tab.classList.contains('active');
  });
  log('Tab Manual se activa al hacer click', manualTabActive);

  // Tab manual content visible
  const manualContentVisible = await page.evaluate(() => {
    const content = document.getElementById('tab-manual');
    return content && !content.hidden;
  });
  log('Contenido de tab Manual visible', manualContentVisible);

  // QR content oculto
  const qrContentHidden = await page.evaluate(() => {
    const content = document.getElementById('tab-qr-scanner');
    return content && content.hidden;
  });
  log('Contenido de tab QR oculto al estar en Manual', qrContentHidden);

  // ─────────────────────────────────────────────────────────────
  // 11. AUTOCOMPLETE BÚSQUEDA MANUAL
  // ─────────────────────────────────────────────────────────────
  section('11. Autocomplete — Búsqueda sin resultados');

  await page.fill('#manual-worker-search', 'zzzzzz');
  await page.waitForTimeout(400);

  const autocompleteHidden = await page.evaluate(() => {
    const list = document.getElementById('autocomplete-list');
    return list && list.hidden;
  });
  log('Autocomplete oculto para búsqueda sin resultados', autocompleteHidden);

  await page.fill('#manual-worker-search', '');

  // ─────────────────────────────────────────────────────────────
  // 12. REPORTES — Sección visible y botones presentes
  // ─────────────────────────────────────────────────────────────
  section('12. Reportes — UI');

  await page.click('[data-page="reportes"]');
  await page.waitForTimeout(300);

  const reporteBtns = await page.evaluate(() => ({
    btnPdfDiario:   document.getElementById('btn-pdf-diario') !== null,
    btnCsvDiario:   document.getElementById('btn-csv-diario') !== null,
    btnPrevDiario:  document.getElementById('btn-preview-diario') !== null,
    btnPdfSemanal:  document.getElementById('btn-pdf-semanal') !== null,
    btnPdfMensual:  document.getElementById('btn-pdf-mensual') !== null,
    fechaInput:     document.getElementById('reporte-fecha-diario')?.value !== '',
    semanaInicio:   document.getElementById('reporte-semana-inicio')?.value !== '',
    mesInput:       document.getElementById('reporte-mes')?.value !== '',
  }));
  Object.entries(reporteBtns).forEach(([k, v]) => log(k, v));

  // Preview oculto al inicio
  const previewHidden = await page.evaluate(() => {
    const card = document.getElementById('reporte-preview-card');
    return card && card.hidden;
  });
  log('reporte-preview-card oculto al inicio', previewHidden);

  // ─────────────────────────────────────────────────────────────
  // 13. AJUSTES — Formulario de configuración
  // ─────────────────────────────────────────────────────────────
  section('13. Ajustes — Formulario y URL GAS');

  await page.click('[data-page="ajustes"]');
  await page.waitForTimeout(300);

  // Ingresar una URL falsa y probar conexión
  await page.fill('#gas-url', 'https://script.google.com/macros/s/DEMO_TEST/exec');
  await page.click('#btn-save-url');
  await page.waitForTimeout(300);

  // Verificar que el valor fue guardado en AppState
  const savedUrl = await page.evaluate(() => AppState.get('gasUrl'));
  log('URL GAS guardada en AppState', savedUrl === 'https://script.google.com/macros/s/DEMO_TEST/exec', savedUrl);

  // Horarios pre-cargados con defaults
  const horaEntrada = await page.inputValue('#cfg-hora-entrada');
  log('Hora de entrada pre-cargada (07:00)', horaEntrada === '07:00', horaEntrada);

  const horaSalida = await page.inputValue('#cfg-hora-salida-obra');
  log('Hora de salida pre-cargada (17:00)', horaSalida === '17:00', horaSalida);

  // Tolerancia
  const tolerancia = await page.inputValue('#cfg-tolerancia');
  log('Tolerancia pre-cargada (15)', tolerancia === '15', tolerancia);

  // ─────────────────────────────────────────────────────────────
  // 14. SIDEBAR TOGGLE (mobile)
  // ─────────────────────────────────────────────────────────────
  section('14. Sidebar Toggle');

  const sidebarOpen = await page.evaluate(() => document.body.classList.contains('sidebar-open'));
  log('Sidebar cerrado al inicio', !sidebarOpen);

  await page.click('#menu-toggle');
  await page.waitForTimeout(200);
  const sidebarAfterToggle = await page.evaluate(() => document.body.classList.contains('sidebar-open'));
  log('Sidebar abre con menu-toggle', sidebarAfterToggle);

  await page.click('#menu-toggle');
  await page.waitForTimeout(200);
  const sidebarClosed = await page.evaluate(() => document.body.classList.contains('sidebar-open'));
  log('Sidebar cierra con segundo click', !sidebarClosed);

  // ─────────────────────────────────────────────────────────────
  // 15. TOAST SYSTEM
  // ─────────────────────────────────────────────────────────────
  section('15. Toast Notifications');

  await page.evaluate(() => Alerts.success('Test exitoso', 'Prueba'));
  await page.waitForTimeout(200);

  const toastSuccess = await page.evaluate(() => document.querySelectorAll('.toast.success').length > 0);
  log('Toast success se muestra', toastSuccess);

  await page.evaluate(() => Alerts.error('Test error'));
  await page.waitForTimeout(200);

  const toastErr = await page.evaluate(() => document.querySelectorAll('.toast.error').length > 0);
  log('Toast error se muestra', toastErr);

  // Auto-close: esperar y verificar que el toast desaparece
  await page.waitForTimeout(5500);
  const toastsAfter = await page.evaluate(() => document.querySelectorAll('.toast.success').length);
  log('Toast success auto-cierra en ~4.5s', toastsAfter === 0, `${toastsAfter} toasts restantes`);

  // ─────────────────────────────────────────────────────────────
  // 16. ERRORES DE CONSOLA
  // ─────────────────────────────────────────────────────────────
  section('16. Errores de Consola y Red');

  // Filtrar errores ignorables (CDN warnings de terceros, etc.)
  const realErrors = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('Permissions-Policy') &&
    !e.includes('google') &&
    !e.includes('cdnjs') &&
    !e.includes('unpkg') &&
    !e.includes('fonts.') &&
    !e.includes('404') // CDN 404s son externos
  );

  log('Sin errores JS en consola', realErrors.length === 0,
    realErrors.length > 0 ? realErrors.slice(0, 3).join(' | ') : '');

  const realNetworkErrors = networkErrors.filter(e =>
    !e.includes('favicon') && e.includes('localhost')
  );
  log('Sin errores de red en recursos locales', realNetworkErrors.length === 0,
    realNetworkErrors.length > 0 ? realNetworkErrors.slice(0, 2).join(' | ') : '');

  // ─────────────────────────────────────────────────────────────
  // 17. CHART.JS — Canvas de gráficas en dashboard
  // ─────────────────────────────────────────────────────────────
  section('17. Chart.js — Canvas de gráficas');

  await page.click('[data-page="dashboard"]');
  await page.waitForTimeout(400);

  // Chart.js disponible como global
  const chartJsLoaded = await page.evaluate(() => typeof Chart !== 'undefined');
  log('Chart.js cargado (window.Chart)', chartJsLoaded);

  // Canvas de gráfica semanal presente
  const canvasSemana = await page.evaluate(() => document.getElementById('chart-semana') !== null);
  log('canvas#chart-semana presente en DOM', canvasSemana);

  // Canvas de gráfica mensual presente
  const canvasMes = await page.evaluate(() => document.getElementById('chart-mes') !== null);
  log('canvas#chart-mes presente en DOM', canvasMes);

  // Contenedor de gráficas con clase correcta
  const chartsGrid = await page.evaluate(() => document.querySelector('.dashboard-charts-grid') !== null);
  log('.dashboard-charts-grid presente', chartsGrid);

  // Label del chart semanal tiene texto
  const chartSemanaLabel = await page.textContent('#chart-semana-label');
  log('Label chart semanal tiene texto', chartSemanaLabel && chartSemanaLabel.trim().length > 0, chartSemanaLabel);

  // ─────────────────────────────────────────────────────────────
  // 18. PANEL DE TURNO — ¿Quién está en obra?
  // ─────────────────────────────────────────────────────────────
  section('18. Panel de Turno — Estado en obra');

  // Tabs del turno presentes
  const turnoTabs = await page.evaluate(() => document.querySelectorAll('.turno-tab').length);
  log('4 tabs de turno presentes', turnoTabs === 4, `${turnoTabs} tabs`);

  // Tab "En Obra" activo por defecto
  const tabEnObraActive = await page.evaluate(() => {
    const tab = document.querySelector('.turno-tab[data-turno="en-obra"]');
    return tab && tab.classList.contains('active');
  });
  log('Tab "En Obra" activo por defecto', tabEnObraActive);

  // Contadores presentes
  const counters = await page.evaluate(() => ({
    enObra:    document.getElementById('turno-count-en-obra')    !== null,
    receso:    document.getElementById('turno-count-receso')     !== null,
    salio:     document.getElementById('turno-count-salio')      !== null,
    sinMarcar: document.getElementById('turno-count-sin-marcar') !== null,
  }));
  Object.entries(counters).forEach(([k, v]) => log(`Counter #turno-count-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`, v));

  // Clic en tab "Sin Marcar"
  await page.click('.turno-tab[data-turno="sin-marcar"]');
  await page.waitForTimeout(200);
  const sinMarcarActive = await page.evaluate(() => {
    const tab = document.querySelector('.turno-tab[data-turno="sin-marcar"]');
    return tab && tab.classList.contains('active');
  });
  log('Tab "Sin Marcar" se activa al hacer click', sinMarcarActive);

  // Lista de turno presente
  const turnoLista = await page.evaluate(() => document.getElementById('turno-lista') !== null);
  log('#turno-lista presente en DOM', turnoLista);

  // Restaurar tab en-obra
  await page.click('.turno-tab[data-turno="en-obra"]');
  await page.waitForTimeout(200);

  // ─────────────────────────────────────────────────────────────
  // 19. MODAL HISTORIAL — Botón y apertura
  // ─────────────────────────────────────────────────────────────
  section('19. Modal Historial de Trabajador');

  await page.click('[data-page="personal"]');
  await page.waitForTimeout(400);

  // Modal historial presente en DOM
  const modalHistorial = await page.evaluate(() => document.getElementById('modal-historial') !== null);
  log('modal#modal-historial presente en DOM', modalHistorial);

  // Elementos internos del modal
  const historialEls = await page.evaluate(() => ({
    title:       document.getElementById('modal-historial-title')  !== null,
    sub:         document.getElementById('modal-historial-sub')    !== null,
    fechaIni:    document.getElementById('historial-fecha-inicio') !== null,
    fechaFin:    document.getElementById('historial-fecha-fin')    !== null,
    btnBuscar:   document.getElementById('btn-buscar-historial')   !== null,
    resumen:     document.getElementById('historial-resumen')      !== null,
    content:     document.getElementById('historial-content')      !== null,
  }));
  Object.entries(historialEls).forEach(([k, v]) => log(`historial: ${k}`, v));

  // Offline queue — LS_KEYS tiene la clave correcta
  const offlineKey = await page.evaluate(() =>
    typeof LS_KEYS !== 'undefined' && LS_KEYS.OFFLINE_QUEUE === 'cpc_offline_queue'
  );
  log('LS_KEYS.OFFLINE_QUEUE definida', offlineKey);

  // API.getOfflineQueue disponible
  const offlineQueueFn = await page.evaluate(() =>
    typeof API !== 'undefined' && typeof API.getOfflineQueue === 'function'
  );
  log('API.getOfflineQueue() disponible', offlineQueueFn);

  // API.syncOfflineQueue disponible
  const syncFn = await page.evaluate(() =>
    typeof API !== 'undefined' && typeof API.syncOfflineQueue === 'function'
  );
  log('API.syncOfflineQueue() disponible', syncFn);

  // Indicador de sync presente en topbar
  const syncIndicator = await page.evaluate(() => document.getElementById('sync-indicator') !== null);
  log('#sync-indicator presente en topbar', syncIndicator);

  // Botón descargar carné PNG presente
  const btnDescPNG = await page.evaluate(() => document.getElementById('btn-descargar-carne-png') !== null);
  log('#btn-descargar-carne-png presente en modal carné', btnDescPNG);

  // html2canvas disponible (puede tardar en cargar desde CDN — verificar como función)
  const h2cLoaded = await page.evaluate(() => typeof html2canvas !== 'undefined');
  log('html2canvas disponible (CDN)', h2cLoaded);

  // ─────────────────────────────────────────────────────────────
  // REPORTE FINAL
  // ─────────────────────────────────────────────────────────────
  await browser.close();

  const total = pass + fail;
  console.log('\n' + '═'.repeat(55));
  console.log('  REPORTE FINAL DE PRUEBAS HEADLESS');
  console.log('  Control Personal Campo v1.1.0');
  console.log('═'.repeat(55));
  console.log(`  Total  : ${total}`);
  console.log(`  PASS   : ${pass}`);
  console.log(`  FAIL   : ${fail}`);
  console.log('═'.repeat(55));

  if (failures.length > 0) {
    console.log('\n  Fallos:');
    failures.forEach(f => console.log('    ✗ ' + f));
  } else {
    console.log('\n  ✅  TODOS LOS TESTS PASARON CORRECTAMENTE');
  }

  console.log('═'.repeat(55) + '\n');
  process.exit(fail > 0 ? 1 : 0);

})().catch(err => {
  console.error('Error fatal en test runner:', err.message);
  process.exit(1);
});
