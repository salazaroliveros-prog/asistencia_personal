/**
 * CONFIGURACIÓN CENTRALIZADA
 * CONTROL PERSONAL CAMPO v1.5.1
 * 
 * Único punto de verdad para todas las configuraciones
 * Evita duplicación de valores hardcodeados
 */

(() => {
  'use strict';

  const CentralConfig = {
    // ── APLICACIÓN ──
    app: {
      name: 'CONTROL PERSONAL CAMPO',
      version: '1.5.1',
      environment: 'production',
    },

    // ── HORARIOS DE OBRA ──
    schedules: {
      entrada: '07:00',
      salidaReceso: '10:00',
      regresoReceso: '10:30',
      salidaObra: '17:00',
      toleranciaMinutos: 15,
    },

    // ── PUESTOS DE TRABAJO ──
    positions: [
      'Albañil',
      'Maestro de Obra',
      'Armador',
      'Carpintero',
      'Electricista',
      'Operador',
      'Residente',
      'Bodeguero',
      'Plomero',
      'Soldador',
    ],

    // ── GPS Y GEOCERCA ──
    gps: {
      enabledByDefault: true,
      requiredByDefault: false,
      accuracyThresholdMeters: 50, // Rechaza si accuracy > 50m
      updateIntervalMs: 5000, // 5 segundos
    },

    // ── LOCALSTORAGE Y CACHÉ ──
    storage: {
      maxItemsCache: 500,
      maxOldDaysOffline: 30,
      lruCleanupThreshold: 100, // Limpia cuando llega a 100
      ttlDays: 30, // Time to live de datos en caché
    },

    // ── VALIDACIONES ──
    validation: {
      dpi: {
        length: 13,
        pattern: /^\d{13}$/,
        useChecksum: true,
      },
      phone: {
        minLength: 8,
        pattern: /^[2-7]\d{7,}$/, // Guatemala: 8-15 dígitos, empieza 2-7
      },
      password: {
        minLength: 8,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecial: true,
      },
    },

    // ── TIMEOUTS ──
    timeouts: {
      firebaseOperation: 30000, // 30 segundos
      gpsLocation: 15000, // 15 segundos
      tokenValidationCheck: 5 * 60 * 1000, // 5 minutos
      requestOptimizer: 5000, // 5 segundos
    },

    // ── LÍMITES Y RATES ──
    limits: {
      apiCallsPerSecond: 10,
      maxUploadSizeMb: 10,
      imageCompression: {
        quality: 0.8, // 80%
        maxWidth: 800,
        maxHeight: 800,
        format: 'webp',
      },
    },

    // ── COLORES Y UI ──
    colors: {
      primary: '#003459',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#0066cc',
      positions: {
        'Albañil': '#8b4513',
        'Maestro de Obra': '#d4af37',
        'Armador': '#696969',
        'Carpintero': '#8b7355',
        'Electricista': '#ffd700',
        'Operador': '#0066cc',
        'Residente': '#228b22',
        'Bodeguero': '#ff6347',
        'Plomero': '#4169e1',
        'Soldador': '#dc143c',
      },
    },

    // ── LOGGING ──
    logging: {
      level: 'debug', // debug, info, warn, error, critical
      enableRemote: true, // Enviar a Sentry
      historySize: 100,
    },

    // ── SENTRY ──
    sentry: {
      enabled: true,
      // DSN opcional: se resuelve de forma segura porque este archivo se carga
      // como script clásico en el navegador (no existe `process`). Puede
      // sobreescribirse antes de cargar el script con:
      //   window.__SENTRY_DSN__ = 'https://...'
      dsn: (typeof window !== 'undefined' && window.__SENTRY_DSN__) || '',
      environment: 'production',
      tracesSampleRate: 0.1, // 10% de transacciones
    },

    // ── FIREBASE ──
    firebase: {
      tokenRefreshIntervalMs: 5 * 60 * 1000, // 5 minutos
      tokenExpiryWarningMs: 5 * 60 * 1000, // Alerta 5 min antes
      retryAttempts: 3,
      retryDelayMs: 1000,
    },

    // ── PWA ──
    pwa: {
      enabled: true,
      cacheName: 'control-personal-v1.5.1',
      precacheAssets: true,
      backgroundSync: true,
    },

    /**
     * Obtiene configuración por ruta (dot notation)
     * @example getByPath('gps.accuracyThresholdMeters')
     */
    getByPath(path) {
      return path.split('.').reduce((obj, key) => obj?.[key], this);
    },

    /**
     * Establece configuración por ruta
     */
    setByPath(path, value) {
      const keys = path.split('.');
      const lastKey = keys.pop();
      let obj = this;

      for (const key of keys) {
        if (!obj[key]) obj[key] = {};
        obj = obj[key];
      }

      obj[lastKey] = value;
    },

    /**
     * Obtiene toda la configuración (para debugging)
     */
    getAll() {
      return JSON.parse(JSON.stringify(this));
    },

    /**
     * Valida que la configuración sea válida
     */
    validate() {
      const errors = [];

      if (!this.app.version) errors.push('Version not set');
      if (!this.gps.accuracyThresholdMeters) errors.push('GPS accuracy threshold not set');
      if (!this.positions.length) errors.push('No positions configured');
      if (!this.schedules.entrada) errors.push('Schedule entrada not set');

      if (errors.length > 0) {
        console.error('[CentralConfig] Validation errors:', errors);
        return false;
      }

      return true;
    },
  };

  // Exportar globalmente
  window.CentralConfig = CentralConfig;

  // Validar al cargar
  if (!CentralConfig.validate()) {
    console.error('[CentralConfig] Configuration is invalid');
  } else {
    console.log(`[CentralConfig] Configuración v${CentralConfig.app.version} cargada`);
  }
})();
