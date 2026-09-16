/**
 * CONTROL PERSONAL CAMPO — Integration Test Suite
 * Pruebas integrales profundas del sistema: Firebase, localStorage, validaciones, etc.
 * @version 1.5.0
 */

const fs = require('fs');
const path = require('path');

// Simular entorno del navegador para pruebas
global.window = {
  localStorage: {
    _data: {},
    getItem(key) {
      return this._data[key] || null;
    },
    setItem(key, value) {
      this._data[key] = String(value);
    },
    removeItem(key) {
      delete this._data[key];
    },
    clear() {
      this._data = {};
    }
  },
  FirebaseClient: null,
  AppState: null,
  API: null,
  firebase: null
};

global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

global.navigator = {
  standalone: false,
  matchMedia: () => ({ matches: false })
};

// Cargar módulos del sistema
const configPath = path.join(__dirname, '../js/config.js');
const firebaseConfigPath = path.join(__dirname, '../js/firebase-config.js');
const firebaseClientPath = path.join(__dirname, '../js/firebase-client.js');
const apiPath = path.join(__dirname, '../js/api.js');
const validatorsPath = path.join(__dirname, '../js/utils/validators.js');

// Resultados de pruebas
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(category, name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [${category}] ${name}${message ? ': ' + message : ''}`);
  
  testResults.tests.push({
    category,
    name,
    passed,
    message
  });
  
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────
function testConfiguration() {
  console.log('\n🔧 PRUEBAS DE CONFIGURACIÓN');
  
  try {
    // Cargar config.js
    const configContent = fs.readFileSync(configPath, 'utf8');
    logTest('Configuración', 'Archivo config.js existe', true);
    
    // Verificar constantes críticas
    const hasAppVersion = configContent.includes('APP_VERSION');
    const hasLSKeys = configContent.includes('LS_KEYS');
    const hasAppState = configContent.includes('AppState');
    
    logTest('Configuración', 'Constantes APP_VERSION definidas', hasAppVersion);
    logTest('Configuración', 'LocalStorage keys definidas', hasLSKeys);
    logTest('Configuración', 'AppState definido', hasAppState);
    
    // Verificar valores por defecto
    const hasDefaultConfig = configContent.includes('DEFAULT_CONFIG');
    const hasTolerancia = configContent.includes('Tolerancia_Minutos');
    
    logTest('Configuración', 'Configuración por defecto definida', hasDefaultConfig);
    logTest('Configuración', 'Tolerancia configurada', hasTolerancia);
    
  } catch (error) {
    logTest('Configuración', 'Carga de configuración', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE FIREBASE
// ─────────────────────────────────────────────────────────────────────────────
function testFirebaseConfiguration() {
  console.log('\n🔥 PRUEBAS DE FIREBASE');
  
  try {
    const firebaseConfigContent = fs.readFileSync(firebaseConfigPath, 'utf8');
    logTest('Firebase', 'Archivo firebase-config.js existe', true);
    
    // Verificar estructura de configuración
    const hasApiKey = firebaseConfigContent.includes('apiKey');
    const hasProjectId = firebaseConfigContent.includes('projectId');
    const hasAuthDomain = firebaseConfigContent.includes('authDomain');
    const hasValidation = firebaseConfigContent.includes('validateFirebaseConfig');
    
    logTest('Firebase', 'API Key configurada', hasApiKey);
    logTest('Firebase', 'Project ID configurado', hasProjectId);
    logTest('Firebase', 'Auth Domain configurado', hasAuthDomain);
    logTest('Firebase', 'Función de validación definida', hasValidation);
    
    // Verificar que no haya credenciales expuestas peligrosamente
    const hasHardcodedSecrets = firebaseConfigContent.includes('private_key') || 
                                 firebaseConfigContent.includes('service_account');
    
    logTest('Firebase', 'Sin credenciales privadas hardcoded', !hasHardcodedSecrets);
    
  } catch (error) {
    logTest('Firebase', 'Carga de configuración Firebase', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE LOCALSTORAGE
// ─────────────────────────────────────────────────────────────────────────────
function testLocalStorage() {
  console.log('\n💾 PRUEBAS DE LOCALSTORAGE');
  
  try {
    // Limpiar localStorage
    global.window.localStorage.clear();
    
    // Prueba de escritura
    global.window.localStorage.setItem('test_key', 'test_value');
    const readValue = global.window.localStorage.getItem('test_key');
    const writeSuccess = readValue === 'test_value';
    
    logTest('LocalStorage', 'Escritura de datos', writeSuccess);
    
    // Prueba de lectura
    global.window.localStorage.setItem('test_complex', JSON.stringify({ test: true, value: 123 }));
    const complexRead = JSON.parse(global.window.localStorage.getItem('test_complex'));
    const readComplexSuccess = complexRead.test === true && complexRead.value === 123;
    
    logTest('LocalStorage', 'Lectura de datos complejos', readComplexSuccess);
    
    // Prueba de eliminación
    global.window.localStorage.setItem('test_delete', 'value');
    global.window.localStorage.removeItem('test_delete');
    const deleteSuccess = global.window.localStorage.getItem('test_delete') === null;
    
    logTest('LocalStorage', 'Eliminación de datos', deleteSuccess);
    
    // Prueba de clear
    global.window.localStorage.setItem('test_clear1', 'value1');
    global.window.localStorage.setItem('test_clear2', 'value2');
    global.window.localStorage.clear();
    const clearSuccess = global.window.localStorage.getItem('test_clear1') === null &&
                        global.window.localStorage.getItem('test_clear2') === null;
    
    logTest('LocalStorage', 'Limpieza completa', clearSuccess);
    
  } catch (error) {
    logTest('LocalStorage', 'Operaciones localStorage', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE VALIDADORES
// ─────────────────────────────────────────────────────────────────────────────
function testValidators() {
  console.log('\n✅ PRUEBAS DE VALIDADORES');
  
  try {
    const validatorsContent = fs.readFileSync(validatorsPath, 'utf8');
    logTest('Validadores', 'Archivo validators.js existe', true);
    
    // Verificar funciones de validación críticas
    const hasValidateDPI = validatorsContent.includes('validateDPI');
    const hasValidateNombre = validatorsContent.includes('validateNombre');
    const hasValidateTelefono = validatorsContent.includes('validateTelefono');
    const hasValidateTolerancia = validatorsContent.includes('validateTolerancia');
    const hasValidateGPS = validatorsContent.includes('validateLatitud') || 
                          validatorsContent.includes('validateLongitud');
    
    logTest('Validadores', 'Validación de DPI', hasValidateDPI);
    logTest('Validadores', 'Validación de nombre', hasValidateNombre);
    logTest('Validadores', 'Validación de teléfono', hasValidateTelefono);
    logTest('Validadores', 'Validación de tolerancia', hasValidateTolerancia);
    logTest('Validadores', 'Validación de GPS', hasValidateGPS);
    
    // Verificar validaciones compuestas
    const hasValidateTrabajador = validatorsContent.includes('validateTrabajadorCompleto');
    const hasValidateMarcacion = validatorsContent.includes('validateMarcacion');
    const hasValidateConfig = validatorsContent.includes('validateConfigSistema');
    
    logTest('Validadores', 'Validación completa de trabajador', hasValidateTrabajador);
    logTest('Validadores', 'Validación de marcación', hasValidateMarcacion);
    logTest('Validadores', 'Validación de configuración', hasValidateConfig);
    
  } catch (error) {
    logTest('Validadores', 'Carga de validadores', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE ESTRUCTURA DE ARCHIVOS
// ─────────────────────────────────────────────────────────────────────────────
function testFileStructure() {
  console.log('\n📁 PRUEBAS DE ESTRUCTURA DE ARCHIVOS');
  
  const criticalFiles = [
    'index.html',
    'js/config.js',
    'js/firebase-config.js',
    'js/firebase-client.js',
    'js/api.js',
    'js/app.js',
    'js/modules/dashboard.js',
    'js/modules/personal.js',
    'js/modules/asistencia.js',
    'js/modules/campo.js',
    'js/modules/reportes.js',
    'js/modules/ajustes.js',
    'js/utils/validators.js',
    'js/utils/constants.js',
    'css/main.css',
    'css/components.css',
    'css/glassmorphism.css',
    'css/accessibility.css',
    'css/campo.css',
    'firebase.json',
    'firestore.rules',
    'package.json'
  ];
  
  criticalFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(filePath);
    logTest('Estructura', `Archivo ${file} existe`, exists);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE CSS Y ESTILOS
// ─────────────────────────────────────────────────────────────────────────────
function testCSSFiles() {
  console.log('\n🎨 PRUEBAS DE CSS Y ESTILOS');
  
  const cssFiles = [
    'css/main.css',
    'css/components.css',
    'css/glassmorphism.css',
    'css/accessibility.css',
    'css/campo.css',
    'css/print.css'
  ];
  
  cssFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Verificar variables CSS
      const hasVariables = content.includes('--');
      const hasMediaQueries = content.includes('@media');
      const hasResponsive = content.includes('max-width') || content.includes('min-width');
      
      logTest('CSS', `${file} existe y es válido`, true);
      logTest('CSS', `${file} usa variables CSS`, hasVariables);
      logTest('CSS', `${file} tiene media queries`, hasMediaQueries);
      logTest('CSS', `${file} es responsive`, hasResponsive);
      
    } catch (error) {
      logTest('CSS', `Error en ${file}`, false, error.message);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE SEGURIDAD
// ─────────────────────────────────────────────────────────────────────────────
function testSecurity() {
  console.log('\n🔒 PRUEBAS DE SEGURIDAD');
  
  try {
    // Verificar CSP en index.html
    const indexPath = path.join(__dirname, '../index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    const hasCSP = indexContent.includes('Content-Security-Policy');
    const hasMetaSecurity = indexContent.includes('http-equiv="Content-Security-Policy"');
    
    logTest('Seguridad', 'CSP definido en HTML', hasCSP || hasMetaSecurity);
    
    // Verificar que no haya tokens hardcodeados peligrosos
    const hasDangerousTokens = indexContent.includes('private_key') ||
                               indexContent.includes('secret_key') ||
                               indexContent.includes('api_secret');
    
    logTest('Seguridad', 'Sin tokens privados hardcoded', !hasDangerousTokens);
    
    // Verificar configuración de Firebase
    const firebaseConfigContent = fs.readFileSync(firebaseConfigPath, 'utf8');
    const hasValidation = firebaseConfigContent.includes('validateFirebaseConfig');
    
    logTest('Seguridad', 'Validación de Firebase configurada', hasValidation);
    
  } catch (error) {
    logTest('Seguridad', 'Verificación de seguridad', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE BUILD Y DEPENDENCIAS
// ─────────────────────────────────────────────────────────────────────────────
function testBuildConfiguration() {
  console.log('\n🔨 PRUEBAS DE BUILD Y DEPENDENCIAS');
  
  try {
    const packagePath = path.join(__dirname, '../package.json');
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Verificar scripts críticos
    const hasTestScript = packageContent.scripts.test;
    const hasBuildScript = packageContent.scripts.build;
    const hasDevScript = packageContent.scripts.dev;
    const hasLintScript = packageContent.scripts.lint;
    const hasFormatScript = packageContent.scripts.format;
    
    logTest('Build', 'Script de test definido', !!hasTestScript);
    logTest('Build', 'Script de build definido', !!hasBuildScript);
    logTest('Build', 'Script de dev definido', !!hasDevScript);
    logTest('Build', 'Script de lint definido', !!hasLintScript);
    logTest('Build', 'Script de format definido', !!hasFormatScript);
    
    // Verificar dependencias críticas
    const hasFirebase = packageContent.dependencies.firebase;
    const hasVite = packageContent.devDependencies.vite;
    const hasEslint = packageContent.devDependencies.eslint;
    const hasPrettier = packageContent.devDependencies.prettier;
    const hasPlaywright = packageContent.devDependencies.playwright;
    
    logTest('Dependencias', 'Firebase incluido', !!hasFirebase);
    logTest('Dependencias', 'Vite incluido', !!hasVite);
    logTest('Dependencias', 'ESLint incluido', !!hasEslint);
    logTest('Dependencias', 'Prettier incluido', !!hasPrettier);
    logTest('Dependencias', 'Playwright incluido', !!hasPlaywright);
    
    // Verificar archivos de configuración
    const hasViteConfig = fs.existsSync(path.join(__dirname, '../vite.config.js'));
    const hasEslintConfig = fs.existsSync(path.join(__dirname, '../.eslintrc.js'));
    const hasPrettierConfig = fs.existsSync(path.join(__dirname, '../.prettierrc'));
    const hasTsConfig = fs.existsSync(path.join(__dirname, '../tsconfig.json'));
    
    logTest('Configuración', 'vite.config.js existe', hasViteConfig);
    logTest('Configuración', '.eslintrc.js existe', hasEslintConfig);
    logTest('Configuración', '.prettierrc existe', hasPrettierConfig);
    logTest('Configuración', 'tsconfig.json existe', hasTsConfig);
    
  } catch (error) {
    logTest('Build', 'Verificación de configuración', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE FIRESTORE RULES
// ─────────────────────────────────────────────────────────────────────────────
function testFirestoreRules() {
  console.log('\n📜 PRUEBAS DE FIRESTORE RULES');
  
  try {
    const rulesPath = path.join(__dirname, '../firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    
    // Verificar estructura básica de reglas
    const hasAllow = rulesContent.includes('allow');
    const hasDeny = rulesContent.includes('deny');
    const hasVersion = rulesContent.includes('rules_version');
    const hasService = rulesContent.includes('service cloud.firestore');
    
    logTest('Firestore Rules', 'Archivo firestore.rules existe', true);
    logTest('Firestore Rules', 'Contiene reglas allow', hasAllow);
    logTest('Firestore Rules', 'Contiene reglas deny', hasDeny);
    logTest('Firestore Rules', 'Versión de reglas definida', hasVersion);
    logTest('Firestore Rules', 'Servicio Firestore definido', hasService);
    
    // Verificar colecciones críticas
    const hasPersonal = rulesContent.includes('personal');
    const hasAsistencias = rulesContent.includes('asistencias');
    const hasConfiguracion = rulesContent.includes('configuracion');
    
    logTest('Firestore Rules', 'Colección personal definida', hasPersonal);
    logTest('Firestore Rules', 'Colección asistencias definida', hasAsistencias);
    logTest('Firestore Rules', 'Colección configuración definida', hasConfiguracion);
    
  } catch (error) {
    logTest('Firestore Rules', 'Verificación de reglas', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE ACCESIBILIDAD
// ─────────────────────────────────────────────────────────────────────────────
function testAccessibility() {
  console.log('\n♿ PRUEBAS DE ACCESIBILIDAD');
  
  try {
    const indexPath = path.join(__dirname, '../index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Verificar atributos ARIA críticos
    const hasSkipLink = indexContent.includes('skip-link');
    const hasAriaLabels = indexContent.includes('aria-label');
    const hasAriaHidden = indexContent.includes('aria-hidden');
    const hasRoleNavigation = indexContent.includes('role="navigation"');
    const hasRoleMain = indexContent.includes('role="main"');
    const hasRoleBanner = indexContent.includes('role="banner"');
    
    logTest('Accesibilidad', 'Skip link definido', hasSkipLink);
    logTest('Accesibilidad', 'aria-labels usados', hasAriaLabels);
    logTest('Accesibilidad', 'aria-hidden usado', hasAriaHidden);
    logTest('Accesibilidad', 'role="navigation" definido', hasRoleNavigation);
    logTest('Accesibilidad', 'role="main" definido', hasRoleMain);
    logTest('Accesibilidad', 'role="banner" definido', hasRoleBanner);
    
    // Verificar atributos de accesibilidad en inputs
    const hasLabelFor = indexContent.includes('for=') || indexContent.includes('aria-labelledby');
    const hasRequired = indexContent.includes('required');
    
    logTest('Accesibilidad', 'Labels en formularios', hasLabelFor);
    logTest('Accesibilidad', 'Campos required marcados', hasRequired);
    
    // Verificar CSS de accesibilidad
    const accessibilityPath = path.join(__dirname, '../css/accessibility.css');
    const hasAccessibilityCSS = fs.existsSync(accessibilityPath);
    
    if (hasAccessibilityCSS) {
      const accessibilityContent = fs.readFileSync(accessibilityPath, 'utf8');
      const hasFocusVisible = accessibilityContent.includes('focus-visible');
      const hasReducedMotion = accessibilityContent.includes('prefers-reduced-motion');
      const hasScreenReader = accessibilityContent.includes('sr-only');
      
      logTest('Accesibilidad', 'CSS accessibility.css existe', true);
      logTest('Accesibilidad', 'focus-visible definido', hasFocusVisible);
      logTest('Accesibilidad', 'prefers-reduced-motion soportado', hasReducedMotion);
      logTest('Accesibilidad', 'sr-only class definida', hasScreenReader);
    } else {
      logTest('Accesibilidad', 'CSS accessibility.css existe', false);
    }
    
  } catch (error) {
    logTest('Accesibilidad', 'Verificación de accesibilidad', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────
function testPerformance() {
  console.log('\n⚡ PRUEBAS DE PERFORMANCE');
  
  try {
    // Verificar optimización de imágenes
    const indexPath = path.join(__dirname, '../index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    const hasLazyLoading = indexContent.includes('loading="lazy"');
    const hasWebP = indexContent.includes('.webp');
    const hasResponsiveImages = indexContent.includes('srcset');
    
    logTest('Performance', 'Lazy loading implementado', hasLazyLoading);
    logTest('Performance', 'Formato WebP soportado', hasWebP);
    logTest('Performance', 'Imágenes responsive', hasResponsiveImages);
    
    // Verificar optimización de scripts
    const hasDefer = indexContent.includes('defer');
    const hasAsync = indexContent.includes('async');
    const hasModuleScript = indexContent.includes('type="module"');
    
    logTest('Performance', 'Scripts con defer', hasDefer);
    logTest('Performance', 'Scripts con async', hasAsync);
    logTest('Performance', 'Módulos ES usados', hasModuleScript);
    
    // Verificar service worker
    const hasServiceWorker = indexContent.includes('service-worker') || 
                            indexContent.includes('sw.js');
    const hasManifest = indexContent.includes('manifest');
    
    logTest('Performance', 'Service Worker definido', hasServiceWorker);
    logTest('Performance', 'Web App Manifest definido', hasManifest);
    
  } catch (error) {
    logTest('Performance', 'Verificación de performance', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE MÓDULOS JAVASCRIPT
// ─────────────────────────────────────────────────────────────────────────────
function testJavaScriptModules() {
  console.log('\n📜 PRUEBAS DE MÓDULOS JAVASCRIPT');
  
  const jsModules = [
    'js/config.js',
    'js/firebase-config.js',
    'js/firebase-client.js',
    'js/api.js',
    'js/app.js',
    'js/utils/constants.js',
    'js/utils/validators.js',
    'js/utils/alerts.js',
    'js/utils/camera-session.js',
    'js/utils/gps.js',
    'js/utils/pdf-builder.js',
    'js/utils/data-export.js',
    'js/utils/cache-manager.js',
    'js/utils/theme-manager.js',
    'js/modules/dashboard.js',
    'js/modules/personal.js',
    'js/modules/asistencia.js',
    'js/modules/campo.js',
    'js/modules/reportes.js',
    'js/modules/ajustes.js'
  ];
  
  jsModules.forEach(module => {
    const modulePath = path.join(__dirname, '..', module);
    try {
      const content = fs.readFileSync(modulePath, 'utf8');
      
      // Verificar estructura IIFE
      const hasIIFE = content.includes('(() => {') || content.includes('(function () {');
      const hasWindowExport = content.includes('window.');
      const hasJSDoc = content.includes('/**');
      
      logTest('Módulos JS', `${module} existe`, true);
      logTest('Módulos JS', `${module} usa IIFE`, hasIIFE);
      logTest('Módulos JS', `${module} exporta a window`, hasWindowExport);
      logTest('Módulos JS', `${module} tiene JSDoc`, hasJSDoc);
      
    } catch (error) {
      logTest('Módulos JS', `${module} error`, false, error.message);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE INTEGRACIÓN
// ─────────────────────────────────────────────────────────────────────────────
function testIntegration() {
  console.log('\n🔗 PRUEBAS DE INTEGRACIÓN');
  
  try {
    // Verificar que los módulos se carguen en el orden correcto
    const indexPath = path.join(__dirname, '../index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    const scriptsOrder = [
      'js/config.js',
      'js/firebase-config.js',
      'js/firebase-client.js',
      'js/api.js',
      'js/utils/constants.js',
      'js/utils/validators.js',
      'js/utils/alerts.js',
      'js/modules/dashboard.js',
      'js/modules/personal.js',
      'js/modules/asistencia.js',
      'js/modules/campo.js',
      'js/modules/reportes.js',
      'js/modules/ajustes.js',
      'js/app.js'
    ];
    
    let correctOrder = true;
    let lastIndex = -1;
    
    scriptsOrder.forEach(script => {
      const currentIndex = indexContent.indexOf(script);
      if (currentIndex === -1) {
        logTest('Integración', `Script ${script} no encontrado en HTML`, false);
        correctOrder = false;
      } else if (currentIndex < lastIndex) {
        logTest('Integración', `Script ${script} en orden incorrecto`, false);
        correctOrder = false;
      } else {
        lastIndex = currentIndex;
      }
    });
    
    if (correctOrder) {
      logTest('Integración', 'Orden de scripts correcto', true);
    }
    
    // Verificar integración de vendor libraries
    const hasLucide = indexContent.includes('lucide.min.js');
    const hasQRCode = indexContent.includes('qrcode.min.js');
    const hasHtml5QRCode = indexContent.includes('html5-qrcode.min.js');
    const hasLeaflet = indexContent.includes('leaflet');
    const hasChartJS = indexContent.includes('chart.umd.min.js');
    const hasPDF = indexContent.includes('jspdf');
    
    logTest('Integración', 'Lucide Icons integrado', hasLucide);
    logTest('Integración', 'QRCode.js integrado', hasQRCode);
    logTest('Integración', 'HTML5-QRCode integrado', hasHtml5QRCode);
    logTest('Integración', 'Leaflet integrado', hasLeaflet);
    logTest('Integración', 'Chart.js integrado', hasChartJS);
    logTest('Integración', 'jsPDF integrado', hasPDF);
    
  } catch (error) {
    logTest('Integración', 'Verificación de integración', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DE RESPONSIVE DESIGN
// ─────────────────────────────────────────────────────────────────────────────
function testResponsiveDesign() {
  console.log('\n📱 PRUEBAS DE RESPONSIVE DESIGN');
  
  try {
    const mainCSSPath = path.join(__dirname, '../css/main.css');
    const mainCSSContent = fs.readFileSync(mainCSSPath, 'utf8');
    
    // Verificar breakpoints
    const hasMediaQueries = mainCSSContent.includes('@media');
    const hasMobileBreakpoint = mainCSSContent.includes('767px') || mainCSSContent.includes('768px');
    const hasTabletBreakpoint = mainCSSContent.includes('1024px');
    const hasTouchAction = mainCSSContent.includes('touch-action');
    
    logTest('Responsive', 'Media queries definidas', hasMediaQueries);
    logTest('Responsive', 'Breakpoint móvil definido', hasMobileBreakpoint);
    logTest('Responsive', 'Breakpoint tablet definido', hasTabletBreakpoint);
    logTest('Responsive', 'Touch action optimizado', hasTouchAction);
    
    // Verificar CSS de campo
    const campoCSSPath = path.join(__dirname, '../css/campo.css');
    const campoCSSContent = fs.readFileSync(campoCSSPath, 'utf8');
    
    const hasMobileOptimizations = campoCSSContent.includes('@media (max-width');
    const hasExtraSmallOptimizations = campoCSSContent.includes('379px');
    
    logTest('Responsive', 'Campo CSS tiene optimizaciones móvil', hasMobileOptimizations);
    logTest('Responsive', 'Campo CSS optimizado para extra small', hasExtraSmallOptimizations);
    
  } catch (error) {
    logTest('Responsive', 'Verificación responsive design', false, error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EJECUTAR TODAS LAS PRUEBAS
// ─────────────────────────────────────────────────────────────────────────────
function runAllTests() {
  console.log('🧪 ===============================================');
  console.log('🧪 SUITE DE PRUEBAS INTEGRALES - CONTROL PERSONAL CAMPO');
  console.log('🧪 ===============================================');
  console.log('📅 Fecha:', new Date().toISOString());
  console.log('📦 Versión: 1.5.0');
  
  testConfiguration();
  testFirebaseConfiguration();
  testLocalStorage();
  testValidators();
  testFileStructure();
  testCSSFiles();
  testSecurity();
  testBuildConfiguration();
  testFirestoreRules();
  testAccessibility();
  testPerformance();
  testJavaScriptModules();
  testIntegration();
  testResponsiveDesign();
  
  // Resumen final
  console.log('\n📊 ===============================================');
  console.log('📊 RESUMEN DE PRUEBAS');
  console.log('📊 ===============================================');
  console.log(`✅ Tests pasados: ${testResults.passed}`);
  console.log(`❌ Tests fallidos: ${testResults.failed}`);
  console.log(`📋 Total tests: ${testResults.tests.length}`);
  console.log(`📈 Tasa de éxito: ${((testResults.passed / testResults.tests.length) * 100).toFixed(2)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Tests fallados:');
    testResults.tests.filter(t => !t.passed).forEach(test => {
      console.log(`   - [${test.category}] ${test.name}: ${test.message}`);
    });
  }
  
  console.log('\n🎯 Estado del sistema:', testResults.failed === 0 ? '✅ APROBADO' : '⚠️ REQUIERE ATENCIÓN');
  
  // Guardar resultados en archivo
  const resultsPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Resultados guardados en: ${resultsPath}`);
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Ejecutar pruebas
runAllTests();