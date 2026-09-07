/**
 * CONTROL PERSONAL CAMPO — api.js
 * Conector de comunicación asíncrona con Google Apps Script.
 * Todas las llamadas son via fetch() con manejo robusto de errores.
 * @version 1.0.0
 */

const API = (() => {
  // ─── Constantes ──────────────────────────────────────────────────────────
  const TIMEOUT_MS   = 30000;  // 30 segundos máximo por request
  const RETRY_COUNT  = 2;      // Reintentos en caso de error de red

  // ─── Helpers privados ────────────────────────────────────────────────────

  /**
   * Obtiene la URL actual del Web App de Google Apps Script.
   * @returns {string} URL del endpoint
   * @throws {Error} Si no hay URL configurada
   */
  function _getUrl() {
    const url = AppState.get('gasUrl');
    if (!url) {
      throw new Error('URL de Google Apps Script no configurada. Ve a Ajustes para configurarla.');
    }
    return url;
  }

  /**
   * Realiza un POST con JSON al endpoint de GAS.
   * @param {object} body - Cuerpo del request
   * @param {number} retries - Reintentos restantes
   * @returns {Promise<object>} Respuesta parseada
   */
  async function _post(body, retries = RETRY_COUNT) {
    const url = _getUrl();

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body:    JSON.stringify(body),
        signal:  controller.signal,
        // Google Apps Script requiere no-cors en algunos contextos,
        // pero para Web Apps desplegadas como "Anyone" funciona con cors normal.
        mode:    'cors',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          url: url
        };
        throw new Error(`Error HTTP ${response.status}: ${response.statusText} al conectar con ${url}`);
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Respuesta inválida del servidor. Se esperaba JSON pero se recibió: ${text.substring(0, 100)}`);
      }

      return data;

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        throw new Error(`Tiempo de espera agotado (${TIMEOUT_MS}ms). Verifica tu conexión a internet o la URL del servidor.`);
      }

      // Reintento en error de red (no de aplicación)
      if (retries > 0 && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed'))) {
        console.warn(`[API] Error de red detectado, reintentando... (${RETRY_COUNT - retries + 1}/${RETRY_COUNT})`);
        await _sleep(800); // Usar valor directo hasta que CONSTANTS esté disponible
        return _post(body, retries - 1);
      }

      throw err;
    }
  }

  /**
   * Wrapper para solicitudes GET (usando postData con action en URL param).
   * GAS doGet acepta parámetros de URL.
   */
  async function _get(action, params = {}) {
    const url = _getUrl();
    const queryParams = new URLSearchParams({ action, ...params });
    const fullUrl = `${url}?${queryParams.toString()}`;

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Tiempo de espera agotado.');
      }
      throw err;
    }
  }

  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Actualizar estado de conexión ───────────────────────────────────────
  function _setConnectionStatus(connected) {
    AppState.set('connected',  connected);
    AppState.set('connecting', false);

    const dot  = document.querySelector('.connection-dot');
    const text = document.getElementById('connection-text');

    if (dot) {
      dot.className = 'connection-dot ' + (connected ? 'connected' : 'disconnected');
    }
    if (text) {
      text.textContent = connected ? 'Conectado a Sheets' : 'Sin conexión';
    }
  }

  // ─── Offline Queue ────────────────────────────────────────────────────────

  function _getQueue() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEYS.OFFLINE_QUEUE) || '[]');
    } catch { return []; }
  }

  function _saveQueue(queue) {
    try {
      localStorage.setItem(LS_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    } catch (e) { console.warn('[API] No se pudo guardar la queue offline:', e.message); }
  }

  function _encolarMarcacion(payload) {
    const queue = _getQueue();
    const item  = {
      id:        'Q-' + Date.now(),
      payload,
      timestamp: new Date().toISOString(),
    };
    queue.push(item);
    _saveQueue(queue);
    _notifyQueueChange();

    return {
      success:          true,
      offline:          true,
      estadoMarcacion:  'Pendiente',
      horaReal:         `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}:00`,
      message:          'Marcación guardada localmente. Se enviará al reconectar.',
    };
  }

  function _notifyQueueChange() {
    const count = _getQueue().length;
    AppState.set('offlineQueue', count);
  }

  function _actualizarLastSync() {
    const now = new Date().toISOString();
    try {
      localStorage.setItem(LS_KEYS.LAST_SYNC, now);
    } catch (e) { /* ignorar */ }
    AppState.set('lastSync', now);
  }

  // ─── API PÚBLICA ─────────────────────────────────────────────────────────
  return {

    // ═══════════════════ PING / CONEXIÓN ═══════════════════
    async ping() {
      AppState.set('connecting', true);
      const dot = document.querySelector('.connection-dot');
      if (dot) dot.className = 'connection-dot connecting';

      try {
        const result = await _post({ action: 'ping' });
        _setConnectionStatus(result.success === true);
        return result;
      } catch (err) {
        _setConnectionStatus(false);
        throw err;
      }
    },

    // ═══════════════════ PERSONAL ═══════════════════
    async obtenerPersonal() {
      const result = await _post({ action: 'obtenerPersonal' });
      if (result.success && Array.isArray(result.data)) {
        AppState.set('personal', result.data);
        // Cachear en localStorage
        try {
          localStorage.setItem(LS_KEYS.PERSONAL_CACHE, JSON.stringify(result.data));
          localStorage.setItem(LS_KEYS.LAST_SYNC, new Date().toISOString());
        } catch (e) { /* Ignorar errores de quota */ }
      }
      return result;
    },

    async registrarPersonal(payload) {
      const result = await _post({ action: 'registrarPersonal', payload });
      if (result.success) {
        // Refrescar cache
        await this.obtenerPersonal().catch(() => {});
      }
      return result;
    },

    async actualizarPersonal(payload) {
      const result = await _post({ action: 'actualizarPersonal', payload });
      if (result.success) {
        await this.obtenerPersonal().catch(() => {});
      }
      return result;
    },

    async eliminarPersonal(id) {
      const result = await _post({ action: 'eliminarPersonal', id });
      if (result.success) {
        // Actualizar cache local inmediatamente
        const personal = AppState.get('personal').filter(p => p.ID_Trabajador !== id);
        AppState.set('personal', personal);
      }
      return result;
    },

    // ═══════════════════ ASISTENCIAS ═══════════════════
    async registrarMarcacion(payload) {
      // Si no hay URL configurada o no hay conexión → encolar localmente
      if (!AppState.get('gasUrl') || !AppState.get('connected')) {
        return _encolarMarcacion(payload);
      }
      try {
        const result = await _post({ action: 'registrarMarcacion', payload });
        if (result.success) {
          _actualizarLastSync();
        }
        return result;
      } catch (err) {
        // Si el request falla (red caída), encolar
        console.warn('[API] Marcación no enviada, encolando offline:', err.message);
        return _encolarMarcacion(payload);
      }
    },

    async obtenerAsistencias(fecha) {
      const result = await _post({ action: 'obtenerAsistencias', fecha: fecha || AppState.today() });
      if (result.success && Array.isArray(result.data)) {
        AppState.set('asistencias', result.data);
      }
      return result;
    },

    async obtenerAsistenciaRango(fechaInicio, fechaFin) {
      return await _post({ action: 'obtenerAsistenciaRango', fechaInicio, fechaFin });
    },

    // ═══════════════════ ALERTAS ═══════════════════
    async obtenerAlertas() {
      const result = await _post({ action: 'obtenerAlertas' });
      if (result.success && Array.isArray(result.data)) {
        AppState.set('alertas', result.data);
      }
      return result;
    },

    async marcarAlertaRevisada(id) {
      return await _post({ action: 'marcarAlertaRevisada', id });
    },

    // ═══════════════════ CONFIGURACIÓN ═══════════════════
    async obtenerConfiguracion() {
      const result = await _post({ action: 'obtenerConfiguracion' });
      if (result.success && result.data) {
        const newConfig = { ...DEFAULT_CONFIG, ...result.data };
        AppState.set('config', newConfig);
        localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));
      }
      return result;
    },

    async guardarConfiguracion(payload) {
      const result = await _post({ action: 'guardarConfiguracion', payload });
      if (result.success) {
        // Actualizar estado local
        const currentConfig = AppState.get('config');
        const newConfig = { ...currentConfig, ...payload };
        AppState.set('config', newConfig);
        localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));
      }
      return result;
    },

    // ═══════════════════ MODO OFFLINE ═══════════════════
    /**
     * Retorna true si hay URL configurada pero sin conexión activa.
     */
    isOffline() {
      return AppState.get('gasUrl') !== '' && !AppState.get('connected');
    },

    /**
     * Obtener personal del cache local (sin llamada API).
     */
    getPersonalFromCache() {
      return AppState.get('personal') || [];
    },

    // ═══════════════════ OFFLINE QUEUE ═══════════════════
    /**
     * Obtener marcaciones pendientes de la queue.
     */
    getOfflineQueue() {
      return _getQueue();
    },

    /**
     * Intentar sincronizar todas las marcaciones en la queue.
     * @returns {Promise<{enviadas: number, errores: number}>}
     */
    async syncOfflineQueue() {
      const queue = _getQueue();
      if (queue.length === 0) return { enviadas: 0, errores: 0 };
      if (!AppState.get('gasUrl')) return { enviadas: 0, errores: queue.length };

      let enviadas = 0;
      let errores  = 0;
      const pendientes = [...queue];
      const nuevaQueue = [];

      for (const item of pendientes) {
        try {
          const result = await _post({ action: 'registrarMarcacion', payload: item.payload });
          if (result.success) {
            enviadas++;
          } else {
            nuevaQueue.push(item);
            errores++;
          }
        } catch (err) {
          nuevaQueue.push(item);
          errores++;
        }
      }

      _saveQueue(nuevaQueue);
      _notifyQueueChange();
      if (enviadas > 0) _actualizarLastSync();
      return { enviadas, errores };
    },
  };
})();
