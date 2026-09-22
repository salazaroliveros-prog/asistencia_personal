/**
 * CONTROL PERSONAL CAMPO — utils/logger.js
 * Sistema de logging mejorado con niveles, timestamps y persistencia
 * @version 1.5.0
 */

const Logger = (() => {
  
  // ─── Configuración ───────────────────────────────────────────────────────
  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4,
  };
  
  const CURRENT_LEVEL = (typeof location !== 'undefined' && /localhost|127\.0\.0\.1/.test(location.hostname))
    ? LOG_LEVELS.DEBUG
    : LOG_LEVELS.INFO;
  const MAX_LOG_ENTRIES = 1000; // Máximo de logs en memoria
  const LOG_STORAGE_KEY = 'cpc_app_logs';
  
  // ─── Estado ─────────────────────────────────────────────────────────────
  let logEntries = [];
  let initialized = false;
  
  // ─── Tipos ─────────────────────────────────────────────────────────────
  // LogLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'
  
  // LogEntry structure:
  // {
  //   timestamp: string;
  //   level: string;
  //   category: string;
  //   message: string;
  //   data?: unknown;
  //   stack?: string;
  //   userId?: string;
  //   sessionId: string;
  // }
  
  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    if (initialized) return;
    
    // Cargar logs persistentes
    try {
      const savedLogs = localStorage.getItem(LOG_STORAGE_KEY);
      if (savedLogs) {
        logEntries = JSON.parse(savedLogs);
        // Mantener solo los últimos MAX_LOG_ENTRIES
        if (logEntries.length > MAX_LOG_ENTRIES) {
          logEntries = logEntries.slice(-MAX_LOG_ENTRIES);
        }
      }
    } catch (e) {
      console.warn('[Logger] Error loading saved logs:', e);
    }
    
    // Generar ID de sesión
    const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    
    // Interceptar errores globales: desactivado aquí.
    // app.js registra un único handler con filtros (Firebase App / shutting down).
    // Evita doble console.error y doble toast por el mismo fallo.
    
    initialized = true;
    info('Logger', 'Logger inicializado', { sessionId });
  }
  
  // ─── Funciones de logging ───────────────────────────────────────────────
  function info(category, message, data) {
    _log('INFO', category, message, data);
  }
  
  function warn(category, message, data) {
    _log('WARN', category, message, data);
  }
  
  function error(category, message, data) {
    _log('ERROR', category, message, data);
  }
  
  // ─── Función interna de logging ───────────────────────────────────────────
  /**
   * Obtiene el uid del usuario sin lanzar si Firebase no está inicializado.
   * Preferir FirebaseClient; fallback a firebase.apps solo si hay app activa.
   * @returns {string|undefined}
   */
  function _safeCurrentUserId() {
    try {
      if (typeof window === 'undefined') return undefined;
      if (window.FirebaseClient && typeof window.FirebaseClient.getCurrentUser === 'function') {
        const user = window.FirebaseClient.getCurrentUser();
        return (user && user.uid) || undefined;
      }
      const fb = window.firebase;
      if (fb && Array.isArray(fb.apps) && fb.apps.length > 0 && typeof fb.auth === 'function') {
        const user = fb.auth().currentUser;
        return (user && user.uid) || undefined;
      }
    } catch (_) {
      /* Sin app / sin sesión: el logger no debe romper la UI */
    }
    return undefined;
  }

  function _log(level, category, message, data) {
    const levelValue = LOG_LEVELS[level];
    
    // Filtrar por nivel
    if (levelValue < CURRENT_LEVEL) {
      return;
    }
    
    // Crear entrada de log
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      sessionId: 'session-' + Date.now().toString(36).substring(2, 8),
    };
    
    // Agregar stack trace para errores
    if (level === 'ERROR' || level === 'FATAL') {
      if (data && typeof data === 'object' && data.stack) {
        entry.stack = data.stack;
      } else if (new Error().stack) {
        entry.stack = new Error().stack;
      }
    }
    
    // Agregar ID de usuario si está disponible — NUNCA llamar firebase.auth()
    // sin app: el SDK lanza "No Firebase App '[DEFAULT]'" y rompe flujos
    // (p. ej. guardar personal) porque Logger.info se ejecuta al inicio.
    const userId = _safeCurrentUserId();
    if (userId) entry.userId = userId;
    
    // Agregar a logs en memoria
    logEntries.push(entry);
    
    // Mantener límite de logs
    if (logEntries.length > MAX_LOG_ENTRIES) {
      logEntries = logEntries.slice(-MAX_LOG_ENTRIES);
    }
    
    // Persistir logs
    _persistLogs();
    
    // Mostrar en consola
    _logToConsole(entry);
  }
  
  // ─── Mostrar en consola ───────────────────────────────────────────────────
  function _logToConsole(entry) {
    const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.category}]`;
    const message = `${prefix} ${entry.message}`;
    
    switch (entry.level) {
      case 'DEBUG':
        console.debug(message, entry.data || '');
        break;
      case 'INFO':
        console.info(message, entry.data || '');
        break;
      case 'WARN':
        console.warn(message, entry.data || '');
        break;
      case 'ERROR':
        console.error(message, entry.data || '', entry.stack || '');
        break;
      case 'FATAL':
        console.error(message, entry.data || '', entry.stack || '');
        break;
    }
  }
  
  // ─── Persistir logs ───────────────────────────────────────────────────────
  function _persistLogs() {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logEntries));
    } catch (e) {
      console.warn('[Logger] Error persisting logs:', e);
    }
  }
  
  // ─── Obtener logs ───────────────────────────────────────────────────────
  function getLogs(level, category, limit) {
    let filtered = [...logEntries];
    
    if (level) {
      filtered = filtered.filter((entry) => entry.level === level);
    }
    
    if (category) {
      filtered = filtered.filter((entry) => entry.category === category);
    }
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }
  
  // ─── Estadísticas de logs ───────────────────────────────────────────────
  function getStats() {
    const stats = {
      total: logEntries.length,
      byLevel: {},
      byCategory: {},
      recentErrors: logEntries.filter((e) => e.level === 'ERROR' || e.level === 'FATAL').slice(-10),
    };
    
    // Contar por nivel
    Object.keys(LOG_LEVELS).forEach((level) => {
      stats.byLevel[level] = logEntries.filter((e) => e.level === level).length;
    });
    
    // Contar por categoría
    const categories = new Set(logEntries.map((e) => e.category));
    categories.forEach((category) => {
      stats.byCategory[category] = logEntries.filter((e) => e.category === category).length;
    });
    
    return stats;
  }
  
  // ─── Exportar funciones públicas ───────────────────────────────────────────
  return {
    init,
    info,
    warn,
    error,
    getLogs,
    getStats,
  };
})();

// Auto-inicializar
if (typeof window !== 'undefined') {
  Logger.init();
  window.Logger = Logger;
}