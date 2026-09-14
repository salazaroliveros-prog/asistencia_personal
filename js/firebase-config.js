/**
 * Configuración pública de Firebase.
 * Se puede completar aquí o desde Ajustes; se guarda únicamente en el navegador.
 * Estos valores no son contraseñas. La seguridad real la proporcionan Auth y
 * las reglas de Firestore.
 * 
 * IMPORTANTE: Para conexión automática, configura estos valores aquí o en
 * Ajustes antes de la primera carga. La app intentará conectar automáticamente.
 *
 * NOTA: Este archivo se carga como SCRIPT CLÁSICO (no type="module"), por lo que
 * NO se puede usar `import.meta.env` (ni siquiera `typeof import`): el navegador
 * lanza "Cannot use import/import.meta outside a module". Por eso estos valores
 * se definen literalmente aquí (equivalentes a los de .env / VITE_*).
 * 
 * SEGURIDAD: Las credenciales de Firebase web son públicas por diseño. La seguridad
 * real se maneja con Firebase Authentication y Firestore Rules.
 */
const bundledFirebaseConfig = {
  apiKey: "AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg",
  authDomain: "sistema-de-control-aee89.firebaseapp.com",
  projectId: "sistema-de-control-aee89",
  storageBucket: "sistema-de-control-aee89.firebasestorage.app",
  messagingSenderId: "265655332442",
  appId: "1:265655332442:web:c4e8617741e3b916987263",
};

// La configuración web no es un secreto, pero sí debe sobrevivir a un cambio
// hecho desde Ajustes. De este modo el cliente y el escáner comparten la misma
// fuente de verdad al volver a abrir la aplicación.
let storedFirebaseConfig = {};
try {
  storedFirebaseConfig = JSON.parse(localStorage.getItem('cpc_firebase_config') || '{}');
} catch (_) {
  storedFirebaseConfig = {};
}
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  ...bundledFirebaseConfig,
  ...storedFirebaseConfig,
};

/**
 * Valida la configuración de Firebase.
 * @param {Object} config - Configuración a validar
 * @returns {Object} Resultado de validación { valid: boolean, error?: string }
 */
window.validateFirebaseConfig = function(config) {
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
};
