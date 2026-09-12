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
  apiKey: import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY ? import.meta.env.VITE_FIREBASE_API_KEY : "AIzaSyDriDh1SC5_8T1rx5EmgFi0pUEKUGQU5xg",
  authDomain: import.meta.env && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : "sistema-de-control-aee89.firebaseapp.com",
  projectId: import.meta.env && import.meta.env.VITE_FIREBASE_PROJECT_ID ? import.meta.env.VITE_FIREBASE_PROJECT_ID : "sistema-de-control-aee89",
  storageBucket: import.meta.env && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET : "sistema-de-control-aee89.firebasestorage.app",
  messagingSenderId: import.meta.env && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID : "265655332442",
  appId: import.meta.env && import.meta.env.VITE_FIREBASE_APP_ID ? import.meta.env.VITE_FIREBASE_APP_ID : "1:265655332442:web:c4e8617741e3b916987263",
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