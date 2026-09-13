/**
 * CONTROL PERSONAL CAMPO — utils/error-handler.js
 * Sistema de manejo de errores específico con tipos y recovery
 * @version 1.0.0
 */

const ErrorHandler = (() => {
  
  // ─── Tipos de errores ─────────────────────────────────────────────────────
  const ERROR_TYPES = {
    NETWORK: 'NETWORK_ERROR',
    FIREBASE: 'FIREBASE_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    PERMISSION: 'PERMISSION_ERROR',
    OFFLINE: 'OFFLINE_ERROR',
    TIMEOUT: 'TIMEOUT_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
  };
  
  // ─── Mapeo de códigos de error a mensajes amigables ───────────────────────
  const ERROR_MESSAGES = {
    // Firebase errors
    'firestore/permission-denied': 'No tienes permiso para realizar esta acción',
    'firestore/not-found': 'El documento solicitado no existe',
    'firestore/already-exists': 'El documento ya existe',
    'firestore/unavailable': 'Firestore no está disponible',
    'firestore/deadline-exceeded': 'Tiempo de espera agotado',
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/invalid-email': 'Email inválido',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/too-many-requests': 'Demasiados intentos, intenta más tarde',
    'auth/email-already-in-use': 'El email ya está en uso',
    
    // Network errors
    'network-request-failed': 'Error de conexión a la red',
    'network/offline': 'Sin conexión a internet',
    
    // Generic errors
    'unknown': 'Ocurrió un error inesperado'
  };
  
  // ─── Función principal de manejo de errores ───────────────────────────────
  function handle(error, context = {}) {
    // Determinar tipo de error
    const errorType = _classifyError(error);
    
    // Obtener mensaje amigable
    const userMessage = _getUserMessage(error, errorType);
    
    // Loggear error con contexto
    _logError(error, errorType, context);
    
    // Intentar recuperación automática
    const recovery = _attemptRecovery(error, errorType, context);
    
    // Retornar información estructurada
    return {
      type: errorType,
      message: userMessage,
      originalError: error,
      context,
      recovery,
      timestamp: new Date().toISOString()
    };
  }
  
  // ─── Clasificar tipo de error ─────────────────────────────────────────────
  function _classifyError(error) {
    if (!error) return ERROR_TYPES.UNKNOWN;
    
    const errorMessage = error.message || String(error);
    const errorCode = error.code || '';
    
    // Firebase errors
    if (errorMessage.includes('Firebase') || errorMessage.includes('firestore') || errorMessage.includes('auth')) {
      return ERROR_TYPES.FIREBASE;
    }
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('NetworkError')) {
      return ERROR_TYPES.NETWORK;
    }
    
    // Permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('auth') || errorCode.includes('permission')) {
      return ERROR_TYPES.PERMISSION;
    }
    
    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('deadline')) {
      return ERROR_TYPES.TIMEOUT;
    }
    
    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return ERROR_TYPES.VALIDATION;
    }
    
    return ERROR_TYPES.UNKNOWN;
  }
  
  // ─── Obtener mensaje amigable para usuario ───────────────────────────────
  function _getUserMessage(error, errorType) {
    const errorCode = error.code || '';
    const errorMessage = error.message || String(error);
    
    // Buscar mensaje específico primero
    if (ERROR_MESSAGES[errorCode]) {
      return ERROR_MESSAGES[errorCode];
    }
    
    // Mensajes por tipo de error
    switch (errorType) {
      case ERROR_TYPES.NETWORK:
        return 'Error de conexión. Verifica tu internet y vuelve a intentar.';
      case ERROR_TYPES.FIREBASE:
        return 'Error en el servicio de datos. Por favor, vuelve a intentar.';
      case ERROR_TYPES.PERMISSION:
        return 'No tienes permiso para realizar esta acción. Contacta al administrador.';
      case ERROR_TYPES.OFFLINE:
        return 'Estás sin conexión. Los datos se guardarán localmente y se sincronizarán cuando vuelvas a estar en línea.';
      case ERROR_TYPES.TIMEOUT:
        return 'La operación tardó demasiado tiempo. Por favor, vuelve a intentar.';
      case ERROR_TYPES.VALIDATION:
        return 'Hay un error en los datos ingresados. Por favor, revísalos.';
      default:
        return 'Ocurrió un error inesperado. Por favor, intenta nuevamente.';
    }
  }
  
  // ─── Loggear error con contexto ───────────────────────────────────────────
  function _logError(error, errorType, context) {
    if (typeof window !== 'undefined' && window.Logger) {
      window.Logger.error('ErrorHandler', `Error type: ${errorType}`, {
        error: error.message || String(error),
        code: error.code,
        context,
        stack: error.stack
      });
    } else {
      console.error(`[ErrorHandler] ${errorType}:`, error, context);
    }
  }
  
  // ─── Intentar recuperación automática ─────────────────────────────────────
  function _attemptRecovery(error, errorType, context) {
    switch (errorType) {
      case ERROR_TYPES.NETWORK:
      case ERROR_TYPES.OFFLINE:
        // Ya está manejado por el sistema offline-first
        return { type: 'offline', message: 'Los datos se guardarán localmente' };
      
      case ERROR_TYPES.TIMEOUT:
        // Sugerir retry
        return { type: 'retry', message: 'Intenta nuevamente' };
      
      case ERROR_TYPES.FIREBASE:
        // Sugerir reinitialize
        if (typeof window !== 'undefined' && window.FirebaseClient) {
          return { type: 'reconnect', action: () => window.FirebaseClient.initialize() };
        }
        break;
      
      default:
        return { type: 'manual', message: 'Contacta soporte si persiste' };
    }
    
    return { type: 'none' };
  }
  
  // ─── Wrappers para operaciones comunes ─────────────────────────────────────
  async function wrapAsync(operation, context = {}) {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      const handled = handle(error, context);
      return { success: false, error: handled };
    }
  }
  
  function wrapSync(operation, context = {}) {
    try {
      const result = operation();
      return { success: true, data: result };
    } catch (error) {
      const handled = handle(error, context);
      return { success: false, error: handled };
    }
  }
  
  // ─── Toast específicos por tipo de error ───────────────────────────────────
  function showErrorToast(handledError) {
    if (typeof window !== 'undefined' && window.Alerts) {
      window.Alerts.error(handledError.message);
    } else {
      alert(handledError.message);
    }
  }
  
  function showWarningToast(handledError) {
    if (typeof window !== 'undefined' && window.Alerts) {
      window.Alerts.warning(handledError.message);
    } else {
      alert(handledError.message);
    }
  }
  
  // ─── Recuperación específica por contexto ───────────────────────────────
  async function recoverFromFirebaseError() {
    if (typeof window !== 'undefined' && window.FirebaseClient) {
      try {
        const result = await window.FirebaseClient.initialize();
        if (result.success) {
          if (window.Logger) {
            window.Logger.info('ErrorHandler', 'Firebase reconnection successful');
          }
          return true;
        }
      } catch (e) {
        if (window.Logger) {
          window.Logger.error('ErrorHandler', 'Firebase reconnection failed', e);
        }
      }
    }
    return false;
  }
  
  // ─── Exportar funciones públicas ───────────────────────────────────────────
  return {
    handle,
    wrapAsync,
    wrapSync,
    showErrorToast,
    showWarningToast,
    recoverFromFirebaseError,
    ERROR_TYPES
  };
})();

// Exponer globalmente
if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
}