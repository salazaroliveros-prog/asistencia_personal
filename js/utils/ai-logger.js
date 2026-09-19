/**
 * CONTROL PERSONAL CAMPO — utils/ai-logger.js
 * Sistema de logging avanzado con análisis inteligente de errores
 * @version 1.5.0
 */

const _AILogger = (() => {
  // Almacenamiento de errores para análisis de patrones
  const errorHistory = [];
  const MAX_ERROR_HISTORY = 100;
  
  // Patrones de errores conocidos
  const errorPatterns = {
    camera: {
      patterns: ['getUserMedia', 'NotAllowedError', 'NotFoundError', 'DevicesNotFoundError'],
      solutions: [
        'Verificar permisos de cámara en configuración del dispositivo',
        'Asegurar que el dispositivo tiene cámara disponible',
        'Reiniciar la aplicación y solicitar permisos nuevamente',
        'Verificar que no otra aplicación está usando la cámara',
      ],
    },
    gps: {
      patterns: ['getCurrentPosition', 'Permission denied', 'Position unavailable', 'timeout'],
      solutions: [
        'Verificar permisos de ubicación en configuración del dispositivo',
        'Asegurar que el GPS está habilitado en el dispositivo',
        'Verificar que la aplicación tiene acceso a ubicación',
        'Intentar conectarse a una red diferente para mejorar GPS',
      ],
    },
    network: {
      patterns: ['NetworkError', 'fetch failed', 'Network request failed', 'offline'],
      solutions: [
        'Verificar conexión a internet',
        'Reiniciar router o módem',
        'Verificar que el servidor está disponible',
        'Activar modo offline del sistema',
      ],
    },
    firebase: {
      patterns: ['FirebaseError', 'auth/network-request-failed', 'firestore/unavailable'],
      solutions: [
        'Verificar configuración de Firebase',
        'Revisar credenciales de Firebase',
        'Verificar que el proyecto Firebase está activo',
        'Comprobar reglas de Firestore',
      ],
    },
    storage: {
      patterns: ['QuotaExceededError', 'localStorage quota exceeded', 'storage full'],
      solutions: [
        'Limpiar caché del navegador',
        'Eliminar datos antiguos del sistema',
        'Reducir tamaño de imágenes almacenadas',
        'Considerar usar IndexedDB para más almacenamiento',
      ],
    },
    cameraHardware: {
      patterns: ['OverconstrainedError', 'Could not start video source', 'Hardware error'],
      solutions: [
        'Intentar usar cámara trasera en lugar de frontal',
        'Reducir resolución solicitada de cámara',
        'Verificar que no otra app está usando la cámara',
        'Reiniciar dispositivo móvil',
      ],
    },
  };

  /**
   * Analiza un error y determina su categoría
   * @param {Error} error - Error a analizar
   * @returns {Object} Análisis del error
   */
  function analyzeError(error) {
    const errorString = error.toString() + (error.stack || '');
    let category = 'unknown';
    let solutions = [];
    let severity = 'medium';
    let isHardwareIssue = false;

    // Analizar stack trace para detectar patrones
    for (const [categoryName, patternData] of Object.entries(errorPatterns)) {
      for (const pattern of patternData.patterns) {
        if (errorString.includes(pattern)) {
          category = categoryName;
          solutions = patternData.solutions;
          
          // Detectar si es error de hardware
          if (categoryName === 'cameraHardware' || categoryName === 'gps') {
            isHardwareIssue = true;
          }
          
          // Determinar severidad
          if (categoryName === 'cameraHardware' || categoryName === 'storage') {
            severity = 'high';
          } else if (categoryName === 'network') {
            severity = 'medium';
          } else {
            severity = 'low';
          }
          
          break;
        }
      }
      if (category !== 'unknown') break;
    }

    return {
      category,
      solutions,
      severity,
      isHardwareIssue,
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack,
    };
  }

  /**
   * Guarda error en historial para análisis de patrones
   * @param {Object} analysis - Análisis del error
   */
  function saveErrorToHistory(analysis) {
    errorHistory.push(analysis);
    
    // Mantener solo los últimos MAX_ERROR_HISTORY errores
    if (errorHistory.length > MAX_ERROR_HISTORY) {
      errorHistory.shift();
    }
    
    // Guardar en localStorage para persistencia
    try {
      localStorage.setItem('cpc_error_history', JSON.stringify(errorHistory));
    } catch (e) {
      console.warn('[AILogger] No se pudo guardar historial de errores:', e);
    }
  }

  /**
   * Analiza patrones recurrentes en errores
   * @returns {Object} Patrones detectados
   */
  function analyzePatterns() {
    const patterns = {};
    
    // Contar errores por categoría
    errorHistory.forEach((error) => {
      if (!patterns[error.category]) {
        patterns[error.category] = {
          count: 0,
          lastOccurrence: 0,
          severity: error.severity,
        };
      }
      patterns[error.category].count++;
      patterns[error.category].lastOccurrence = error.timestamp;
      patterns[error.category].severity = error.severity;
    });

    // Detectar patrones recurrentes (más de 3 veces en última hora)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentErrors = errorHistory.filter((e) => e.timestamp > oneHourAgo);
    
    const recurrentPatterns = {};
    Object.keys(patterns).forEach((category) => {
      if (patterns[category].count >= 3) {
        recurrentPatterns[category] = patterns[category];
      }
    });

    return {
      patterns,
      recurrentPatterns,
      recentErrors: recentErrors.length,
    };
  }

  /**
   * Genera sugerencia basada en análisis de error
   * @param {Object} analysis - Análisis del error
   * @returns {Object} Sugerencia generada
   */
  function generateSuggestion(analysis) {
    const suggestion = {
      error: analysis.error,
      category: analysis.category,
      severity: analysis.severity,
      isHardwareIssue: analysis.isHardwareIssue,
      timestamp: analysis.timestamp,
      message: '',
      actions: analysis.solutions,
      autoFixable: false,
      suggestedCodeFix: null,
    };

    // Generar mensaje de sugerencia
    if (analysis.isHardwareIssue) {
      suggestion.message = `⚠️ Error de hardware detectado: ${analysis.category}. El dispositivo puede necesitar intervención manual.`;
    } else {
      suggestion.message = `⚠️ Error detectado: ${analysis.category}. Se sugieren las siguientes acciones:`;
    }

    // Determinar si es auto-reparable
    if (analysis.category === 'storage') {
      suggestion.autoFixable = true;
      suggestion.suggestedCodeFix = 'limpiarCaché()';
    } else if (analysis.category === 'network') {
      suggestion.autoFixable = true;
      suggestion.suggestedCodeFix = 'activarModoOffline()';
    }

    return suggestion;
  }

  /**
   * Verifica errores recurrentes y genera alertas
   * @returns {Array} Alertas generadas
   */
  function checkRecurrentErrors() {
    const { recurrentPatterns } = analyzePatterns();
    const alerts = [];

    Object.entries(recurrentPatterns).forEach(([category, data]) => {
      if (data.count >= 5) {
        alerts.push({
          type: 'recurrent_error',
          category,
          count: data.count,
          severity: data.severity,
          message: `Error recurrente detectado: ${category} (ocurrió ${data.count} veces en la última hora)`,
          suggestion: 'Considerar revisar la configuración o reportar el problema al equipo técnico',
        });
      }
    });

    return alerts;
  }

  /**
   * Analiza rendimiento del sistema
   * @returns {Object} Análisis de rendimiento
   */
  function analyzePerformance() {
    const performance = {
      memory: {},
      network: {},
      errors: {},
    };

    // Analizar memoria
    if (performance.memory) {
      performance.memory.used = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB';
      performance.memory.total = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB';
      performance.memory.limit = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB';
    }

    // Analizar errores recientes
    const patterns = analyzePatterns();
    performance.errors = patterns;

    return performance;
  }

  /**
   * Genera reporte de salud del sistema
   * @returns {Object} Reporte de salud
   */
  function generateHealthReport() {
    const patterns = analyzePatterns();
    const alerts = checkRecurrentErrors();
    
    return {
      timestamp: Date.now(),
      systemHealth: alerts.length === 0 ? 'healthy' : 'issues_detected',
      errorCount: errorHistory.length,
      recentErrors: patterns.recentErrors,
      recurrentPatterns: Object.keys(patterns.recurrentPatterns),
      alerts,
      suggestions: alerts.map((alert) => alert.suggestion),
    };
  }

  /**
   * Log con análisis inteligente
   @param {string} level - Nivel de log (error, warn, info, debug)
   @param {string} message - Mensaje del log
   @param {Object} context - Contexto adicional
   @param {Error} error - Error opcional
   */
  function log(level, message, context = {}, error = null) {
    const logEntry = {
      level,
      message,
      context,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Si hay error, analizarlo
    if (error) {
      const analysis = analyzeError(error);
      saveErrorToHistory(analysis);
      logEntry.analysis = analysis;
      logEntry.suggestion = generateSuggestion(analysis);
    }

    // Guardar en localStorage para análisis
    try {
      const logs = JSON.parse(localStorage.getItem('cpc_ai_logs') || '[]');
      logs.push(logEntry);
      
      // Mantener solo últimos 500 logs
      if (logs.length > 500) {
        logs.shift();
      }
      
      localStorage.setItem('cpc_ai_logs', JSON.stringify(logs));
    } catch (e) {
      console.warn('[AILogger] No se pudo guardar logs:', e);
    }

    // Log a consola con formato
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [AI]`;
    console.log(prefix, message, context, error ? error.message : '', error ? error.stack : '');
  }

  /**
   * Obtiene historial de errores
   * @returns {Array} Historial de errores
   */
  function getErrorHistory() {
    return errorHistory;
  }

  /**
   * Obtiene logs del sistema
   * @returns {Array} Logs del sistema
   */
  function getLogs() {
    try {
      return JSON.parse(localStorage.getItem('cpc_ai_logs') || '[]');
    } catch (e) {
      return [];
    }
  }

  /**
   * Limpia historial de errores y logs
   */
  function clearHistory() {
    errorHistory.length = 0;
    localStorage.removeItem('cpc_error_history');
    localStorage.removeItem('cpc_ai_logs');
  }

  return {
    log,
    analyzeError,
    analyzePatterns,
    checkRecurrentErrors,
    generateSuggestion,
    analyzePerformance,
    generateHealthReport,
    getErrorHistory,
    getLogs,
    clearHistory,
  };
})();

// Exponer el módulo globalmente
window.AILogger = _AILogger;