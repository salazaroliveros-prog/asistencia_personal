const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
let ok = 0, fail = 0;

function check(label, condition) {
  if (condition) { console.log('  OK  ' + label); ok++; }
  else           { console.log('  FAIL ' + label); fail++; }
}

// 1. IDs únicos
const idRegex = / id="([^"]+)"/g;
const idCounts = {};
let m;
while ((m = idRegex.exec(html)) !== null) {
  idCounts[m[1]] = (idCounts[m[1]] || 0) + 1;
}
const dupIds = Object.entries(idCounts).filter(function(e){ return e[1] > 1; });
check('IDs únicos sin duplicados (' + Object.keys(idCounts).length + ' IDs)', dupIds.length === 0);
if (dupIds.length > 0) {
  dupIds.forEach(function(e){ console.log('       Duplicado: ' + e[0] + ' (x' + e[1] + ')'); });
}

// 2. Scripts locales existen
const scriptRegex = /src="(js\/[^"]+)"/g;
while ((m = scriptRegex.exec(html)) !== null) {
  const p = m[1];
  check('Script existe: ' + p, fs.existsSync(p));
}

// 3. CSS local existe
const cssRegex = /href="(css\/[^"]+)"/g;
while ((m = cssRegex.exec(html)) !== null) {
  const p = m[1];
  check('CSS existe: ' + p, fs.existsSync(p));
}

// 4. Páginas declaradas (data-page en elementos section/div)
const spaPages = ['dashboard', 'personal', 'asistencia', 'campo', 'reportes', 'ajustes'];
const pageIds = spaPages.filter(function(p) {
  return html.indexOf('id="page-' + p + '"') !== -1;
});
check('6 páginas SPA declaradas (dashboard/personal/asistencia/campo/reportes/ajustes)', pageIds.length === 6);
console.log('    Páginas encontradas: ' + pageIds.join(', '));

// 5. IDs críticos presentes
const criticalIds = [
  'app', 'splash-screen', 'sidebar', 'toast-container',
  'kpi-total', 'kpi-asistencia', 'kpi-tardanzas', 'kpi-ausencias',
  'calendar-grid', 'qr-reader', 'modal-personal', 'modal-carne',
  'asistencia-tbody', 'modal-horas-extra',
  'firebase-project-id', 'btn-connect-firebase',
  'modal-dia-calendario', 'modal-dia-content'
];
criticalIds.forEach(function(id) {
  check('ID crítico #' + id, html.indexOf('id="' + id + '"') !== -1);
});

// 6. Resumen
console.log('\n=== RESULTADO: ' + ok + ' OK / ' + fail + ' FAIL ===');
if (fail === 0) console.log('La estructura HTML es correcta.');
else            console.log('HAY ERRORES en la estructura HTML.');
process.exit(fail > 0 ? 1 : 0);
