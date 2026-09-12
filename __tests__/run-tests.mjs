/** Consolidated ESM runner. Legacy browser scripts are CommonJS. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
let pass = 0;
let fail = 0;
const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) { console.log(`  ✓  ${label}`); pass++; }
  else { const message = detail ? `${label} — ${detail}` : label; console.log(`  ✗  FAIL: ${message}`); fail++; failures.push(message); }
};
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function htmlChecks() {
  console.log('\n── Verificación HTML');
  const html = read('index.html');
  check('index.html existe', true);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  check(`IDs únicos sin duplicados (${new Set(ids).size} IDs)`, new Set(ids).size === ids.length);
  for (const [, file] of html.matchAll(/src="(js\/[^\"]+)"/g)) check(`Script existe: ${file}`, fs.existsSync(path.join(ROOT, file)));
  for (const [, file] of html.matchAll(/href="(css\/[^\"]+)"/g)) check(`CSS existe: ${file}`, fs.existsSync(path.join(ROOT, file)));
  for (const id of ['app','splash-screen','sidebar','toast-container','kpi-total','kpi-asistencia','kpi-tardanzas','kpi-ausencias','calendar-grid','qr-reader','modal-personal','modal-carne','asistencia-tbody','modal-horas-extra','firebase-project-id','btn-connect-firebase','modal-dia-calendario','modal-dia-content']) check(`ID crítico #${id}`, html.includes(`id="${id}"`));
  check('6 páginas SPA declaradas', ['dashboard','personal','asistencia','campo','reportes','ajustes'].every(p => html.includes(`id="page-${p}"`)));
  check('field-scanner standalone existe', fs.existsSync(path.join(ROOT, 'field-scanner.html')));
  check('field-scanner.js existe', fs.existsSync(path.join(ROOT, 'field-scanner.js')));
  check('index.html enlaza a field-scanner standalone', html.includes('href="/field-scanner.html"') || html.includes('href="./field-scanner.html"'));
}

function validatorChecks() {
  console.log('\n── Validadores unitarios');
  const context = vm.createContext({
    module: { exports: {} },
    console,
    window: {
      CPC: {
        ValidationRules: {
          DPI_LENGTH: 13,
          DPI_MIN_LENGTH: 13,
          DPI_MAX_LENGTH: 13,
          TOLERANCIA_MIN: 0,
          TOLERANCIA_MAX: 60,
          LATITUDE_MIN: -90,
          LATITUDE_MAX: 90,
          LONGITUDE_MIN: -180,
          LONGITUDE_MAX: 180,
          GPS_RADIUS_MIN: 10,
          GPS_RADIUS_MAX: 10000,
          NOMBRE_MIN_LENGTH: 3,
          NOMBRE_MAX_LENGTH: 100,
          TELEFONO_LENGTH: 8,
          IMAGEN_MAX_SIZE: 600 * 1024,
          IMAGEN_MAX_DIMENSION: 300,
        },
      },
    },
  });
  vm.runInContext(read('js/utils/validators.js'), context);
  const V = context.Validators || context.module.exports;
  const cases = [
    ['DPI válido (13 dígitos)', V.validateDPI('2512345678901').valid],
    ['DPI inválido (12 dígitos)', !V.validateDPI('251234567890').valid],
    ['DPI inválido (vacío)', !V.validateDPI('').valid],
    ['DPI inválido (null)', !V.validateDPI(null).valid],
    ['DPI inválido (con letras)', !V.validateDPI('251234567890A').valid],
    ['DPI con espacios (se limpian)', V.validateDPI('2512 3456 7890 1').valid],
    ['teléfono local (8 dígitos)', V.validateTelefono('55123456').valid],
    ['teléfono internacional (+502)', V.validateTelefono('+502 5512-3456').valid],
    ['teléfono corto inválido', !V.validateTelefono('5512345').valid],
    ['teléfono vacío (opcional)', V.validateTelefono('').valid],
    ['teléfono null (opcional)', V.validateTelefono(null).valid],
    ['teléfono con código país 502 (11 dígitos)', V.validateTelefono('50255123456').valid],
    ['teléfono 9 dígitos inválido', !V.validateTelefono('551234567').valid],
    ['nombre válido', V.validateNombre('Roberto Lima').valid],
    ['nombre corto inválido', !V.validateNombre('Ab').valid],
    ['nombre vacío inválido', !V.validateNombre('').valid],
    ['nombre con números inválido', !V.validateNombre('Juan123').valid],
    ['nombre con acentos válido', V.validateNombre('José García').valid],
    ['nombre con ñ válido', V.validateNombre('España López').valid],
    ['hora válida (07:00)', V.validateHora('07:00').valid],
    ['hora válida (00:00)', V.validateHora('00:00').valid],
    ['hora válida (23:59)', V.validateHora('23:59').valid],
    ['hora inválida (25:00)', !V.validateHora('25:00').valid],
    ['hora válida (7:00 sin cero)', V.validateHora('7:00').valid],
    ['tolerancia válida (15)', V.validateTolerancia(15).valid],
    ['tolerancia mínima (0)', V.validateTolerancia(0).valid],
    ['tolerancia máxima (60)', V.validateTolerancia(60).valid],
    ['tolerancia inválida (-1)', !V.validateTolerancia(-1).valid],
    ['tolerancia inválida (61)', !V.validateTolerancia(61).valid],
    ['trabajador completo válido', V.validateTrabajador({nombre:'Juan Pérez',dpi:'2512345678901',telefono:'55123456'}).valid],
    ['trabajador sin nombre inválido', !V.validateTrabajador({nombre:'',dpi:'2512345678901'}).valid],
    ['trabajador sin DPI inválido', !V.validateTrabajador({nombre:'Juan',dpi:''}).valid],
    ['trabajador DPI corto inválido', !V.validateTrabajador({nombre:'Juan',dpi:'25123'}).valid],
    ['latitud válida', V.validateLatitud('14.634915').valid],
    ['latitud inválida (>90)', !V.validateLatitud('91').valid],
    ['longitud válida', V.validateLongitud('-90.506894').valid],
    ['longitud inválida (<-180)', !V.validateLongitud('-181').valid],
    ['radio GPS válido', V.validateGPSRadius(200).valid],
    ['radio GPS inválido (<10)', !V.validateGPSRadius(5).valid],
    ['orden horarios válido', V.validateOrdenHorarios({entrada:'07:00',salidaReceso:'10:00',regresoReceso:'10:30',salidaObra:'17:00'}).valid],
    ['orden horarios inválido', !V.validateOrdenHorarios({entrada:'07:00',salidaReceso:'06:00',regresoReceso:'10:30',salidaObra:'17:00'}).valid],
  ];
  for (const [label, result] of cases) check(label, result);
}

function dpiDuplicateChecks() {
  console.log('\n── Validación DPI duplicado');
  const personalSrc = read('js/modules/personal.js');
  // Verificar que la función de duplicado existe
  check('Función _checkDPIDuplicate existe en personal.js', personalSrc.includes('_checkDPIDuplicate'));
  check('Verificación DPI duplicado en _guardarPersonal', personalSrc.includes('_checkDPIDuplicate(payload.dpi, _editingId)'));
  check('Mensaje de error DPI duplicado incluye nombre del trabajador existente', personalSrc.includes('dpiCheck.existingWorker.Nombre_Completo'));
  check('DPI duplicado excluye trabajador actual en edición', personalSrc.includes('p.ID_Trabajador !== excludeId'));
}

function formInputChecks() {
  console.log('\n── Inputs de formularios');
  const html = read('index.html');

  // Personal form inputs
  check('Input nombre requerido', html.includes('id="p-nombre"') && html.includes('required'));
  check('Input DPI requerido con pattern', html.includes('id="p-dpi"') && html.includes('pattern='));
  check('Select puesto requerido', html.includes('id="p-puesto"') && html.includes('required'));
  check('Input teléfono con tipo tel', html.includes('id="p-telefono"') && html.includes('type="tel"'));
  check('Input WhatsApp con tipo tel', html.includes('id="p-whatsapp"') && html.includes('type="tel"'));
  check('Input dirección', html.includes('id="p-direccion"'));
  check('Input foto acepta imagen', html.includes('id="foto-input"') && html.includes('image/*'));

  // Settings inputs
  check('Input tolerancia con rango', html.includes('id="cfg-tolerancia"') && html.includes('min="0"') && html.includes('max="60"'));
  check('Input radio GPS con rango', html.includes('id="cfg-gps-radio"') && html.includes('min="10"') && html.includes('max="10000"'));
  check('Input latitud GPS', html.includes('id="cfg-gps-centro-lat"'));
  check('Input longitud GPS', html.includes('id="cfg-gps-centro-lon"'));

  // Attendance inputs
  check('Input búsqueda manual', html.includes('id="manual-worker-search"') && html.includes('type="search"'));
  check('Filtro fecha asistencia', html.includes('id="asistencia-filter-date"') && html.includes('type="date"'));
  check('Horas extra input', html.includes('id="horas-extra-valor"') && html.includes('type="number"'));
}

function businessChecks() {
  console.log('\n── Lógica de negocio');
  const pdf = read('js/utils/pdf-builder.js'); const asistencia = read('js/modules/asistencia.js'); const personal = read('js/modules/personal.js'); const api = read('src/api.ts');
  check('PDF usa Metodo_Registro', pdf.includes('Metodo_Registro') && !pdf.includes('a.Metodo ==='));
  check('PDF usa lookup eficiente de personal', pdf.includes('personalMap') || pdf.includes('new Map'));
  check('Asistencia conserva Metodo_Registro', asistencia.includes('Metodo_Registro'));
  check('Asistencia offline conserva Ubicacion_Obra', asistencia.includes('Ubicacion_Obra:'));
  check('Sábado contado como día hábil', personal.includes('dow !== 0'));
  check('API usa Firestore con respaldo local', api.includes('FirebaseClient') && api.includes('attendanceCache'));
}

function helpersChecks() {
  console.log('\n── Helpers compartidos');
  const stringHelpers = read('js/utils/string-helpers.js');
  const photoHelpers = read('js/utils/photo-helpers.js');
  const validationRules = read('js/utils/validation-rules.js');
  const dateHelpers = read('js/utils/date-helpers.js');
  check('string-helpers.js creado', fs.existsSync(path.join(ROOT, 'js/utils/string-helpers.js')));
  check('photo-helpers.js creado', fs.existsSync(path.join(ROOT, 'js/utils/photo-helpers.js')));
  check('validation-rules.js creado', fs.existsSync(path.join(ROOT, 'js/utils/validation-rules.js')));
  check('date-helpers.js creado', fs.existsSync(path.join(ROOT, 'js/utils/date-helpers.js')));
  check('string-helpers expone escHtml', stringHelpers.includes('escHtml'));
  check('string-helpers expone formatTelefono', stringHelpers.includes('formatTelefono'));
  check('string-helpers expose debounce', stringHelpers.includes('debounce'));
  check('string-helpers expone generateLocalId', stringHelpers.includes('generateLocalId'));
  check('photo-helpers expone compressImage', photoHelpers.includes('compressImage'));
  check('photo-helpers expone updatePhotoPreview', photoHelpers.includes('updatePhotoPreview'));
  check('validation-rules expone DPI_LENGTH', validationRules.includes('DPI_LENGTH'));
  check('validation-rules expone TOLERANCIA_MAX', validationRules.includes('TOLERANCIA_MAX'));
  check('validation-rules expone GPS_RADIUS_MAX', validationRules.includes('GPS_RADIUS_MAX'));
  check('date-helpers expone toISODate', dateHelpers.includes('toISODate'));
  check('date-helpers expose addDays', dateHelpers.includes('addDays'));
  check('date-helpers expose startOfWeek', dateHelpers.includes('startOfWeek'));
  check('personal.js usa CPC.StringHelpers', read('js/modules/personal.js').includes('CPC.StringHelpers'));
  check('personal.js usa CPC.PhotoHelpers', read('js/modules/personal.js').includes('CPC.PhotoHelpers'));
  check('validators.js usa CPC.ValidationRules', read('js/utils/validators.js').includes('window.CPC?.ValidationRules'));
  check('dashboard.js usa CPC.DateHelpers', read('js/modules/dashboard.js').includes('window.CPC?.DateHelpers') || read('js/modules/dashboard.js').includes('CPC.DateHelpers'));
  check('reportes.js usa CPC.DateHelpers', read('js/modules/reportes.js').includes('window.CPC?.DateHelpers') || read('js/modules/reportes.js').includes('CPC.DateHelpers'));
}

function fieldScannerChecks() {
  console.log('\n── Field Scanner standalone');
  const scannerHtml = read('field-scanner.html');
  const scannerJs = read('field-scanner.js');
  check('field-scanner.html existe', fs.existsSync(path.join(ROOT, 'field-scanner.html')));
  check('field-scanner.js existe', fs.existsSync(path.join(ROOT, 'field-scanner.js')));
  check('field-scanner incluye Firebase CDN', scannerHtml.includes('firebase-app-compat.js') && scannerHtml.includes('firebase-firestore-compat.js'));
  check('field-scanner incluye html5-qrcode', scannerHtml.includes('html5-qrcode'));
  check('field-scanner incluye lucide icons', scannerHtml.includes('lucide'));
  check('field-scanner enlaza a field-scanner.js', scannerHtml.includes('field-scanner.js'));
  check('field-scanner expone FieldScanner global', scannerJs.includes('window.FieldScanner'));
  check('field-scanner inicializa Firestore', scannerJs.includes('firebase.firestore()'));
  check('field-scanner suscribe a asistencias', scannerJs.includes("db.collection('asistencias')"));
  check('field-scanner guarda en Firestore', scannerJs.includes("collection('asistencias').add"));
  check('field-scanner parsea QR', scannerJs.includes('parseQRData'));
  check('field-scanner busca trabajador local', scannerJs.includes('cpc_personal_cache'));
  check('field-scanner captura GPS', scannerJs.includes('navigator.geolocation'));
  check('field-scanner soporta offline queue', scannerJs.includes('localStorage'));
  check('field-scanner tiene login section', scannerHtml.includes('id="login-section"'));
  check('field-scanner tiene input PIN', scannerHtml.includes('id="login-pin"'));
  check('field-scanner tiene formulario login', scannerHtml.includes('id="login-form"'));
  check('field-scanner valida PIN', scannerJs.includes('requirePin'));
  check('field-scanner guarda sesión', scannerJs.includes('field_scanner_session'));
  check('field-scanner cierra sesión', scannerJs.includes('removeItem(SESSION_KEY)') || scannerJs.includes('field_scanner_session'));
  check('field-scanner oculta scanner sin login', scannerJs.includes('scannerSection.hidden = true'));
  check('field-scanner muestra scanner con login', scannerJs.includes('scannerSection.hidden = false'));
  check('Ajustes incluye campo PIN scanner', read('index.html').includes('id="cfg-scanner-pin"'));
  check('Ajustes guarda PIN en localStorage', read('js/modules/ajustes.js').includes('cpc_field_scanner_pin'));
  check('field-scanner incluye auditoría', scannerJs.includes('saveAuditLog'));
  check('field-scanner registra operador', scannerJs.includes('getOperatorInfo'));
  check('field-scanner registra dispositivo', scannerJs.includes('getDeviceInfo'));
  check('field-scanner guarda log en localStorage', scannerJs.includes('field_scanner_audit_log'));
  check('field-scanner registra errores', scannerJs.includes('saveErrorLog'));
  check('field-scanner es PWA instalable', scannerHtml.includes('field-scanner-manifest.json'));
  check('field-scanner tiene service worker', scannerHtml.includes('field-scanner-sw.js'));
  check('field-scanner manifest es standalone', read('field-scanner-manifest.json').includes('"display": "standalone"'));
  check('Ajustes muestra auditoría scanner', read('index.html').includes('id="btn-load-scanner-audit"'));
  check('Ajustes limpia auditoría scanner', read('index.html').includes('id="btn-clear-scanner-audit"'));
  check('Ajustes renderiza log scanner', read('js/modules/ajustes.js').includes('_mostrarAuditoriaScanner'));
  check('Ajustes elimina log scanner', read('js/modules/ajustes.js').includes('_limpiarAuditoriaScanner'));
  check('Ajustes exporta auditoría scanner CSV', read('js/modules/ajustes.js').includes('_exportarAuditoriaScannerCSV'));
  check('Ajustes incluye botón exportar CSV', read('index.html').includes('id="btn-export-scanner-audit"'));
  check('Ajustes incluye botón WhatsApp', read('index.html').includes('id="btn-share-scanner-whatsapp"'));
  check('Ajustes comparte por WhatsApp', read('js/modules/ajustes.js').includes('_compartirScannerWhatsApp'));
  check('Ajustes usa wa.me para compartir', read('js/modules/ajustes.js').includes('wa.me'));
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗\n║          CONTROL PERSONAL CAMPO — TEST SUITE                    ║\n╚══════════════════════════════════════════════════════════════════╝');
  htmlChecks(); validatorChecks(); dpiDuplicateChecks(); formInputChecks(); businessChecks(); helpersChecks(); fieldScannerChecks();

  // Unit test files
  console.log('\n── Tests unitarios');
  check('string-helpers.test.js creado', fs.existsSync(path.join(ROOT, '__tests__/unit/string-helpers.test.js')));
  check('photo-helpers.test.js creado', fs.existsSync(path.join(ROOT, '__tests__/unit/photo-helpers.test.js')));
  check('personal.test.js creado', fs.existsSync(path.join(ROOT, '__tests__/unit/personal.test.js')));

  console.log(`\n════════════════════════════════════════════════════════════\n  Total: ${pass + fail}  |  PASS: ${pass}  |  FAIL: ${fail}`);
  if (fail) { console.log('  Fallos:'); failures.forEach(item => console.log(`    - ${item}`)); }
  process.exitCode = fail ? 1 : 0;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
