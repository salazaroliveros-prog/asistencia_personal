/**
 * TEST SUITE — Control Personal Campo
 * Pegar en la consola del navegador (F12) para verificar el estado completo de la app.
 * Ejecutar DESPUÉS de que el splash screen desaparezca (~2 segundos).
 *
 * Uso:
 *   1. Abre http://localhost:3800
 *   2. Abre DevTools (F12) → pestaña Console
 *   3. Pega este script completo y presiona Enter
 */
(function runTests() {
  const results = [];
  let pass = 0, fail = 0;

  function test(name, fn) {
    try {
      const ok = fn();
      if (ok) { results.push("  ✓ " + name); pass++; }
      else     { results.push("  ✗ FAIL: " + name); fail++; }
    } catch(e) {
      results.push("  ✗ ERROR: " + name + " → " + e.message);
      fail++;
    }
  }

  // ─── 1. Constantes y Config ────────────────────────────────────────────
  console.group("📦 Constantes / Config");
  test("APP_VERSION = 1.0.0",         () => APP_VERSION === "1.0.0");
  test("DEFAULT_CONFIG.Hora_Entrada", () => DEFAULT_CONFIG.Hora_Entrada === "07:00");
  test("DEFAULT_CONFIG.Tolerancia",   () => DEFAULT_CONFIG.Tolerancia_Minutos === 15);
  test("LS_KEYS.GAS_URL correcto",    () => LS_KEYS.GAS_URL === "cpc_gas_url");
  test("PUESTOS.length === 10",       () => PUESTOS.length === 10);
  test("TIPOS_MARCACION.length === 4",() => TIPOS_MARCACION.length === 4);
  test("DEPARTAMENTOS_GT.length >= 22",()=> DEPARTAMENTOS_GT.length >= 22);
  console.groupEnd();

  // ─── 2. AppState ───────────────────────────────────────────────────────
  console.group("🗃️ AppState");
  test("AppState existe",             () => typeof AppState === "object");
  test("AppState.get funciona",       () => AppState.get("currentPage") !== undefined);
  test("AppState.today formato",      () => /^\d{4}-\d{2}-\d{2}$/.test(AppState.today()));
  test("AppState.set/on reactivo",    () => {
    let fired = false;
    AppState.on("__testKey", () => fired = true);
    AppState.set("__testKey", 42);
    return fired === true;
  });
  test("AppState.calMonth/calYear",   () => typeof AppState.get("calMonth") === "number");
  console.groupEnd();

  // ─── 3. Módulos ────────────────────────────────────────────────────────
  console.group("🧩 Módulos JS");
  test("API definido",               () => typeof API === "object" && typeof API.ping === "function");
  test("API.obtenerPersonal existe",  () => typeof API.obtenerPersonal === "function");
  test("API.registrarMarcacion exis.",() => typeof API.registrarMarcacion === "function");
  test("Alerts definido",            () => typeof Alerts === "object");
  test("Alerts.success/error/warn",  () => ["success","error","warning","info"].every(m => typeof Alerts[m] === "function"));
  test("Alerts.marcacion función",   () => typeof Alerts.marcacion === "function");
  test("Alerts.loading función",     () => typeof Alerts.loading === "function");
  test("Alerts.confirm función",     () => typeof Alerts.confirm === "function");
  test("QRGenerator definido",       () => typeof QRGenerator === "object");
  test("QRGenerator.parseQRData",    () => typeof QRGenerator.parseQRData === "function");
  test("PDFBuilder definido",        () => typeof PDFBuilder === "object");
  test("PDFBuilder.reporteDiario",   () => typeof PDFBuilder.reporteDiario === "function");
  test("PDFBuilder.exportarCSV",     () => typeof PDFBuilder.exportarCSV === "function");
  test("PDFBuilder.generarHTMLPreview",()=> typeof PDFBuilder.generarHTMLPreview === "function");
  test("ModuloPersonal.init/cargar", () => typeof ModuloPersonal.init === "function" && typeof ModuloPersonal.cargar === "function");
  test("ModuloAsistencia.cleanup",   () => typeof ModuloAsistencia.cleanup === "function");
  test("ModuloDashboard.cargar",     () => typeof ModuloDashboard.cargar === "function");
  test("ModuloReportes.cargar",      () => typeof ModuloReportes.cargar === "function");
  test("ModuloAjustes.cargar",       () => typeof ModuloAjustes.cargar === "function");
  console.groupEnd();

  // ─── 4. DOM — IDs críticos ─────────────────────────────────────────────
  console.group("🏗️ DOM Elements");
  const requiredIds = [
    // Shell
    "splash-screen", "app", "sidebar", "sidebar-overlay", "toast-container",
    "menu-toggle", "live-clock", "refresh-btn", "alerts-btn", "alerts-badge",
    "connection-text", "page-title",
    // Dashboard
    "kpi-total", "kpi-asistencia", "kpi-tardanzas", "kpi-ausencias",
    "calendar-grid", "cal-month-year", "cal-prev", "cal-next",
    "attendance-today-list", "today-count", "alerts-list", "dashboard-date",
    "btn-refresh-dashboard",
    // Personal
    "personal-table", "personal-tbody", "btn-nuevo-personal",
    "modal-personal", "form-personal", "modal-carne",
    "p-nombre", "p-dpi", "p-puesto",
    // Asistencia
    "btn-start-scan", "btn-stop-scan", "qr-reader",
    "manual-worker-search", "autocomplete-list",
    "asistencia-tbody", "asistencia-filter-date",
    "modal-horas-extra", "btn-confirmar-horas-extra",
    // Reportes
    "reporte-fecha-diario", "btn-preview-diario", "btn-pdf-diario", "btn-csv-diario",
    "reporte-semana-inicio", "reporte-semana-fin",
    "reporte-mes", "btn-pdf-mensual",
    "reporte-preview-card", "reporte-preview-content",
    // Ajustes
    "gas-url", "btn-test-connection", "btn-save-url",
    "cfg-nombre-obra", "cfg-encargado", "cfg-tolerancia",
    "cfg-hora-entrada", "cfg-hora-salida-obra",
    "logo-input", "logo-drop-area", "btn-save-logo",
    "btn-export-backup", "btn-import-backup",
    // Modales
    "modal-dia-calendario", "modal-dia-content", "modal-dia-title",
  ];
  requiredIds.forEach(id => {
    test("#" + id, () => document.getElementById(id) !== null);
  });
  console.groupEnd();

  // ─── 5. Páginas SPA ────────────────────────────────────────────────────
  console.group("📄 Router SPA");
  const pages = ["dashboard","personal","asistencia","reportes","ajustes"];
  pages.forEach(p => {
    test(`page-${p} existe en DOM`, () => document.getElementById(`page-${p}`) !== null);
    test(`page-${p} tiene data-page`, () => document.getElementById(`page-${p}`)?.dataset.page === p);
  });
  test("Solo 1 página activa", () => document.querySelectorAll(".page.active").length === 1);
  test("Splash oculto o visible", () => document.getElementById("splash-screen") !== null);
  console.groupEnd();

  // ─── 6. Lucide Icons ───────────────────────────────────────────────────
  console.group("🎨 Lucide Icons");
  test("window.lucide existe",    () => typeof window.lucide === "object");
  test("Íconos SVG renderizados", () => document.querySelectorAll("svg.lucide").length > 5);
  console.groupEnd();

  // ─── 7. CDN Libs ───────────────────────────────────────────────────────
  console.group("📚 Librerías CDN");
  test("QRCode (qrcodejs)",     () => typeof QRCode !== "undefined");
  test("Html5Qrcode",           () => typeof Html5Qrcode !== "undefined");
  test("jspdf",                 () => typeof window.jspdf !== "undefined");
  console.groupEnd();

  // ─── Reporte Final ─────────────────────────────────────────────────────
  console.log("\n============================================");
  console.log("       REPORTE FINAL DE TESTS");
  console.log("============================================");
  const failedResults = results.filter(r => r.includes("✗"));
  if (failedResults.length > 0) {
    console.group("❌ Tests fallados:");
    failedResults.forEach(r => console.log(r));
    console.groupEnd();
  }
  console.log(`Total tests: ${pass + fail}`);
  console.log(`%cPASS: ${pass}`, "color:green;font-weight:bold");
  if (fail > 0) console.log(`%cFAIL: ${fail}`, "color:red;font-weight:bold");
  else          console.log(`%c✅ TODOS LOS TESTS PASARON`, "color:green;font-weight:bold;font-size:16px");
  console.log("============================================\n");

  return { pass, fail, results };
})();
