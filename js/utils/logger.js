/**
 * CONTROL PERSONAL CAMPO — utils/logger.js
 * Sistema de logging mejorado con niveles, timestamps y persistencia
 * @version 1.0.0
 */

const Logger = (() => {
  
  // ─── Configuración ───────────────────────────────────────────────────────
  const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
  };
  
  const CURRENT_LEVEL = LOG_LEVELS.DEBUG; // Cambiar a INFO en producción
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
    
    // Interceptar errores globales
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        error('Global Error', event.message, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        });
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        error('Unhandled Promise Rejection', event.reason?.message || 'Unknown rejection', {
          reason: event.reason,
          stack: event.reason?.stack
        });
      });
    }
    
    initialized = true;
    info('Logger', 'Logger inicializado', { sessionId });
  }
  
  // ─── Funciones de logging ───────────────────────────────────────────────
  function debug(category, message, data) {
    _log('DEBUG', category, message, data);
  }
  
  function info(category, message, data) {
    _log('INFO', category, message, data);
  }
  
  function warn(category, message, data) {
    _log('WARN', category, message, data);
  }
  
  function error(category, message, data) {
    _log('ERROR', category, message, data);
  }
  
  function fatal(category, message, data) {
    _log('FATAL', category, message, data);
  }
  
  // ─── Función interna de logging ───────────────────────────────────────────
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
      sessionId: 'session-' + Date.now().toString(36).substring(2, 8)
    };
    
    // Agregar stack trace para errores
    if (level === 'ERROR' || level === 'FATAL') {
      if (data && typeof data === 'object' && data.stack) {
        entry.stack = data.stack;
      } else if (new Error().stack) {
        entry.stack = new Error().stack;
      }
    }
    
    // Agregar ID de usuario si está disponible
    if (typeof window !== 'undefined' && window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
      entry.userId = window.firebase.auth().currentUser.uid;
    }
    
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
      filtered = filtered.filter(entry => entry.level === level);
    }
    
    if (category) {
      filtered = filtered.filter(entry => entry.category === category);
    }
    
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }
  
  // ─── Limpiar logs ───────────────────────────────────────────────────────
  function clearLogs() {
    logEntries = [];
    try {
      localStorage.removeItem(LOG_STORAGE_KEY);
    } catch (e) {
      console.warn('[Logger] Error clearing logs:', e);
    }
    info('Logger', 'Logs limpiados');
  }
  
  // ─── Exportar logs ───────────────────────────────────────────────────────
  function exportLogs(): string {
    const logs = getLogs();
    const exportData = {
      exportDate: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  // ─── Estadísticas de logs ───────────────────────────────────────────────
  function getStats() {
    const stats = {
      total: logEntries.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      recentErrors: logEntries.filter(e => e.level === 'ERROR' || e.level === 'FATAL').slice(-10)
    };
    
    // Contar por nivel
    Object.keys(LOG_LEVELS).forEach(level => {
      stats.byLevel[level] = logEntries.filter(e => e.level === level).length;
    });
    
    // Contar por categoría
    const categories = new Set(logEntries.map(e => e.category));
    categories.forEach(category => {
      stats.byCategory[category] = logEntries.filter(e => e.category === category).length;
    });
    
    return stats;
  }
  
  // ─── Establecer nivel de logging ───────────────────────────────────────
  function setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      CURRENT_LEVEL = LOG_LEVELS[level];
      info('Logger', `Nivel de logging cambiado a ${level}`);
    }
  }
  
  // ─── Exportar funciones públicas ───────────────────────────────────────────
  return {
    init,
    debug,
    info,
    warn,
    error,
    fatal,
    getLogs,
    clearLogs,
    exportLogs,
    getStats,
    setLevel
  };
})();

// Auto-inicializar
if (typeof window !== 'undefined') {
  Logger.init();
  window.Logger = Logger;
}