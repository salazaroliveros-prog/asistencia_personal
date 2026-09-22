/**
 * SISTEMA DE LOGGING CENTRALIZADO
 * CONTROL PERSONAL CAMPO v1.5.1
 * 
 * Reemplaza console.log/error/warn con logging consistente
 * Integrable con Sentry y otros servicios
 */

(() => {
  'use strict';

  const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4,
  };

  const CentralizedLogger = {
    currentLevel: LogLevel.DEBUG, // Mostrar todo en desarrollo
    useRemote: false, // Enviar a Sentry en producción
    remoteQueue: [],

    /**
     * Establece el nivel de logging
     * @param {string} level - 'debug', 'info', 'warn', 'error', 'critical'
     */
    setLevel(level) {
      const levelKey = level.toUpperCase();
      if (LogLevel[levelKey] !== undefined) {
        this.currentLevel = LogLevel[levelKey];
        console.log(`[Logger] Nivel establecido a: ${level}`);
      }
    },

    /**
     * Log de nivel DEBUG
     */
    debug(module, message, data = null) {
      this._log(LogLevel.DEBUG, module, message, data, '#gray');
    },

    /**
     * Log de nivel INFO
     */
    info(module, message, data = null) {
      this._log(LogLevel.INFO, module, message, data, '#0066cc');
    },

    /**
     * Log de nivel WARN
     */
    warn(module, message, data = null) {
      this._log(LogLevel.WARN, module, message, data, '#ff9900');
    },

    /**
     * Log de nivel ERROR
     */
    error(module, message, data = null) {
      this._log(LogLevel.ERROR, module, message, data, '#cc0000');
    },

    /**
     * Log de nivel CRITICAL (emergencia)
     */
    critical(module, message, data = null) {
      this._log(LogLevel.CRITICAL, module, message, data, '#990000');
    },

    /**
     * Implementación interna del logging
     * @private
     */
    _log(level, module, message, data, color) {
      // Verificar nivel mínimo
      if (level < this.currentLevel) return;

      const timestamp = new Date().toISOString();
      const levelName = Object.keys(LogLevel).find((k) => LogLevel[k] === level);

      // Formato de consola
      const prefix = `[${timestamp}] [${levelName}] [${module}]`;
      const formatted = `%c${prefix} ${message}`;

      // Consola local
      if (data) {
        console[this._getConsoleMethod(level)](formatted, `color: ${color}; font-weight: bold;`, data);
      } else {
        console[this._getConsoleMethod(level)](formatted, `color: ${color}; font-weight: bold;`);
      }

      // Enviar a remoto si está habilitado (Sentry, DataDog, etc.)
      if (this.useRemote && level >= LogLevel.WARN) {
        this._sendToRemote(levelName, module, message, data);
      }

      // Guardar en histórico local (últimas 100)
      this._addToHistory(levelName, module, message, data, timestamp);
    },

    /**
     * Obtiene el método console apropiado
     * @private
     */
    _getConsoleMethod(level) {
      switch (level) {
        case LogLevel.DEBUG:
          return 'debug';
        case LogLevel.INFO:
          return 'info';
        case LogLevel.WARN:
          return 'warn';
        case LogLevel.ERROR:
        case LogLevel.CRITICAL:
          return 'error';
        default:
          return 'log';
      }
    },

    /**
     * Envía log a servicio remoto
     * @private
     */
    _sendToRemote(level, module, message, data) {
      const logEntry = {
        level,
        module,
        message,
        data,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Si Sentry está disponible, usarlo
      if (window.Sentry) {
        const sentryLevel = level === 'CRITICAL' ? 'fatal' : level.toLowerCase();
        window.Sentry.captureMessage(message, sentryLevel);
        if (data) {
          window.Sentry.captureException(new Error(JSON.stringify(data)));
        }
        return;
      }

      // De lo contrario, encolar para envío posterior
      this.remoteQueue.push(logEntry);
      if (this.remoteQueue.length > 100) {
        this.remoteQueue.shift(); // Mantener últimos 100
      }
    },

    /**
     * Guarda en histórico local
     * @private
     */
    _addToHistory(level, module, message, data, timestamp) {
      if (!this._history) {
        this._history = [];
      }

      this._history.push({
        level,
        module,
        message,
        data,
        timestamp,
      });

      // Mantener últimas 100 entradas
      if (this._history.length > 100) {
        this._history.shift();
      }
    },

    /**
     * Obtiene el histórico de logs
     */
    getHistory() {
      return this._history || [];
    },

    /**
     * Exporta logs para debugging
     */
    exportLogs(format = 'json') {
      const logs = {
        history: this.getHistory(),
        remoteQueue: this.remoteQueue,
        timestamp: new Date().toISOString(),
      };

      if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      } else if (format === 'csv') {
        return this._convertToCSV(logs.history);
      }

      return logs;
    },

    /**
     * Convierte logs a CSV
     * @private
     */
    _convertToCSV(logs) {
      const headers = 'Timestamp,Level,Module,Message,Data';
      const rows = logs.map((log) =>
        [
          log.timestamp,
          log.level,
          log.module,
          log.message,
          JSON.stringify(log.data || ''),
        ].join(','),
      );

      return [headers, ...rows].join('\n');
    },

    /**
     * Limpia el histórico
     */
    clearHistory() {
      this._history = [];
      this.remoteQueue = [];
      this.info('Logger', 'Histórico limpiado');
    },

    /**
     * Descarga los logs como archivo
     */
    downloadLogs(format = 'json') {
      const content = this.exportLogs(format);
      const filename = `logs-${new Date().toISOString().slice(0, 10)}.${format}`;

      const element = document.createElement('a');
      element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`);
      element.setAttribute('download', filename);
      element.style.display = 'none';

      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      this.info('Logger', `Logs descargados como ${filename}`);
    },
  };

  // Exportar globalmente
  window.CentralizedLogger = CentralizedLogger;

  // Crear alias global
  window.Log = {
    debug: (module, msg, data) => CentralizedLogger.debug(module, msg, data),
    info: (module, msg, data) => CentralizedLogger.info(module, msg, data),
    warn: (module, msg, data) => CentralizedLogger.warn(module, msg, data),
    error: (module, msg, data) => CentralizedLogger.error(module, msg, data),
    critical: (module, msg, data) => CentralizedLogger.critical(module, msg, data),
  };

  // Inicializar en desarrollo
  CentralizedLogger.info('Logger', 'Sistema de logging inicializado');
})();
