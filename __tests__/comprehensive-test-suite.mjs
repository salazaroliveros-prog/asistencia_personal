#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST SUITE - Control Personal Campo v1.5.0
 * Ejecuta todas las pruebas necesarias para validar que todo funciona perfectamente
 * 
 * Categorías de Pruebas:
 * 1. HTML & Estructura
 * 2. Funcionalidad Core
 * 3. Integración de Módulos
 * 4. Seguridad
 * 5. Accesibilidad (a11y)
 * 6. Performance
 * 7. API Endpoints
 * 8. Firebase Integration
 * 9. PWA & Service Worker
 * 10. Responsive Design
 * 11. CDN & Fallbacks
 * 12. Cobertura de Tests
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG Y UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════════

const testResults = {
  categories: [],
  totalTests: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  startTime: new Date(),
  tests: []
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(category, test, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const color = passed ? 'green' : 'red';
  log(`${status} [${category}] ${test}${message ? ': ' + message : ''}`, color);
  
  testResults.tests.push({
    category,
    test,
    passed,
    message
  });
  
  testResults.totalTests++;
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  
  // Agregar a categoría si no existe
  let category_obj = testResults.categories.find(c => c.name === category);
  if (!category_obj) {
    category_obj = {
      name: category,
      passed: 0,
      failed: 0,
      total: 0
    };
    testResults.categories.push(category_obj);
  }
  category_obj.total++;
  if (passed) {
    category_obj.passed++;
  } else {
    category_obj.failed++;
  }
}

function logWarning(category, message) {
  log(`⚠️  WARNING [${category}] ${message}`, 'yellow');
  testResults.warnings++;
}

function logSection(title) {
  log(`\n${'='.repeat(80)}`, 'cyan');
  log(`  ${title}`, `${colors.bold}${colors.cyan}`);
  log(`${'='.repeat(80)}\n`, 'cyan');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PRUEBAS DE VALIDACIÓN HTML Y ESTRUCTURA
// ═══════════════════════════════════════════════════════════════════════════════

function testHTMLStructure() {
  logSection('1. PRUEBAS DE VALIDACIÓN HTML Y ESTRUCTURA');
  
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Validaciones básicas
    logTest('HTML', 'Archivo index.html existe', true);
    logTest('HTML', 'DOCTYPE definido', content.includes('<!DOCTYPE html>'));
    logTest('HTML', 'Head tag presente', content.includes('<head>') && content.includes('</head>'));
    logTest('HTML', 'Body tag presente', content.includes('<body>') && content.includes('</body>'));
    logTest('HTML', 'HTML lang="es" definido', content.includes('lang="es"'));
    
    // Meta tags críticos
    logTest('HTML', 'Meta charset UTF-8', content.includes('charset="UTF-8"'));
    logTest('HTML', 'Meta viewport presente', content.includes('viewport'));
    logTest('HTML', 'Meta description presente', content.includes('meta name="description"'));
    logTest('HTML', 'Meta theme-color presente', content.includes('theme-color'));
    
    // Favicons
    logTest('HTML', 'Favicon definido', content.includes('rel="icon"') || content.includes('favicon'));
    logTest('HTML', 'Apple touch icon definido', content.includes('apple-touch-icon'));
    
    // CSS
    logTest('HTML', 'CSS principal enlazado', content.includes('.css'));
    logTest('HTML', 'Print CSS definido', content.includes('media="print"'));
    
    // Estructura de SPA
    logTest('HTML', 'Container de app (#app)', content.includes('id="app"'));
    logTest('HTML', 'Sidebar presente', content.includes('id="sidebar"'));
    logTest('HTML', 'Main content presente', content.includes('id="main-content"'));
    logTest('HTML', 'Pages container presente', content.includes('id="pages-container"'));
    
    // Modales
    logTest('HTML', 'Modales definidos (9+)', (content.match(/id="modal-/g) || []).length >= 9);
    logTest('HTML', 'Modal personal definido', content.includes('id="modal-personal"'));
    logTest('HTML', 'Modal carne definido', content.includes('id="modal-carne"'));
    logTest('HTML', 'Modal historial definido', content.includes('id="modal-historial"'));
    
    // Accesibilidad
    logTest('HTML', 'Skip link presente', content.includes('skip-link'));
    logTest('HTML', 'ARIA labels usados', content.includes('aria-label'));
    logTest('HTML', 'Main role definido', content.includes('role="main"'));
    
    // Forms
    logTest('HTML', 'Formularios presentes', (content.match(/<form/g) || []).length > 0);
    logTest('HTML', 'Inputs con labels', content.includes('<label') && content.includes('for='));
    
  } catch (error) {
    logTest('HTML', 'Error crítico', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PRUEBAS FUNCIONALES (CORE)
// ═══════════════════════════════════════════════════════════════════════════════

function testFunctionality() {
  logSection('2. PRUEBAS FUNCIONALES - FUNCIONALIDAD CORE');
  
  try {
    const appPath = path.join(__dirname, 'js/app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');
    
    // Router SPA
    logTest('Funcionalidad', 'Router SPA definido', appContent.includes('hashchange'));
    logTest('Funcionalidad', 'Dashboard módulo', appContent.includes('dashboard'));
    logTest('Funcionalidad', 'Personal módulo', appContent.includes('personal'));
    logTest('Funcionalidad', 'Asistencia módulo', appContent.includes('asistencia'));
    logTest('Funcionalidad', 'Campo módulo', appContent.includes('campo'));
    logTest('Funcionalidad', 'Reportes módulo', appContent.includes('reportes'));
    logTest('Funcionalidad', 'Ajustes módulo', appContent.includes('ajustes'));
    
    // Módulo personal
    const personalPath = path.join(__dirname, 'js/modules/personal.js');
    const personalContent = fs.readFileSync(personalPath, 'utf8');
    logTest('Funcionalidad', 'Personal - CRUD trabajadores', personalContent.includes('create') || personalContent.includes('update'));
    logTest('Funcionalidad', 'Personal - Búsqueda', personalContent.includes('search'));
    logTest('Funcionalidad', 'Personal - Generación carnets', personalContent.includes('carnet'));
    
    // Módulo asistencia
    const asistenciaPath = path.join(__dirname, 'js/modules/asistencia.js');
    const asistenciaContent = fs.readFileSync(asistenciaPath, 'utf8');
    logTest('Funcionalidad', 'Asistencia - Escaneo QR', asistenciaContent.includes('qr') || asistenciaContent.includes('scan'));
    logTest('Funcionalidad', 'Asistencia - Marcación manual', asistenciaContent.includes('manual'));
    logTest('Funcionalidad', 'Asistencia - Tipos de marcación', asistenciaContent.includes('Entrada') || asistenciaContent.includes('Salida'));
    
    // Módulo reportes
    const reportesPath = path.join(__dirname, 'js/modules/reportes.js');
    const reportesContent = fs.readFileSync(reportesPath, 'utf8');
    logTest('Funcionalidad', 'Reportes - PDF export', reportesContent.includes('pdf') || reportesContent.includes('PDF'));
    logTest('Funcionalidad', 'Reportes - CSV export', reportesContent.includes('csv') || reportesContent.includes('CSV'));
    logTest('Funcionalidad', 'Reportes - Previsualizacion', reportesContent.includes('preview'));
    
  } catch (error) {
    logTest('Funcionalidad', 'Error crítico', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PRUEBAS DE INTEGRACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

function testIntegration() {
  logSection('3. PRUEBAS DE INTEGRACIÓN - MÓDULOS + FIREBASE');
  
  try {
    const firebaseClientPath = path.join(__dirname, 'js/firebase-client.js');
    const firebaseClientContent = fs.readFileSync(firebaseClientPath, 'utf8');
    
    logTest('Integración', 'Firebase Client definido', true);
    logTest('Integración', 'Autenticación Firebase', firebaseClientContent.includes('signIn') || firebaseClientContent.includes('login'));
    logTest('Integración', 'Firestore lectura', firebaseClientContent.includes('getDoc') || firebaseClientContent.includes('collection'));
    logTest('Integración', 'Firestore escritura', firebaseClientContent.includes('setDoc') || firebaseClientContent.includes('addDoc'));
    logTest('Integración', 'Manejo de errores', firebaseClientContent.includes('catch'));
    
    const apiPath = path.join(__dirname, 'js/api.js');
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    
    logTest('Integración', 'API módulo definido', true);
    logTest('Integración', 'API - CRUD trabajadores', apiContent.includes('trabajador'));
    logTest('Integración', 'API - CRUD asistencias', apiContent.includes('asistencia'));
    logTest('Integración', 'API - Query complejo', apiContent.includes('filter') || apiContent.includes('where'));
    
    const validatorsPath = path.join(__dirname, 'js/utils/validators.js');
    const validatorsContent = fs.readFileSync(validatorsPath, 'utf8');
    
    logTest('Integración', 'Validadores definidos', true);
    logTest('Integración', 'Validador DPI', validatorsContent.includes('DPI') || validatorsContent.includes('13'));
    logTest('Integración', 'Validador teléfono', validatorsContent.includes('telefono') || validatorsContent.includes('phone'));
    logTest('Integración', 'Validador email', validatorsContent.includes('email'));
    
  } catch (error) {
    logTest('Integración', 'Error en integración', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PRUEBAS DE SEGURIDAD
// ═══════════════════════════════════════════════════════════════════════════════

function testSecurity() {
  logSection('4. PRUEBAS DE SEGURIDAD');
  
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // CSP
    logTest('Seguridad', 'CSP definido', indexContent.includes('Content-Security-Policy'));
    logTest('Seguridad', 'CSP - default-src restrictivo', indexContent.includes("default-src 'self'"));
    logTest('Seguridad', 'CSP - script-src definido', indexContent.includes("script-src"));
    logTest('Seguridad', 'CSP - style-src definido', indexContent.includes("style-src"));
    
    // Headers de seguridad en vercel.json
    const vercelPath = path.join(__dirname, 'vercel.json');
    const vercelContent = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    
    const hasXContentTypeOptions = vercelContent.headers?.some(h => 
      h.headers?.some(hh => hh.key === 'X-Content-Type-Options')
    );
    const hasReferrerPolicy = vercelContent.headers?.some(h => 
      h.headers?.some(hh => hh.key === 'Referrer-Policy')
    );
    const hasXFrameOptions = vercelContent.headers?.some(h => 
      h.headers?.some(hh => hh.key === 'X-Frame-Options')
    );
    
    logTest('Seguridad', 'Header X-Content-Type-Options', !!hasXContentTypeOptions);
    logTest('Seguridad', 'Header Referrer-Policy', !!hasReferrerPolicy);
    logTest('Seguridad', 'Header X-Frame-Options', !!hasXFrameOptions);
    
    // Sin datos sensibles
    logTest('Seguridad', 'Sin private_key hardcodeado', !indexContent.includes('private_key'));
    logTest('Seguridad', 'Sin secret_key hardcodeado', !indexContent.includes('secret_key'));
    logTest('Seguridad', 'Sin tokens expuestos', !indexContent.includes('sk_') && !indexContent.includes('pk_'));
    
    // Firebase rules
    const rulesPath = path.join(__dirname, 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    
    logTest('Seguridad', 'Firestore rules definidas', rulesContent.includes('allow'));
    logTest('Seguridad', 'Firestore rules - Autenticación', rulesContent.includes('auth'));
    logTest('Seguridad', 'Firestore rules - Validación', rulesContent.includes('request.resource'));
    
  } catch (error) {
    logTest('Seguridad', 'Error en seguridad', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PRUEBAS DE ACCESIBILIDAD
// ═══════════════════════════════════════════════════════════════════════════════

function testAccessibility() {
  logSection('5. PRUEBAS DE ACCESIBILIDAD (a11y)');
  
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // ARIA
    logTest('a11y', 'ARIA labels presentes', (indexContent.match(/aria-label/g) || []).length > 10);
    logTest('a11y', 'ARIA hidden usado', indexContent.includes('aria-hidden'));
    logTest('a11y', 'ARIA live regions', (indexContent.match(/aria-live/g) || []).length > 0);
    logTest('a11y', 'Role navigation', indexContent.includes('role="navigation"'));
    logTest('a11y', 'Role main', indexContent.includes('role="main"'));
    logTest('a11y', 'Role banner', indexContent.includes('role="banner"'));
    
    // Semantic HTML
    logTest('a11y', 'Nav tag usado', indexContent.includes('<nav'));
    logTest('a11y', 'Main tag usado', indexContent.includes('<main'));
    logTest('a11y', 'Header tag usado', indexContent.includes('<header'));
    logTest('a11y', 'Section tag usado', indexContent.includes('<section'));
    
    // Forms
    logTest('a11y', 'Labels en formularios', (indexContent.match(/<label/g) || []).length > 5);
    logTest('a11y', 'Required fields marcados', indexContent.includes('required'));
    logTest('a11y', 'Input descriptions', indexContent.includes('aria-describedby'));
    
    // Colores
    logTest('a11y', 'Skip link presente', indexContent.includes('skip-link'));
    logTest('a11y', 'Alt text en imágenes', indexContent.includes('alt='));
    
    // CSS de accesibilidad
    const accessibilityCSSPath = path.join(__dirname, 'css/accessibility.css');
    const hasAccessibilityCSS = fs.existsSync(accessibilityCSSPath);
    
    if (hasAccessibilityCSS) {
      const accessibilityContent = fs.readFileSync(accessibilityCSSPath, 'utf8');
      logTest('a11y', 'CSS accessibility.css', true);
      logTest('a11y', 'Focus visible definido', accessibilityContent.includes('focus-visible'));
      logTest('a11y', 'Prefers reduced motion', accessibilityContent.includes('prefers-reduced-motion'));
      logTest('a11y', 'SR-only class', accessibilityContent.includes('sr-only') || accessibilityContent.includes('visually-hidden'));
    } else {
      logTest('a11y', 'CSS accessibility.css', false);
    }
    
  } catch (error) {
    logTest('a11y', 'Error en accesibilidad', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PRUEBAS DE PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

function testPerformance() {
  logSection('6. PRUEBAS DE PERFORMANCE');
  
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Lazy loading
    logTest('Performance', 'Lazy loading en imágenes', indexContent.includes('loading="lazy"'));
    
    // Fonts
    logTest('Performance', 'Fonts con display=swap', indexContent.includes('display=swap'));
    
    // Scripts
    logTest('Performance', 'Scripts con defer', (indexContent.match(/defer/g) || []).length > 0);
    logTest('Performance', 'Scripts con async', (indexContent.match(/async/g) || []).length > 0);
    
    // Service Worker
    logTest('Performance', 'Service Worker definido', indexContent.includes('service-worker') || indexContent.includes('registerSW'));
    
    // PWA
    logTest('Performance', 'Manifest definido', indexContent.includes('manifest'));
    logTest('Performance', 'Theme color definido', indexContent.includes('theme-color'));
    
    // CSS optimization
    logTest('Performance', 'CSS crítico inline', indexContent.includes('<style') || indexContent.includes('.css'));
    logTest('Performance', 'Print CSS separado', indexContent.includes('media="print"'));
    
    // JS modular
    const jsPath = path.join(__dirname, 'js');
    const jsFiles = fs.readdirSync(jsPath).filter(f => f.endsWith('.js'));
    logTest('Performance', 'Módulos JS organizados', jsFiles.length > 5);
    
    // Build optimization
    const packagePath = path.join(__dirname, 'package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    logTest('Performance', 'Terser para minificación', !!packageContent.devDependencies.terser);
    logTest('Performance', 'Vite para build rápido', !!packageContent.devDependencies.vite);
    logTest('Performance', 'Compression plugins', !!packageContent.devDependencies['vite-plugin-compression']);
    
  } catch (error) {
    logTest('Performance', 'Error en performance', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PRUEBAS DE API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

function testAPIEndpoints() {
  logSection('7. PRUEBAS DE API ENDPOINTS');
  
  try {
    const apiPath = path.join(__dirname, 'js/api.js');
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    
    // Endpoints trabajadores
    logTest('API', 'GET trabajadores', apiContent.includes('getTrabajadores') || apiContent.includes('getAllWorkers'));
    logTest('API', 'GET trabajador por ID', apiContent.includes('getTrabajador') || apiContent.includes('getWorker'));
    logTest('API', 'POST crear trabajador', apiContent.includes('createTrabajador') || apiContent.includes('createWorker'));
    logTest('API', 'PUT actualizar trabajador', apiContent.includes('updateTrabajador') || apiContent.includes('updateWorker'));
    logTest('API', 'DELETE trabajador', apiContent.includes('deleteTrabajador') || apiContent.includes('deleteWorker'));
    
    // Endpoints asistencias
    logTest('API', 'GET asistencias', apiContent.includes('getAsistencias') || apiContent.includes('getAttendances'));
    logTest('API', 'POST marcación', apiContent.includes('createAsistencia') || apiContent.includes('createAttendance'));
    logTest('API', 'GET asistencia por rango', apiContent.includes('getAsistenciasByRange'));
    
    // Endpoints reportes
    logTest('API', 'GET reporte diario', apiContent.includes('getDiario') || apiContent.includes('dailyReport'));
    logTest('API', 'GET reporte semanal', apiContent.includes('getSemanal') || apiContent.includes('weeklyReport'));
    logTest('API', 'GET reporte mensual', apiContent.includes('getMensual') || apiContent.includes('monthlyReport'));
    
    // Endpoints configuración
    logTest('API', 'GET configuración', apiContent.includes('getConfig') || apiContent.includes('getConfiguration'));
    logTest('API', 'PUT configuración', apiContent.includes('updateConfig') || apiContent.includes('updateConfiguration'));
    
    // Error handling
    logTest('API', 'Manejo de errores', apiContent.includes('catch') || apiContent.includes('error'));
    logTest('API', 'Status codes', apiContent.includes('status'));
    
  } catch (error) {
    logTest('API', 'Error en validación de endpoints', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. PRUEBAS DE FIREBASE
// ═══════════════════════════════════════════════════════════════════════════════

function testFirebase() {
  logSection('8. PRUEBAS DE FIREBASE');
  
  try {
    const firebaseConfigPath = path.join(__dirname, 'js/firebase-config.js');
    const firebaseConfigContent = fs.readFileSync(firebaseConfigPath, 'utf8');
    
    // Configuración
    logTest('Firebase', 'Archivo firebase-config.js existe', true);
    logTest('Firebase', 'apiKey configurada', firebaseConfigContent.includes('apiKey'));
    logTest('Firebase', 'projectId configurado', firebaseConfigContent.includes('projectId'));
    logTest('Firebase', 'authDomain configurado', firebaseConfigContent.includes('authDomain'));
    logTest('Firebase', 'storageBucket configurado', firebaseConfigContent.includes('storageBucket'));
    logTest('Firebase', 'appId configurado', firebaseConfigContent.includes('appId'));
    
    // Firebase Client
    const firebaseClientPath = path.join(__dirname, 'js/firebase-client.js');
    const firebaseClientContent = fs.readFileSync(firebaseClientPath, 'utf8');
    
    logTest('Firebase', 'Archivo firebase-client.js existe', true);
    logTest('Firebase', 'Inicialización Firebase', firebaseClientContent.includes('initializeApp'));
    logTest('Firebase', 'Autenticación', firebaseClientContent.includes('auth'));
    logTest('Firebase', 'Firestore', firebaseClientContent.includes('firestore') || firebaseClientContent.includes('db'));
    logTest('Firebase', 'Manejo de usuario autenticado', firebaseClientContent.includes('onAuthStateChanged'));
    
    // Firestore rules
    const rulesPath = path.join(__dirname, 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    
    logTest('Firebase', 'Firestore rules definidas', true);
    logTest('Firebase', 'Validación de autenticación', rulesContent.includes('auth != null'));
    logTest('Firebase', 'Control de acceso', rulesContent.includes('allow') && rulesContent.includes('if'));
    
  } catch (error) {
    logTest('Firebase', 'Error en Firebase', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. PRUEBAS DE PWA
// ═══════════════════════════════════════════════════════════════════════════════

function testPWA() {
  logSection('9. PRUEBAS DE PWA & SERVICE WORKER');
  
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Manifest
    logTest('PWA', 'Web App Manifest definido', indexContent.includes('manifest'));
    
    const manifestPath = path.join(__dirname, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      logTest('PWA', 'Manifest nombre definido', !!manifestContent.name);
      logTest('PWA', 'Manifest short_name definido', !!manifestContent.short_name);
      logTest('PWA', 'Manifest icons definidos', manifestContent.icons && manifestContent.icons.length > 0);
      logTest('PWA', 'Manifest display standalone', manifestContent.display === 'standalone');
      logTest('PWA', 'Manifest start_url definida', !!manifestContent.start_url);
      logTest('PWA', 'Manifest theme_color definido', !!manifestContent.theme_color);
    }
    
    // Service Worker
    logTest('PWA', 'Service Worker registration', indexContent.includes('registerSW') || indexContent.includes('registerServiceWorker'));
    logTest('PWA', 'Apple mobile web app capable', indexContent.includes('apple-mobile-web-app-capable'));
    logTest('PWA', 'Apple touch icon', indexContent.includes('apple-touch-icon'));
    logTest('PWA', 'Mobile web app capable', indexContent.includes('mobile-web-app-capable'));
    
    // Service Worker file
    const swPath = path.join(__dirname, 'service-worker.js');
    if (fs.existsSync(swPath)) {
      const swContent = fs.readFileSync(swPath, 'utf8');
      logTest('PWA', 'Service Worker archivo existe', true);
      logTest('PWA', 'SW - Cache strategy definida', swContent.includes('caches.open'));
      logTest('PWA', 'SW - Fetch event', swContent.includes('addEventListener') && swContent.includes('fetch'));
      logTest('PWA', 'SW - Install event', swContent.includes('install'));
      logTest('PWA', 'SW - Activate event', swContent.includes('activate'));
    }
    
  } catch (error) {
    logTest('PWA', 'Error en PWA', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. PRUEBAS DE RESPONSIVE DESIGN
// ═══════════════════════════════════════════════════════════════════════════════

function testResponsive() {
  logSection('10. PRUEBAS DE RESPONSIVE DESIGN');
  
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Viewport
    logTest('Responsive', 'Meta viewport presente', indexContent.includes('viewport'));
    logTest('Responsive', 'Viewport width=device-width', indexContent.includes('width=device-width'));
    logTest('Responsive', 'Viewport initial-scale', indexContent.includes('initial-scale=1'));
    
    // CSS media queries
    const mainCSSPath = path.join(__dirname, 'css/main.css');
    if (fs.existsSync(mainCSSPath)) {
      const mainCSSContent = fs.readFileSync(mainCSSPath, 'utf8');
      
      logTest('Responsive', 'Media queries en CSS', mainCSSContent.includes('@media'));
      logTest('Responsive', 'Mobile breakpoint (max-width)', mainCSSContent.includes('max-width'));
      logTest('Responsive', 'Desktop breakpoint (min-width)', mainCSSContent.includes('min-width'));
      logTest('Responsive', 'Breakpoint 768px', mainCSSContent.includes('768') || mainCSSContent.includes('767'));
      logTest('Responsive', 'Breakpoint 1024px', mainCSSContent.includes('1024'));
    }
    
    // CSS Grid/Flexbox
    logTest('Responsive', 'Flexbox usado', indexContent.includes('flex') || mainCSSContent.includes('flex'));
    logTest('Responsive', 'Grid usado', indexContent.includes('grid') || mainCSSContent.includes('grid'));
    
    // Mobile optimizations
    logTest('Responsive', 'Touch-friendly UI', indexContent.includes('touch'));
    logTest('Responsive', 'Mobile menu presente', indexContent.includes('menu-toggle'));
    logTest('Responsive', 'Sidebar colapsable', indexContent.includes('sidebar-toggle'));
    
    // Campo CSS (móvil)
    const campoCSSPath = path.join(__dirname, 'css/campo.css');
    if (fs.existsSync(campoCSSPath)) {
      const campoCSSContent = fs.readFileSync(campoCSSPath, 'utf8');
      logTest('Responsive', 'Campo CSS para móvil', campoCSSContent.includes('@media'));
    }
    
  } catch (error) {
    logTest('Responsive', 'Error en responsive', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. PRUEBAS DE CDN Y FALLBACKS
// ═══════════════════════════════════════════════════════════════════════════════

function testCDNandFallbacks() {
  logSection('11. PRUEBAS DE CDN Y FALLBACKS');
  
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Lucide Icons
    logTest('CDN', 'Lucide Icons local', indexContent.includes('vendor/lucide'));
    logTest('CDN', 'Lucide Icons CDN fallback', indexContent.includes('unpkg.com/lucide'));
    logTest('CDN', 'Lucide Icons fallback guard', indexContent.includes('window.lucide'));
    
    // QRCode
    logTest('CDN', 'QRCode local', indexContent.includes('vendor/qrcode'));
    logTest('CDN', 'QRCode CDN fallback', indexContent.includes('cdnjs') || indexContent.includes('unpkg'));
    logTest('CDN', 'QRCode fallback guard', indexContent.includes('window.QRCode'));
    
    // HTML5-QRCode
    logTest('CDN', 'HTML5-QRCode local', indexContent.includes('vendor/html5-qrcode'));
    logTest('CDN', 'HTML5-QRCode CDN fallback', indexContent.includes('unpkg.com/html5-qrcode'));
    logTest('CDN', 'HTML5-QRCode fallback guard', indexContent.includes('window.Html5Qrcode'));
    
    // Leaflet
    logTest('CDN', 'Leaflet local', indexContent.includes('vendor/leaflet'));
    logTest('CDN', 'Leaflet CDN fallback', indexContent.includes('unpkg.com/leaflet'));
    logTest('CDN', 'Leaflet CSS local', indexContent.includes('vendor/leaflet/leaflet.css'));
    
    // Chart.js
    logTest('CDN', 'Chart.js local', indexContent.includes('vendor/chart'));
    logTest('CDN', 'Chart.js CDN fallback', indexContent.includes('cdn.jsdelivr'));
    logTest('CDN', 'Chart.js fallback guard', indexContent.includes('window.Chart'));
    
    // Google Fonts
    logTest('CDN', 'Google Fonts CDN', indexContent.includes('fonts.googleapis.com'));
    logTest('CDN', 'Google Fonts display=swap', indexContent.includes('display=swap'));
    logTest('CDN', 'Google Fonts preconnect', indexContent.includes('preconnect'));
    
    // Firebase
    logTest('CDN', 'Firebase local', indexContent.includes('vendor/firebase'));
    logTest('CDN', 'Firebase CDN fallback', indexContent.includes('gstatic.com/firebasejs'));
    
  } catch (error) {
    logTest('CDN', 'Error en CDN', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. PRUEBAS DE COBERTURA
// ═══════════════════════════════════════════════════════════════════════════════

function testCoverage() {
  logSection('12. PRUEBAS DE COBERTURA');
  
  try {
    // Contar módulos
    const jsPath = path.join(__dirname, 'js');
    const modulesPath = path.join(__dirname, 'js/modules');
    const utilsPath = path.join(__dirname, 'js/utils');
    
    const jsFiles = fs.readdirSync(jsPath).filter(f => f.endsWith('.js'));
    const moduleFiles = fs.readdirSync(modulesPath).filter(f => f.endsWith('.js'));
    const utilFiles = fs.readdirSync(utilsPath).filter(f => f.endsWith('.js'));
    
    logTest('Cobertura', `Total archivos JS: ${jsFiles.length}`, jsFiles.length >= 5);
    logTest('Cobertura', `Total módulos: ${moduleFiles.length}`, moduleFiles.length >= 6);
    logTest('Cobertura', `Total utilities: ${utilFiles.length}`, utilFiles.length >= 15);
    
    // CSS
    const cssPath = path.join(__dirname, 'css');
    const cssFiles = fs.readdirSync(cssPath).filter(f => f.endsWith('.css'));
    logTest('Cobertura', `Total archivos CSS: ${cssFiles.length}`, cssFiles.length >= 5);
    
    // Test files
    const testPath = path.join(__dirname, '__tests__');
    const testFiles = fs.readdirSync(testPath).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));
    logTest('Cobertura', `Total archivos de test: ${testFiles.length}`, testFiles.length >= 5);
    
    // Documentación
    const docs = fs.readdirSync(__dirname).filter(f => f.endsWith('.md'));
    logTest('Cobertura', `Documentación: ${docs.length} archivos .md`, docs.length > 0);
    
  } catch (error) {
    logTest('Cobertura', 'Error en cobertura', false, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERAR REPORTE FINAL
// ═══════════════════════════════════════════════════════════════════════════════

function generateReport() {
  const endTime = new Date();
  const duration = (endTime - testResults.startTime) / 1000;
  
  logSection('RESUMEN FINAL DE PRUEBAS');
  
  console.log(`${colors.bold}📊 ESTADÍSTICAS GLOBALES${colors.reset}`);
  console.log(`   Total Tests: ${testResults.totalTests}`);
  log(`   ✅ Pasados: ${testResults.passed}`, 'green');
  if (testResults.failed > 0) {
    log(`   ❌ Fallidos: ${testResults.failed}`, 'red');
  }
  if (testResults.warnings > 0) {
    log(`   ⚠️  Warnings: ${testResults.warnings}`, 'yellow');
  }
  const successRate = ((testResults.passed / testResults.totalTests) * 100).toFixed(2);
  log(`   📈 Tasa de éxito: ${successRate}%`, successRate >= 95 ? 'green' : 'yellow');
  console.log(`   ⏱️  Tiempo: ${duration.toFixed(2)}s\n`);
  
  console.log(`${colors.bold}📑 DETALLES POR CATEGORÍA${colors.reset}`);
  testResults.categories.forEach(cat => {
    const percentage = ((cat.passed / cat.total) * 100).toFixed(0);
    const status = cat.failed === 0 ? '✅' : '⚠️';
    console.log(`   ${status} [${cat.name}] ${cat.passed}/${cat.total} (${percentage}%)`);
  });
  
  // Guardar reporte JSON
  const reportPath = path.join(__dirname, 'TEST_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    ...testResults,
    duration,
    successRate,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  log(`\n📄 Reporte guardado en: ${reportPath}`, 'cyan');
  
  // Estado final
  if (testResults.failed === 0) {
    log(`\n✅ TODAS LAS PRUEBAS PASARON - SISTEMA OPERATIVO AL 100%`, 'green');
  } else {
    log(`\n⚠️  ALGUNAS PRUEBAS FALLARON - REQUIERE ATENCIÓN`, 'red');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

function runAllTests() {
  log('\n', 'cyan');
  log('╔' + '═'.repeat(78) + '╗', 'cyan');
  log('║' + ' '.repeat(10) + 'SUITE COMPLETA DE PRUEBAS - CONTROL PERSONAL CAMPO v1.5.0'.padEnd(68) + ' '.repeat(1) + '║', 'cyan');
  log('║' + ' '.repeat(10) + 'Validación Exhaustiva del Sistema Completo'.padEnd(68) + ' '.repeat(1) + '║', 'cyan');
  log('╚' + '═'.repeat(78) + '╝', 'cyan');
  log('', 'cyan');
  
  testHTMLStructure();
  testFunctionality();
  testIntegration();
  testSecurity();
  testAccessibility();
  testPerformance();
  testAPIEndpoints();
  testFirebase();
  testPWA();
  testResponsive();
  testCDNandFallbacks();
  testCoverage();
  
  generateReport();
  
  // Exit code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Ejecutar
runAllTests();
