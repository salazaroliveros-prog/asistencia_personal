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
  for (const id of ['app','splash-screen','sidebar','toast-container','kpi-total','kpi-asistencia','kpi-tardanzas','kpi-ausencias','calendar-grid','qr-reader','modal-personal','modal-carne','asistencia-tbody','modal-horas-extra','gas-url','btn-test-connection','modal-dia-calendario','modal-dia-content']) check(`ID crítico #${id}`, html.includes(`id="${id}"`));
  check('5 páginas SPA declaradas', ['dashboard','personal','asistencia','reportes','ajustes'].every(p => html.includes(`id="page-${p}"`)));
}

function validatorChecks() {
  console.log('\n── Validadores unitarios');
  const context = vm.createContext({ module: { exports: {} }, console });
  vm.runInContext(read('js/utils/validators.js'), context);
  const V = context.Validators || context.module.exports;
  const cases = [['DPI válido',V.validateDPI('2512345678901').valid],['DPI inválido',!V.validateDPI('251234567890').valid],['teléfono local',V.validateTelefono('55123456').valid],['teléfono internacional',V.validateTelefono('+502 5512-3456').valid],['teléfono corto inválido',!V.validateTelefono('5512345').valid],['nombre válido',V.validateNombre('Roberto Lima').valid],['hora válida',V.validateHora('07:00').valid],['hora inválida',!V.validateHora('25:00').valid],['tolerancia válida',V.validateTolerancia(15).valid],['trabajador completo',V.validateTrabajador({nombre:'Juan',dpi:'2512345678901',telefono:'55123456'}).valid]];
  for (const [label, result] of cases) check(label, result);
}

function businessChecks() {
  console.log('\n── Lógica de negocio');
  const pdf = read('js/utils/pdf-builder.js'); const asistencia = read('js/modules/asistencia.js'); const personal = read('js/modules/personal.js'); const gas = read('gas/Code.gs');
  check('PDF usa Metodo_Registro', pdf.includes('Metodo_Registro') && !pdf.includes('a.Metodo ==='));
  check('PDF usa lookup eficiente de personal', pdf.includes('personalMap') || pdf.includes('new Map'));
  check('Asistencia conserva Metodo_Registro', asistencia.includes('Metodo_Registro'));
  check('Asistencia offline conserva Ubicacion_Obra', asistencia.includes('Ubicacion_Obra:'));
  check('Sábado contado como día hábil', personal.includes('dow !== 0'));
  check('Horas extra usan configuración', gas.includes('Hora_Salida_Obra') && !gas.includes('17 * 60 + 15'));
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗\n║          CONTROL PERSONAL CAMPO — TEST SUITE                    ║\n╚══════════════════════════════════════════════════════════════════╝');
  htmlChecks(); validatorChecks(); businessChecks();
  console.log(`\n════════════════════════════════════════════════════════════\n  Total: ${pass + fail}  |  PASS: ${pass}  |  FAIL: ${fail}`);
  if (fail) { console.log('  Fallos:'); failures.forEach(item => console.log(`    - ${item}`)); }
  process.exitCode = fail ? 1 : 0;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
