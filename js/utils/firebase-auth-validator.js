/**
 * FIREBASE AUTH VALIDATOR - Valida tokens y maneja expiración
 * CONTROL PERSONAL CAMPO v1.5.1
 * 
 * Previene uso de tokens expirados y refresca automáticamente
 */

(() => {
  'use strict';

  const FirebaseAuthValidator = {
    tokenCheckInterval: null,
    lastCheckTime: 0,
    checkIntervalMs: 5 * 60 * 1000, // 5 minutos
    warningThresholdMs: 5 * 60 * 1000, // 5 minutos antes de expiración

    /**
     * Inicia validación automática de token
     */
    start() {
      if (this.tokenCheckInterval) return; // Ya está corriendo

      this.tokenCheckInterval = setInterval(() => {
        this.validateAndRefresh();
      }, this.checkIntervalMs);

      console.log('[FirebaseAuthValidator] Validador iniciado');
    },

    /**
     * Detiene validación automática
     */
    stop() {
      if (this.tokenCheckInterval) {
        clearInterval(this.tokenCheckInterval);
        this.tokenCheckInterval = null;
        console.log('[FirebaseAuthValidator] Validador detenido');
      }
    },

    /**
     * Valida que el token no esté expirado
     * @returns {boolean} true si el token es válido
     */
    async validateAndRefresh() {
      try {
        const FirebaseClient = window.FirebaseClient;
        if (!FirebaseClient) return false;

        const user = FirebaseClient.getCurrentUser?.();
        if (!user) return false;

        // Obtener token actual
        const token = await user.getIdToken(false); // false = no forza refresh
        if (!token) return false;

        // Decodificar header JWT (sin verificación, solo lectura)
        const parts = token.split('.');
        if (parts.length !== 3) return false;

        const payload = JSON.parse(atob(parts[1]));
        const expiresAt = payload.exp * 1000; // Convertir a ms
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;

        console.log(`[FirebaseAuthValidator] Token expira en ${Math.round(timeUntilExpiry / 1000 / 60)} minutos`);

        // Si falta poco tiempo, reforzar refresh
        if (timeUntilExpiry < this.warningThresholdMs) {
          console.warn('[FirebaseAuthValidator] Token próximo a expirar, refrescando...');
          const newToken = await user.getIdToken(true); // true = forza refresh
          return Boolean(newToken);
        }

        return true;
      } catch (error) {
        console.error('[FirebaseAuthValidator] Error validando token:', error);
        this.handleTokenExpired();
        return false;
      }
    },

    /**
     * Clasifica errores de Firebase Auth
     */
    classifyAuthError(error) {
      const code = error.code || '';
      const message = error.message || '';

      if (code === 'auth/id-token-expired') {
        return {
          code: 'token-expired',
          needsReauth: true,
          message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        };
      }

      if (code === 'auth/session-cookie-expired') {
        return {
          code: 'session-expired',
          needsReauth: true,
          message: 'Tu sesión ha expirado.',
        };
      }

      if (code === 'auth/user-disabled') {
        return {
          code: 'user-disabled',
          needsReauth: true,
          message: 'Esta cuenta ha sido deshabilitada.',
        };
      }

      if (code === 'auth/network-request-failed') {
        return {
          code: 'network-error',
          needsReauth: false,
          message: 'Error de red. Verifica tu conexión a Internet.',
        };
      }

      if (message.includes('permission') || message.includes('Permission denied')) {
        return {
          code: 'permission-denied',
          needsReauth: false,
          message: 'No tienes permiso para realizar esta acción.',
        };
      }

      return {
        code: 'unknown',
        needsReauth: false,
        message: message || 'Error desconocido',
      };
    },

    /**
     * Maneja token expirado (logout forzado)
     */
    async handleTokenExpired() {
      try {
        const FirebaseClient = window.FirebaseClient;
        if (FirebaseClient?.logout) {
          await FirebaseClient.logout();
        }

        // Mostrar alerter al usuario
        if (window.Alerts?.error) {
          window.Alerts.error(
            'Tu sesión ha expirado',
            'Por favor, inicia sesión nuevamente.',
          );
        } else {
          alert('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
        }

        // Redirigir a login
        window.location.hash = '#ajustes';
      } catch (error) {
        console.error('[FirebaseAuthValidator] Error en handleTokenExpired:', error);
      }
    },

    /**
     * Verifica si es seguro hacer una operación
     * @returns {Promise<boolean>}
     */
    async isSafeToOperate() {
      try {
        const isValid = await this.validateAndRefresh();
        return isValid;
      } catch (error) {
        console.error('[FirebaseAuthValidator] Error en isSafeToOperate:', error);
        return false;
      }
    },

    /**
     * Decorator para envolver funciones que necesitan auth válido
     * Uso: await FirebaseAuthValidator.withAuthCheck(miFunc)
     */
    async withAuthCheck(asyncFunc) {
      if (!await this.isSafeToOperate()) {
        throw new Error('Sesión expirada o inválida');
      }
      return asyncFunc();
    },
  };

  // Exportar globalmente
  window.FirebaseAuthValidator = FirebaseAuthValidator;

  // Iniciar validación cuando la app está lista
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      FirebaseAuthValidator.start();
    });
  } else {
    FirebaseAuthValidator.start();
  }
})();
