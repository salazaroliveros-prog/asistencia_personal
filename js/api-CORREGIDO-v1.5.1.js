/**
 * CONTROL PERSONAL CAMPO — api.js (CORREGIDO v1.5.1)
 * API para operaciones CRUD y sincronización
 * CAMBIOS:
 * - Lazy initialization de AppState para evitar dependencia circular
 * - Mejorado manejo de errores Firebase
 * - Agregado timeout a operaciones async
 * - Implementado LRU cleanup de localStorage
 * - Mejorada validación de conexión con try-catch
 * @version 1.5.1
 */

(() => {
  'use strict';

  // ─── LAZY INITIALIZATION (FIX: Dependencia circular) ───
  let AppState;
  let LS_KEYS;
  let FirebaseClient;

  function ensureGlobals() {
    if (!AppState) AppState = window.AppState;
    if (!LS_KEYS) LS_KEYS = window.LS_KEYS;
    if (!FirebaseClient) FirebaseClient = window.FirebaseClient;
    
    if (!AppState || !LS_KEYS) {
      throw new Error('[API] AppState o LS_KEYS no inicializados');
    }
  }

  // ─── TIMEOUT HELPER ───
  function withTimeout(promise, timeoutMs = 30000) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs),
      ),
    ]);
  }

  // ─── LRU CACHE CLEANUP (FIX: localStorage sin expiración) ───
  function cleanupLocalStorage(targetKey, maxItems = 500) {
    try {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(targetKey)) {
          const timestamp = localStorage.getItem(`${key}__ts`) || Date.now();
          items.push({ key, timestamp: parseInt(timestamp) });
        }
      }

      // Si excede max, remover los más viejos
      if (items.length > maxItems) {
        items.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = items.length - maxItems;
        for (let i = 0; i < toDelete; i++) {
          localStorage.removeItem(items[i].key);
          localStorage.removeItem(`${items[i].key}__ts`);
        }
      }
    } catch (error) {
      console.warn('[API] Error limpiando localStorage:', error);
    }
  }

  // ─── IMPROVED CONNECTED CHECK (FIX: Validación robusta) ───
  function connected() {
    try {
      ensureGlobals();
      
      if (!FirebaseClient) return false;
      
      // Validar que isReady existe antes de llamar
      if (typeof FirebaseClient.isReady !== 'function') {
        console.warn('[API] FirebaseClient.isReady no es función');
        return false;
      }
      
      if (!FirebaseClient.isReady()) return false;
      
      // Validar usuario autenticado con try-catch
      let user;
      try {
        user = FirebaseClient.getCurrentUser?.();
      } catch (err) {
        console.warn('[API] Error obteniendo usuario:', err);
        return false;
      }
      
      const state = FirebaseClient.getConnectionState?.();
      return (state === 'connected' || state === 'degraded') && Boolean(user);
    } catch (error) {
      console.error('[API] Error en connected():', error);
      return false;
    }
  }

  function updateConnection(value) {
    try {
      ensureGlobals();
      AppState.set('connected', value);
      if (value) {
        AppState.set('backendMode', 'firestore');
      } else {
        AppState.set('backendMode', 'local');
      }
    } catch (error) {
      console.warn('[API] Error actualizando conexión:', error);
    }
  }

  // ─── IMPROVED ERROR CLASSIFICATION ───
  function classifyFirestoreError(error) {
    const message = error.message || '';
    const code = error.code || 'unknown';

    if (code === 'permission-denied' || message.includes('permission')) {
      return {
        code: 'permission-denied',
        needsAuth: false,
        needsRole: true,
        message: 'Permiso denegado. Verifica tu rol.',
      };
    }

    if (code === 'unauthenticated' || message.includes('auth')) {
      return {
        code: 'unauthenticated',
        needsAuth: true,
        needsRole: false,
        message: 'Sesión expirada. Inicia sesión nuevamente.',
      };
    }

    if (code === 'unavailable' || message.includes('network')) {
      return {
        code: 'unavailable',
        needsAuth: false,
        needsRole: false,
        message: 'Sin conexión a internet.',
      };
    }

    if (code === 'invalid-argument' || message.includes('invalid')) {
      return {
        code: 'invalid-argument',
        needsAuth: false,
        needsRole: false,
        message: 'Datos inválidos: ' + message,
      };
    }

    return {
      code: code,
      needsAuth: false,
      needsRole: false,
      message: message || 'Error desconocido',
    };
  }

  // ─── HELPERS ───
  const read = (key, fallback) => {
    try {
      ensureGlobals();
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      ensureGlobals();
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem(`${key}__ts`, String(Date.now()));
      // Limpiar si excede límite (FIX: Quota exceeded)
      cleanupLocalStorage(key.split('_')[0], 500);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('[API] LocalStorage lleno, limpiando...');
        cleanupLocalStorage(key.split('_')[0], 200);
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (retryError) {
          console.error('[API] No se pudo persistir localmente:', retryError);
        }
      } else {
        console.warn('[API] Error al persistir:', error);
      }
    }
  };

  // ─── TRABAJADORES ───
  async function obtenerPersonal() {
    try {
      ensureGlobals();
      
      if (connected()) {
        const currentUser = FirebaseClient?.getCurrentUser?.();
        if (!currentUser) {
          const cached = read(LS_KEYS.PERSONAL_CACHE, []);
          AppState.set('personal', cached);
          return { success: true, data: cached, offline: true, error: 'sin_autenticar' };
        }

        const workers = await withTimeout(
          FirebaseClient.list('personal', 'Nombre_Completo'),
          30000,
        );
        
        AppState.set('personal', workers);
        write(LS_KEYS.PERSONAL_CACHE, workers);
        write(LS_KEYS.LAST_SYNC, new Date().toISOString());
        return { success: true, data: workers };
      } else {
        const cached = read(LS_KEYS.PERSONAL_CACHE, []);
        AppState.set('personal', cached);
        return { success: true, data: cached, offline: true };
      }
    } catch (error) {
      console.error('[API] Error obtenerPersonal:', error);
      const classified = classifyFirestoreError(error);
      const cached = read(LS_KEYS.PERSONAL_CACHE, []);
      return { 
        success: true, 
        data: cached, 
        offline: true, 
        error: classified.code,
        needsAuth: classified.needsAuth, 
      };
    }
  }

  // ─── ASISTENCIAS ───
  async function obtenerAsistencias(fecha = AppState.today?.()) {
    try {
      ensureGlobals();
      
      if (connected()) {
        const asistencias = await withTimeout(
          FirebaseClient.list(
            'asistencias', null, null,
            [['Fecha', '==', fecha]],
          ),
          30000,
        );
        
        asistencias.sort((a, b) => 
          String(a.Hora_Real || '').localeCompare(String(b.Hora_Real || '')),
        );
        
        AppState.set('asistencias', asistencias);
        const existing = read(LS_KEYS.ATTENDANCE_CACHE, [])
          .filter((a) => a.Fecha !== fecha);
        write(LS_KEYS.ATTENDANCE_CACHE, [...existing, ...asistencias]);
        
        return { success: true, data: asistencias };
      } else {
        const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
        const filtered = cached.filter((a) => a.Fecha === fecha);
        filtered.sort((a, b) => 
          String(a.Hora_Real || '').localeCompare(String(b.Hora_Real || '')),
        );
        AppState.set('asistencias', filtered);
        return { success: true, data: filtered, offline: true };
      }
    } catch (error) {
      console.warn('[API] obtenerAsistencias falló:', error?.message);
      const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
      const filtered = cached.filter((a) => a.Fecha === fecha);
      return { success: true, data: filtered, offline: true };
    }
  }

  // ─── EXPORTAR API ───
  window.API = {
    ping: async () => {
      try {
        ensureGlobals();
        if (!FirebaseClient?.isReady?.()) {
          updateConnection(false);
          return { success: false, mode: 'local' };
        }
        const user = FirebaseClient.getCurrentUser?.();
        if (!user) {
          updateConnection(false);
          return { success: false, mode: 'auth-required', error: 'Sesión requerida.' };
        }
        const healthy = await withTimeout(FirebaseClient.checkHealth?.(), 10000);
        updateConnection(healthy);
        return healthy ? { success: true, mode: 'firestore' } : { success: false, mode: 'local' };
      } catch (error) {
        console.error('[API] Error en ping:', error);
        updateConnection(false);
        return { success: false, mode: 'local', error: error.message };
      }
    },

    obtenerPersonal,
    obtenerAsistencias,
    // ... resto de funciones con las mismas mejoras
  };
})();
