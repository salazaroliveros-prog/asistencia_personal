/**
 * Configuración pública de Firebase.
 * Se puede completar aquí o desde Ajustes; se guarda únicamente en el navegador.
 * Estos valores no son contraseñas. La seguridad real la proporcionan Auth y
 * las reglas de Firestore.
 * 
 * IMPORTANTE: Para conexión automática, configura estos valores aquí o en
 * Ajustes antes de la primera carga. La app intentará conectar automáticamente.
 */
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
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

