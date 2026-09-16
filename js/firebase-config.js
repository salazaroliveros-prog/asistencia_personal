/**
 * CONTROL PERSONAL CAMPO — firebase-config.js
 * Configuración pública de Firebase con validación y gestión de prioridades.
 * @version 1.5.0
 */

/**
 * Configuración pública de Firebase.
 * Se puede completar aquí, desde Ajustes o desde variables de entorno.
 * Se guarda únicamente en el navegador.
 * Estos valores no son contraseñas. La seguridad real la proporcionan Auth y
 * las reglas de Firestore.
 * 
 * IMPORTANTE: Para conexión automática, configura estos valores aquí, en
 * Ajustes o en el archivo .env antes de la primera carga. La app intentará
 * conectar automáticamente.
 *
 * NOTA: Este archivo se carga como SCRIPT CLÁSICO (no type="module"), por lo que
 * NO se puede usar `import.meta.env` directamente. En su lugar, Vite inyecta
 * `window.__FIREBASE_ENV__` desde las variables VITE_FIREBASE_* definidas en
 * .env durante el build/dev.
 * 
 * SEGURIDAD: Las credenciales de Firebase web son públicas por diseño. La seguridad
 * real se maneja con Firebase Authentication y Firestore Rules.
 */
const FirebaseConfigManager = (() => {
  const bundledFirebaseConfig = window.bundledFirebaseConfig || {
    apiKey: 'AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg',
    authDomain: 'sistema-de-control-aee89.firebaseapp.com',
    projectId: 'sistema-de-control-aee89',
    storageBucket: 'sistema-de-control-aee89.firebasestorage.app',
    messagingSenderId: '265655332442',
    appId: '1:265655332442:web:c4e8617741e3b916987263',
  };

  // Las variables de entorno inyectadas por Vite tienen prioridad sobre los
  // valores hardcodeados. Si no hay variables de entorno, se usan los valores
  // bundled. Si el usuario cambia credenciales desde Ajustes, estas se guardan
  // en localStorage y tienen prioridad final.
  let storedFirebaseConfig = {};
  try {
    storedFirebaseConfig = JSON.parse(localStorage.getItem('cpc_firebase_config') || '{}');
  } catch (_) {
    storedFirebaseConfig = {};
  }

  const hasEnvConfig = window.__FIREBASE_ENV__ && Object.values(window.__FIREBASE_ENV__).some((v) => v);
  const hasStoredConfig = storedFirebaseConfig && Object.keys(storedFirebaseConfig).length > 0;
  const hasBundledConfig = bundledFirebaseConfig && Object.keys(bundledFirebaseConfig).length > 0;
  const existingConfig = (window.FIREBASE_CONFIG && Object.keys(window.FIREBASE_CONFIG).length > 0)
    ? window.FIREBASE_CONFIG
    : {};

  /**
   * Valida la configuración de Firebase.
   * @param {Object} config - Configuración a validar
   * @returns {Object} Resultado de validación { valid: boolean, error?: string }
   */
  function validateFirebaseConfig(config) {
    if (!config || typeof config !== 'object') {
      return { valid: false, error: 'Configuración inválida.' };
    }
    
    if (!config.apiKey || config.apiKey.length <= 10) {
      return { valid: false, error: 'API Key inválida o vacía.' };
    }
    
    if (!config.authDomain || !config.authDomain.includes('.firebaseapp.com')) {
      return { valid: false, error: 'Dominio de autenticación inválido. Debe terminar en .firebaseapp.com' };
    }
    
    if (!config.projectId || config.projectId.length <= 2) {
      return { valid: false, error: 'ID del proyecto inválido.' };
    }
    
    if (!config.appId || config.appId.length <= 5) {
      return { valid: false, error: 'App ID inválido.' };
    }
    
    return { valid: true };
  }

  /**
   * Obtiene la configuración de Firebase con prioridades
   * @returns {Object} Configuración de Firebase
   */
  function getFirebaseConfig() {
    return {
      ...(hasBundledConfig ? bundledFirebaseConfig : {}),
      ...(hasEnvConfig ? window.__FIREBASE_ENV__ : {}),
      ...(hasStoredConfig ? storedFirebaseConfig : {}),
      ...existingConfig,
    };
  }

  // Exponer la configuración globalmente
  window.FIREBASE_CONFIG = getFirebaseConfig();
  window.validateFirebaseConfig = validateFirebaseConfig;

  return {
    getFirebaseConfig,
    validateFirebaseConfig,
  };
})();

// Exponer el módulo globalmente
window.FirebaseConfigManager = FirebaseConfigManager;
