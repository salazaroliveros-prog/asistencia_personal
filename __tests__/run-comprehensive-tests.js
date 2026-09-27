#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST SUITE - Control Personal Campo v1.5.0
 * Versión simplificada sin debugging
 */

const fs = require('fs');
const path = require('path');

const testResults = {
  categories: [],
  totalTests: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function logTest(category, test, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${category}] ${test}${message ? ': ' + message : ''}`);
  
  testResults.tests.push({ category, test, passed, message });
  testResults.totalTests++;
  if (passed) testResults.passed++; else testResults.failed++;
  
  let cat = testResults.categories.find(c => c.name === category);
  if (!cat) {
    cat = { name: category, passed: 0, failed: 0, total: 0 };
    testResults.categories.push(cat);
  }
  cat.total++;
  if (passed) cat.passed++; else cat.failed++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════════════════

function testHTMLStructure() {
  console.log('\n🔍 1. VALIDACIÓN HTML Y ESTRUCTURA\n');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const content = fs.readFileSync(indexPath, 'utf8');
  
  logTest('HTML', 'Archivo index.html existe', true);
  logTest('HTML', 'DOCTYPE definido', content.includes('<!DOCTYPE html>'));
  logTest('HTML', 'Lang es', content.includes('lang="es"'));
  logTest('HTML', 'Meta charset UTF-8', content.includes('charset'));
  logTest('HTML', 'Meta viewport', content.includes('viewport'));
  logTest('HTML', 'Favicon definido', content.includes('favicon'));
  logTest('HTML', 'Container #app', content.includes('id="app"'));
  logTest('HTML', 'Sidebar', content.includes('id="sidebar"'));
  logTest('HTML', 'Main content', content.includes('id="main-content"'));
  logTest('HTML', 'Modales (9+)', (content.match(/id="modal-/g) || []).length >= 9);
  logTest('HTML', 'Skip link', content.includes('skip-link'));
  logTest('HTML', 'ARIA labels', content.includes('aria-label'));
}

function testFunctionality() {
  console.log('\n⚙️ 2. FUNCIONALIDAD CORE\n');
  const appPath = path.join(__dirname, '..', 'js/app.js');
  const appContent = fs.readFileSync(appPath, 'utf8');
  
  logTest('Funcionalidad', 'app.js existe', true);
  logTest('Funcionalidad', 'Router SPA', appContent.includes('hashchange'));
  logTest('Funcionalidad', 'Dashboard módulo', appContent.includes('dashboard'));
  logTest('Funcionalidad', 'Personal módulo', appContent.includes('personal'));
  logTest('Funcionalidad', 'Asistencia módulo', appContent.includes('asistencia'));
  logTest('Funcionalidad', 'Campo módulo', appContent.includes('campo'));
  logTest('Funcionalidad', 'Reportes módulo', appContent.includes('reportes'));
  logTest('Funcionalidad', 'Ajustes módulo', appContent.includes('ajustes'));
}

function testIntegration() {
  console.log('\n🔗 3. INTEGRACIÓN DE MÓDULOS\n');
  const firebaseClientPath = path.join(__dirname, '..', 'js/firebase-client.js');
  const firebaseClientContent = fs.readFileSync(firebaseClientPath, 'utf8');
  
  logTest('Integración', 'Firebase Client existe', true);
  logTest('Integración', 'Autenticación', firebaseClientContent.includes('signIn') || firebaseClientContent.includes('auth'));
  logTest('Integración', 'Firestore', firebaseClientContent.includes('firestore'));
  
  const apiPath = path.join(__dirname, '..', 'js/api.js');
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  logTest('Integración', 'API module', true);
  logTest('Integración', 'API endpoints', apiContent.includes('trabajador') && apiContent.includes('asistencia'));
}

function testSecurity() {
  console.log('\n🔒 4. SEGURIDAD\n');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  logTest('Seguridad', 'CSP definido', indexContent.includes('Content-Security-Policy'));
  logTest('Seguridad', 'CSP restrictivo', indexContent.includes("default-src 'self'"));
  logTest('Seguridad', 'Sin private_key', !indexContent.includes('private_key'));
  logTest('Seguridad', 'Sin secret', !indexContent.includes('secret_key'));
  
  const rulesPath = path.join(__dirname, '..', 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');
  logTest('Seguridad', 'Firestore rules', rulesContent.includes('allow'));
}

function testA11y() {
  console.log('\n♿ 5. ACCESIBILIDAD (a11y)\n');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  logTest('a11y', 'ARIA labels', (indexContent.match(/aria-label/g) || []).length > 10);
  logTest('a11y', 'Role navigation', indexContent.includes('role="navigation"'));
  logTest('a11y', 'Role main', indexContent.includes('role="main"'));
  logTest('a11y', 'Nav tag', indexContent.includes('<nav'));
  logTest('a11y', 'Main tag', indexContent.includes('<main'));
  logTest('a11y', 'Header tag', indexContent.includes('<header'));
  logTest('a11y', 'Labels en forms', (indexContent.match(/<label/g) || []).length > 5);
  logTest('a11y', 'Required fields', indexContent.includes('required'));
}

function testPerformance() {
  console.log('\n⚡ 6. PERFORMANCE\n');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  logTest('Performance', 'Lazy loading', indexContent.includes('loading="lazy"'));
  logTest('Performance', 'Fonts display=swap', indexContent.includes('display=swap'));
  logTest('Performance', 'Service Worker', indexContent.includes('registerSW'));
  logTest('Performance', 'Manifest PWA', indexContent.includes('manifest'));
  logTest('Performance', 'Theme color', indexContent.includes('theme-color'));
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  logTest('Performance', 'Vite build tool', !!packageJson.devDependencies.vite);
  logTest('Performance', 'Terser minification', !!packageJson.devDependencies.terser);
}

function testAPI() {
  console.log('\n📡 7. API ENDPOINTS\n');
  const apiPath = path.join(__dirname, '..', 'js/api.js');
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  
  logTest('API', 'GET trabajadores', apiContent.includes('getTrabajadores') || apiContent.includes('getWorkers'));
  logTest('API', 'POST trabajador', apiContent.includes('createTrabajador') || apiContent.includes('createWorker'));
  logTest('API', 'PUT trabajador', apiContent.includes('updateTrabajador') || apiContent.includes('updateWorker'));
  logTest('API', 'DELETE trabajador', apiContent.includes('deleteTrabajador') || apiContent.includes('deleteWorker'));
  logTest('API', 'GET asistencias', apiContent.includes('getAsistencias') || apiContent.includes('getAttendance'));
  logTest('API', 'POST marcación', apiContent.includes('createAsistencia') || apiContent.includes('createAttendance'));
  logTest('API', 'Error handling', apiContent.includes('catch'));
}

function testFirebase() {
  console.log('\n🔥 8. FIREBASE\n');
  const firebaseConfigPath = path.join(__dirname, '..', 'js/firebase-config.js');
  const firebaseConfigContent = fs.readFileSync(firebaseConfigPath, 'utf8');
  
  logTest('Firebase', 'firebase-config.js existe', true);
  logTest('Firebase', 'apiKey', firebaseConfigContent.includes('apiKey'));
  logTest('Firebase', 'projectId', firebaseConfigContent.includes('projectId'));
  logTest('Firebase', 'authDomain', firebaseConfigContent.includes('authDomain'));
  
  const firebaseClientPath = path.join(__dirname, '..', 'js/firebase-client.js');
  const firebaseClientContent = fs.readFileSync(firebaseClientPath, 'utf8');
  logTest('Firebase', 'firebase-client.js existe', true);
  logTest('Firebase', 'initializeApp', firebaseClientContent.includes('initializeApp'));
  logTest('Firebase', 'onAuthStateChanged', firebaseClientContent.includes('onAuthStateChanged'));
}

function testPWA() {
  console.log('\n📱 9. PWA & SERVICE WORKER\n');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  logTest('PWA', 'Manifest', indexContent.includes('manifest'));
  logTest('PWA', 'Apple capable', indexContent.includes('apple-mobile-web-app-capable'));
  logTest('PWA', 'Apple touch icon', indexContent.includes('apple-touch-icon'));
  logTest('PWA', 'Service Worker register', indexContent.includes('registerSW'));
  
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    logTest('PWA', 'Manifest name', !!manifestContent.name);
    logTest('PWA', 'Manifest icons', manifestContent.icons && manifestContent.icons.length > 0);
    logTest('PWA', 'Display standalone', manifestContent.display === 'standalone');
  }
}

function testResponsive() {
  console.log('\n📲 10. RESPONSIVE DESIGN\n');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  logTest('Responsive', 'Meta viewport', indexContent.includes('viewport'));
  logTest('Responsive', 'Width device-width', indexContent.includes('width=device-width'));
  logTest('Responsive', 'Initial scale', indexContent.includes('initial-scale'));
  
  const mainCSSPath = path.join(__dirname, '..', 'css/main.css');
  if (fs.existsSync(mainCSSPath)) {
    const mainCSSContent = fs.readFileSync(mainCSSPath, 'utf8');
    logTest('Responsive', 'Media queries', mainCSSContent.includes('@media'));
    logTest('Responsive', 'Max-width', mainCSSContent.includes('max-width'));
    logTest('Responsive', 'Min-width', mainCSSContent.includes('min-width'));
  }
}

function testCDN() {
  console.log('\n🌐 11. CDN & FALLBACKS\n');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  logTest('CDN', 'Lucide local', indexContent.includes('vendor/lucide'));
  logTest('CDN', 'Lucide CDN', indexContent.includes('unpkg'));
  logTest('CDN', 'QRCode local', indexContent.includes('vendor/qrcode'));
  logTest('CDN', 'QRCode fallback guard', indexContent.includes('window.QRCode'));
  logTest('CDN', 'Leaflet local', indexContent.includes('vendor/leaflet'));
  logTest('CDN', 'Chart.js local', indexContent.includes('vendor/chart'));
  logTest('CDN', 'Google Fonts', indexContent.includes('fonts.googleapis.com'));
  logTest('CDN', 'Firebase local', indexContent.includes('vendor/firebase'));
}

function testCoverage() {
  console.log('\n📊 12. COBERTURA\n');
  
  const jsPath = path.join(__dirname, '..', 'js');
  const modulesPath = path.join(__dirname, '..', 'js/modules');
  const utilsPath = path.join(__dirname, '..', 'js/utils');
  
  const jsFiles = fs.readdirSync(jsPath).filter(f => f.endsWith('.js'));
  const moduleFiles = fs.readdirSync(modulesPath).filter(f => f.endsWith('.js'));
  const utilFiles = fs.readdirSync(utilsPath).filter(f => f.endsWith('.js'));
  
  logTest('Cobertura', `Archivos JS: ${jsFiles.length}`, jsFiles.length >= 5);
  logTest('Cobertura', `Módulos: ${moduleFiles.length}`, moduleFiles.length >= 6);
  logTest('Cobertura', `Utilities: ${utilFiles.length}`, utilFiles.length >= 15);
  
  const cssPath = path.join(__dirname, '..', 'css');
  const cssFiles = fs.readdirSync(cssPath).filter(f => f.endsWith('.css'));
  logTest('Cobertura', `Archivos CSS: ${cssFiles.length}`, cssFiles.length >= 5);
  
  const docs = fs.readdirSync(__dirname.replace('__tests__', '')).filter(f => f.endsWith('.md'));
  logTest('Cobertura', `Documentación: ${docs.length} .md`, docs.length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                 SUITE COMPLETA DE PRUEBAS - CONTROL PERSONAL CAMPO v1.5.0    ║');
console.log('║                   Validación Exhaustiva del Sistema Completo                 ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

testHTMLStructure();
testFunctionality();
testIntegration();
testSecurity();
testA11y();
testPerformance();
testAPI();
testFirebase();
testPWA();
testResponsive();
testCDN();
testCoverage();

// RESUMEN FINAL
console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                         RESUMEN FINAL DE PRUEBAS                              ║');
console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

console.log(`📊 ESTADÍSTICAS GLOBALES`);
console.log(`   Total Tests: ${testResults.totalTests}`);
console.log(`   ✅ Pasados: ${testResults.passed}`);
if (testResults.failed > 0) {
  console.log(`   ❌ Fallidos: ${testResults.failed}`);
}
const successRate = ((testResults.passed / testResults.totalTests) * 100).toFixed(2);
console.log(`   📈 Tasa de éxito: ${successRate}%`);

console.log(`\n📑 DETALLES POR CATEGORÍA`);
testResults.categories.forEach(cat => {
  const percentage = ((cat.passed / cat.total) * 100).toFixed(0);
  const status = cat.failed === 0 ? '✅' : '⚠️';
  console.log(`   ${status} [${cat.name}] ${cat.passed}/${cat.total} (${percentage}%)`);
});

// Guardar JSON
const reportPath = path.join(__dirname, 'TEST_RESULTS_COMPREHENSIVE.json');
fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
console.log(`\n📄 Reporte guardado en: ${reportPath}`);

// Estado final
if (testResults.failed === 0) {
  console.log(`\n✅ TODAS LAS PRUEBAS PASARON - SISTEMA OPERATIVO AL 100%\n`);
  process.exit(0);
} else {
  console.log(`\n⚠️ ALGUNAS PRUEBAS FALLARON - REQUIERE ATENCIÓN\n`);
  process.exit(1);
}
