/**
 * CONTROL PERSONAL CAMPO — api.js
 * API para operaciones CRUD y sincronización
 * Implementación JavaScript para reemplazar TypeScript eliminado
 * @version 1.5.0
 */

(() => {
  'use strict';

  // ─── Helpers ─────────────────────────────────────────────────────────
  const AppState = window.AppState;
  const LS_KEYS = window.LS_KEYS;
  const FirebaseClient = window.FirebaseClient;

  function id(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('[API] No se pudo persistir localmente:', error);
    }
  }

  function connected() {
    const Persist = window.CPC && window.CPC.Persist;
    if (Persist && typeof Persist.getWriteCapability === 'function') {
      return Persist.getWriteCapability().ok;
    }
    if (!FirebaseClient) return false;
    if (!FirebaseClient.isReady()) return false;
    const state = FirebaseClient.getConnectionState();
    const user = FirebaseClient.getCurrentUser && FirebaseClient.getCurrentUser();
    return (state === 'connected' || state === 'degraded') && Boolean(user);
  }

  function updateConnection(value) {
    AppState.set('connected', value);
    if (value) {
      AppState.set('backendMode', 'firestore');
    } else {
      AppState.set('backendMode', 'local');
    }
  }

  function normalizeWorker(payload, previous) {
    const Persist = window.CPC && window.CPC.Persist;
    const workerId = String(payload.id || (previous && previous.ID_Trabajador) || id('TRAB'));
    const prev = previous || {};
    const rawWa = payload.whatsapp != null ? payload.whatsapp : prev.WhatsApp;
    const whatsapp = Persist && Persist.normalizeWhatsApp
      ? Persist.normalizeWhatsApp(rawWa)
      : String(rawWa || '').replace(/\D/g, '').slice(0, 15);
    const nombre = String(payload.nombre || prev.Nombre_Completo || '');
    const dpi = String(payload.dpi || prev.DPI_CUI || '');
    return {
      ID_Trabajador: workerId,
      Nombre_Completo: nombre,
      DPI_CUI: dpi,
      Puesto: String(payload.puesto || prev.Puesto || ''),
      Jefe_Inmediato: String(payload.jefe != null ? payload.jefe : (prev.Jefe_Inmediato || '')),
      Telefono: String(payload.telefono != null ? payload.telefono : (prev.Telefono || '')),
      WhatsApp: whatsapp,
      Direccion: String(payload.direccion != null ? payload.direccion : (prev.Direccion || '')),
      Fotografia_URL: String(payload.fotografia != null ? payload.fotografia : (prev.Fotografia_URL || '')),
      Codigo_QR_Data: prev.Codigo_QR_Data || JSON.stringify({ id: workerId, dpi, nombre }),
      Fecha_Registro: prev.Fecha_Registro || new Date().toISOString(),
      Estado: prev.Estado || 'Activo',
    };
  }

  /**
   * Persiste un trabajador en caché local y opcionalmente encola sync.
   * @param {object} worker
   * @param {boolean} isEdit
   * @param {object} payload
   * @param {boolean} enqueueSync
   */
  function persistWorkerLocal(worker, isEdit, payload, enqueueSync) {
    const personal = AppState.get('personal') || [];
    const idx = personal.findIndex((w) => w.ID_Trabajador === worker.ID_Trabajador);
    const updated = [...personal];
    if (idx >= 0) updated[idx] = { ...updated[idx], ...worker };
    else updated.push(worker);
    AppState.set('personal', updated);
    write(LS_KEYS.PERSONAL_CACHE, updated);
    if (enqueueSync) {
      enqueue(isEdit ? 'personal-update' : 'personal-create', { ...payload, id: worker.ID_Trabajador });
    }
  }

  async function guardarTrabajador(payload) {
    const Persist = window.CPC && window.CPC.Persist;
    const isEdit = !!(payload.id && (AppState.get('personal') || []).find((w) => w.ID_Trabajador === payload.id));
    const existing = isEdit ? (AppState.get('personal') || []).find((w) => w.ID_Trabajador === payload.id) : null;
    const worker = normalizeWorker(payload, existing);

    const capability = Persist && Persist.getWriteCapability
      ? Persist.getWriteCapability()
      : { ok: connected(), reason: 'Sin capacidad de escritura en nube.', code: 'offline' };

    // Sin sesión / sin red: guardar local + cola, mensaje honesto
    if (!capability.ok) {
      persistWorkerLocal(worker, isEdit, payload, true);
      const msg = capability.code === 'auth-required'
        ? (isEdit
          ? 'Guardado en este dispositivo. Inicia sesión en Ajustes para subirlo a la nube.'
          : 'Registrado en este dispositivo. Inicia sesión en Ajustes para subirlo a la nube.')
        : (isEdit ? 'Trabajador actualizado localmente (se sincronizará al conectar).' : 'Trabajador registrado localmente (se sincronizará al conectar).');
      return Persist
        ? Persist.localSuccess(worker, msg, true)
        : { success: true, data: worker, offline: true, message: msg, mode: 'queued', needsAuth: capability.needsAuth };
    }

    try {
      if (isEdit) {
        const updateFields = {
          ID_Trabajador:   worker.ID_Trabajador,
          Nombre_Completo: worker.Nombre_Completo,
          DPI_CUI:         worker.DPI_CUI,
          Puesto:          worker.Puesto,
          Jefe_Inmediato:  worker.Jefe_Inmediato,
          Telefono:        worker.Telefono,
          WhatsApp:        worker.WhatsApp,
          Direccion:       worker.Direccion,
          Fotografia_URL:  worker.Fotografia_URL,
          Estado:          worker.Estado,
          Fecha_Registro:  worker.Fecha_Registro,
        };
        await FirebaseClient.save('personal', worker.ID_Trabajador, updateFields, true);
      } else {
        await FirebaseClient.save('personal', worker.ID_Trabajador, worker, false);
      }
      // Refrescar caché local alineada con la nube
      persistWorkerLocal(worker, isEdit, payload, false);
      try {
        await obtenerPersonal();
      } catch (refreshErr) {
        // El documento ya está en la nube y en caché local; no convertir éxito en fallo.
        console.warn('[API] Post-save refresh omitido:', refreshErr && refreshErr.message);
      }
      const okMsg = isEdit ? 'Trabajador actualizado en la nube' : 'Trabajador registrado en la nube';
      return Persist ? Persist.cloudSuccess(worker, okMsg) : { success: true, data: worker, message: okMsg, mode: 'cloud' };
    } catch (error) {
      console.error('[API] Error guardarTrabajador:', error);
      const classified = Persist && Persist.classifyFirestoreError
        ? Persist.classifyFirestoreError(error)
        : { code: error.code || 'unknown', message: error.message || 'Error al guardar' };

      // Red / permiso: no perder datos — local + cola, pero avisar con claridad
      if (classified.code === 'unavailable' || classified.code === 'permission-denied' || classified.code === 'unauthenticated') {
        persistWorkerLocal(worker, isEdit, payload, true);
        return {
          success: true,
          data: worker,
          offline: true,
          mode: 'queued',
          message: classified.code === 'permission-denied' || classified.code === 'unauthenticated'
            ? `${isEdit ? 'Actualizado' : 'Registrado'} en este dispositivo. ${classified.message}`
            : (isEdit ? 'Actualizado localmente (sin red). Se sincronizará automáticamente.' : 'Registrado localmente (sin red). Se sincronizará automáticamente.'),
          code: classified.code,
          needsAuth: classified.needsAuth,
          needsRole: classified.needsRole,
        };
      }

      if (classified.code === 'invalid-argument' || classified.code === 'failed-precondition') {
        return Persist
          ? Persist.blocked(classified.message, { code: classified.code })
          : { success: false, error: classified.message, mode: 'blocked' };
      }

      return {
        success: false,
        mode: 'blocked',
        error: classified.message,
        message: classified.message,
        code: classified.code,
      };
    }
  }

  function normalizeAttendance(payload) {
    const marcacionId = payload.ID_Marcacion || id('MARC');
    const horaReal = payload.horaReal || payload.Hora_Real ||
      new Date().toLocaleTimeString('es-GT', { hour12: false }).substring(0, 5);
    return {
      ID_Marcacion:      marcacionId,
      ID_Registro:       marcacionId,
      ID_Trabajador:     payload.idTrabajador    || payload.ID_Trabajador    || payload.id || '',
      Nombre_Trabajador: payload.nombreTrabajador|| payload.Nombre_Trabajador|| payload.nombre || '',
      Fecha:             payload.fecha           || payload.Fecha            || AppState.today(),
      Tipo_Marcacion:    payload.tipoMarcacion   || payload.Tipo_Marcacion   || payload.tipo || 'Entrada',
      Hora_Programada:   payload.horaProgramada  || payload.Hora_Programada  || '',
      Hora_Real:         horaReal,
      Estado_Marcacion:  payload.estadoMarcacion || payload.Estado_Marcacion || 'A Tiempo',
      Metodo_Registro:   payload.metodo          || payload.Metodo_Registro  || 'Manual',
      Horas_Extra:       Number(payload.horasExtra ?? payload.Horas_Extra ?? 0) || 0,
      Ubicacion_Obra:    payload.obra            || payload.Ubicacion_Obra   || '',
      GPS_Latitud:       payload.GPS_Latitud  ?? payload.gpsData?.latitude  ?? null,
      GPS_Longitud:      payload.GPS_Longitud ?? payload.gpsData?.longitude ?? null,
      GPS_Accuracy:      payload.GPS_Accuracy ?? payload.gpsData?.accuracy  ?? null,
      Geofence_Inside:   payload.GPS_Dentro_Geocerca ?? payload.geofenceStatus?.inside ?? null,
      Geofence_Distance: payload.geofenceStatus?.distance ?? null,
      Timestamp:         payload.Timestamp || Date.now(),
    };
  }

  function findRecentDuplicate(record) {
    const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
    const appState = AppState.get('asistencias') || [];
    const combined = [...cached, ...appState.filter((a) => !cached.find((c) => c.ID_Marcacion === a.ID_Marcacion))];
    const same = combined.find((c) =>
      c.ID_Trabajador === record.ID_Trabajador &&
      c.Tipo_Marcacion === record.Tipo_Marcacion &&
      c.Fecha === record.Fecha,
    );
    if (!same || !same.Hora_Real || !record.Hora_Real) return false;
    const toMin = (h) => { const p = h.split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); };
    return Math.abs(toMin(record.Hora_Real) - toMin(same.Hora_Real)) <= 2;
  }

  function enqueue(type, payload) {
    const queue = read(LS_KEYS.OFFLINE_QUEUE, []);
    queue.push({ id: id('Q'), type, payload, timestamp: new Date().toISOString() });
    write(LS_KEYS.OFFLINE_QUEUE, queue);
    AppState.set('offlineQueue', queue.length);
  }

  // ─── Trabajadores ───────────────────────────────────────────────────────
  async function obtenerPersonal() {
    try {
      if (connected()) {
        // Verificar autenticación explícita antes de consultar.
        // FirebaseClient no expone `.auth`; usar getCurrentUser().
        const currentUser = FirebaseClient && typeof FirebaseClient.getCurrentUser === 'function'
          ? FirebaseClient.getCurrentUser()
          : null;
        if (!currentUser) {
          const cached = read(LS_KEYS.PERSONAL_CACHE, []);
          AppState.set('personal', cached);
          return { success: true, data: cached, offline: true, error: 'sin_autenticar' };
        }
        const workers = await FirebaseClient.list('personal', 'Nombre_Completo');
        // Filtrar solo activos para la vista principal
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
      // Manejo específico de errores de Firebase
      if (error.code === 'permission-denied') {
        console.warn('[API] Permiso denegado en obtenerPersonal, usando caché local');
      }
      if (error.code === 'unavailable' || error.code === 'network-request-failed') {
        console.warn('[API] Error de red en obtenerPersonal, usando caché local');
      }
      const cached = read(LS_KEYS.PERSONAL_CACHE, []);
      return { success: true, data: cached, offline: true, error: error.code };
    }
  }

  // ─── Baja lógica de trabajador ───────────────────────────────────────────
  async function eliminarPersonal(workerId) {
    try {
      if (connected()) {
        // Firestore allow update requiere isValidWorkerData → documento completo
        const personal = AppState.get('personal') || [];
        const existing = personal.find((w) => w.ID_Trabajador === workerId);
        if (!existing) return { success: false, error: 'Trabajador no encontrado en cache' };
        const updateFields = {
          ID_Trabajador:   existing.ID_Trabajador,
          Nombre_Completo: existing.Nombre_Completo,
          DPI_CUI:         existing.DPI_CUI,
          Puesto:          existing.Puesto,
          Jefe_Inmediato:  existing.Jefe_Inmediato  || '',
          Telefono:        existing.Telefono        || '',
          WhatsApp:        existing.WhatsApp        || '',
          Direccion:       existing.Direccion       || '',
          Fotografia_URL:  existing.Fotografia_URL  || '',
          Estado:          'Inactivo',
          Fecha_Registro:  existing.Fecha_Registro  || new Date().toISOString(),
        };
        await FirebaseClient.save('personal', workerId, updateFields, true);
        await obtenerPersonal();
        return { success: true };
      } else {
        const personal = AppState.get('personal') || [];
        const updated = personal.map((w) =>
          w.ID_Trabajador === workerId ? { ...w, Estado: 'Inactivo' } : w,
        );
        AppState.set('personal', updated);
        write(LS_KEYS.PERSONAL_CACHE, updated);
        enqueue('personal-delete', { id: workerId });
        return { success: true, offline: true };
      }
    } catch (error) {
      console.error('[API] Error eliminarPersonal:', error);
      if (error.code === 'permission-denied' || (error.message && error.message.includes('permission'))) {
        const personal = AppState.get('personal') || [];
        const updated = personal.map((w) =>
          w.ID_Trabajador === workerId ? { ...w, Estado: 'Inactivo' } : w,
        );
        AppState.set('personal', updated);
        write(LS_KEYS.PERSONAL_CACHE, updated);
        enqueue('personal-delete', { id: workerId });
        return { success: true, offline: true };
      }
      return { success: false, error: error.message };
    }
  }

  // ─── Asistencias ───────────────────────────────────────────────────────────
  async function obtenerAsistencias(fecha = AppState.today()) {
    try {
      if (connected()) {
        // Solo where Fecha== (equality). NO orderBy en servidor: evita índice
        // compuesto Fecha+Hora_Real y el error en consola. Orden en cliente.
        const asistencias = await FirebaseClient.list(
          'asistencias', null, null,
          [['Fecha', '==', fecha]],
        );
        asistencias.sort((a, b) => String(a.Hora_Real || '').localeCompare(String(b.Hora_Real || '')));
        AppState.set('asistencias', asistencias);
        const existing = read(LS_KEYS.ATTENDANCE_CACHE, []).filter((a) => a.Fecha !== fecha);
        write(LS_KEYS.ATTENDANCE_CACHE, [...existing, ...asistencias]);
        return { success: true, data: asistencias };
      } else {
        const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
        const filtered = cached.filter((a) => a.Fecha === fecha);
        filtered.sort((a, b) => String(a.Hora_Real || '').localeCompare(String(b.Hora_Real || '')));
        AppState.set('asistencias', filtered);
        return { success: true, data: filtered, offline: true };
      }
    } catch (error) {
      // No spamear consola con errores recuperables; caché local es suficiente.
      if (error && (error.code === 'permission-denied' || /permission/i.test(error.message || ''))) {
        console.warn('[API] obtenerAsistencias: sin permisos, usando caché local');
      } else if (error && /requires an index/i.test(error.message || '')) {
        console.warn('[API] obtenerAsistencias: índice no listo, usando caché local');
      } else {
        console.warn('[API] obtenerAsistencias falló, usando caché:', error && error.message);
      }
      const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
      const filtered = cached.filter((a) => a.Fecha === fecha);
      filtered.sort((a, b) => String(a.Hora_Real || '').localeCompare(String(b.Hora_Real || '')));
      AppState.set('asistencias', filtered);
      return { success: true, data: filtered, offline: true, error: error.code || 'cache-fallback' };
    }
  }

  async function obtenerAsistenciaRango(fechaInicio, fechaFin) {
    try {
      if (connected()) {
        // Rango de fechas: orderBy omitido para evitar requerir índice compuesto.
        // Firestore permite where+where sobre el mismo campo sin índice adicional
        // cuando no hay orderBy. El orden se aplica en cliente.
        const asistencias = await FirebaseClient.list(
          'asistencias', null, null,
          [['Fecha', '>=', fechaInicio], ['Fecha', '<=', fechaFin]],
        );
        asistencias.sort((a, b) => (a.Fecha || '').localeCompare(b.Fecha || ''));
        return { success: true, data: asistencias };
      } else {
        const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
        const filtered = cached.filter((a) => a.Fecha >= fechaInicio && a.Fecha <= fechaFin);
        return { success: true, data: filtered, offline: true };
      }
    } catch (error) {
      console.error('[API] Error obtenerAsistenciaRango:', error);
      const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
      const filtered = cached.filter((a) => a.Fecha >= fechaInicio && a.Fecha <= fechaFin);
      return { success: true, data: filtered, offline: true };
    }
  }

  async function registrarMarcacion(payload) {
    const marcacion = normalizeAttendance(payload);
    if (findRecentDuplicate(marcacion)) {
      return { success: true, data: [], duplicate: true, offline: !connected(), message: 'Marcación duplicada ignorada.' };
    }
    try {
      if (connected()) {
        // Firestore: create con merge=false para respetar allow create
        await FirebaseClient.save('asistencias', marcacion.ID_Marcacion, marcacion, false);
        const asistencias = AppState.get('asistencias') || [];
        const updated = [...asistencias, marcacion];
        AppState.set('asistencias', updated);
        write(LS_KEYS.ATTENDANCE_CACHE, updated);
        return {
          success: true,
          data: marcacion,
          horaReal: marcacion.Hora_Real,
          estadoMarcacion: marcacion.Estado_Marcacion,
        };
      } else {
        const asistencias = AppState.get('asistencias') || [];
        const updated = [...asistencias, marcacion];
        AppState.set('asistencias', updated);
        write(LS_KEYS.ATTENDANCE_CACHE, updated);
        enqueue('attendance-create', payload);
        const Persist = window.CPC && window.CPC.Persist;
        const cap = Persist && Persist.getWriteCapability ? Persist.getWriteCapability() : {};
        const msg = cap.code === 'auth-required'
          ? 'Marcación guardada en este dispositivo. Inicia sesión en Ajustes para subirla a la nube.'
          : 'Marcación guardada localmente (se sincronizará al conectar).';
        return {
          success: true,
          data: marcacion,
          offline: true,
          mode: 'queued',
          message: msg,
          needsAuth: !!cap.needsAuth,
          horaReal: marcacion.Hora_Real,
          estadoMarcacion: marcacion.Estado_Marcacion,
        };
      }
    } catch (error) {
      console.error('[API] Error registrarMarcacion:', error);
      if (error.code === 'permission-denied' || (error.message && error.message.includes('permission'))) {
        const asistencias = AppState.get('asistencias') || [];
        const updated = [...asistencias, marcacion];
        AppState.set('asistencias', updated);
        write(LS_KEYS.ATTENDANCE_CACHE, updated);
        enqueue('attendance-create', payload);
        return {
          success: true,
          data: marcacion,
          offline: true,
          horaReal: marcacion.Hora_Real,
          estadoMarcacion: marcacion.Estado_Marcacion,
        };
      }
      return { success: false, error: error.message };
    }
  }

  async function actualizarAsistencia(marcacionId, payload) {
    try {
      if (connected()) {
        const asistencias = AppState.get('asistencias') || [];
        const existing = asistencias.find((a) => a.ID_Marcacion === marcacionId);
        if (!existing) return { success: false, error: 'Marcación no encontrada' };
        const horaReal       = payload.horaReal       || existing.Hora_Real;
        const estadoMarcacion = payload.estadoMarcacion || existing.Estado_Marcacion;
        const horasExtra     = payload.horasExtra !== undefined ? payload.horasExtra : existing.Horas_Extra;
        // Firestore allow update valida isValidAttendanceData sobre el documento completo
        // → enviamos el documento completo con merge=true (solo los 3 campos cambian)
        const fullDoc = {
          ...existing,
          Hora_Real:        horaReal,
          Estado_Marcacion: estadoMarcacion,
          Horas_Extra:      horasExtra,
        };
        await FirebaseClient.save('asistencias', marcacionId, fullDoc, true);
        const updated = { ...existing, Hora_Real: horaReal, Estado_Marcacion: estadoMarcacion, Horas_Extra: horasExtra };
        const newCache = asistencias.map((a) => a.ID_Marcacion === marcacionId ? updated : a);
        AppState.set('asistencias', newCache);
        write(LS_KEYS.ATTENDANCE_CACHE, newCache);
        return { success: true, data: updated };
      } else {
        const asistencias = AppState.get('asistencias') || [];
        const updated = asistencias.map((a) =>
          a.ID_Marcacion === marcacionId ? { ...a, Hora_Real: payload.horaReal || a.Hora_Real, Estado_Marcacion: payload.estadoMarcacion || a.Estado_Marcacion, Horas_Extra: payload.horasExtra !== undefined ? payload.horasExtra : a.Horas_Extra } : a,
        );
        AppState.set('asistencias', updated);
        write(LS_KEYS.ATTENDANCE_CACHE, updated);
        enqueue('attendance-update', { id: marcacionId, payload });
        return { success: true, offline: true };
      }
    } catch (error) {
      console.error('[API] Error actualizarAsistencia:', error);
      if (error.code === 'permission-denied' || (error.message && error.message.includes('permission'))) {
        const asistencias = AppState.get('asistencias') || [];
        const updated = asistencias.map((a) =>
          a.ID_Marcacion === marcacionId ? { ...a, Hora_Real: payload.horaReal || a.Hora_Real, Estado_Marcacion: payload.estadoMarcacion || a.Estado_Marcacion, Horas_Extra: payload.horasExtra !== undefined ? payload.horasExtra : a.Horas_Extra } : a,
        );
        AppState.set('asistencias', updated);
        write(LS_KEYS.ATTENDANCE_CACHE, updated);
        enqueue('attendance-update', { id: marcacionId, payload });
        return { success: true, offline: true };
      }
      return { success: false, error: error.message };
    }
  }

  async function eliminarAsistencia(marcacionId) {
    try {
      if (connected()) {
        await FirebaseClient.remove('asistencias', marcacionId);
        const asistencias = AppState.get('asistencias') || [];
        const newCache = asistencias.filter((a) => a.ID_Marcacion !== marcacionId);
        AppState.set('asistencias', newCache);
        write(LS_KEYS.ATTENDANCE_CACHE, newCache);
        return { success: true };
      } else {
        const asistencias = AppState.get('asistencias') || [];
        const newCache = asistencias.filter((a) => a.ID_Marcacion !== marcacionId);
        AppState.set('asistencias', newCache);
        write(LS_KEYS.ATTENDANCE_CACHE, newCache);
        enqueue('attendance-delete', { id: marcacionId });
        return { success: true, offline: true };
      }
    } catch (error) {
      console.error('[API] Error eliminarAsistencia:', error);
      if (error.code === 'permission-denied' || (error.message && error.message.includes('permission'))) {
        const asistencias = AppState.get('asistencias') || [];
        const newCache = asistencias.filter((a) => a.ID_Marcacion !== marcacionId);
        AppState.set('asistencias', newCache);
        write(LS_KEYS.ATTENDANCE_CACHE, newCache);
        enqueue('attendance-delete', { id: marcacionId });
        return { success: true, offline: true };
      }
      return { success: false, error: error.message };
    }
  }

  // ─── Alertas ─────────────────────────────────────────────────────────────
  async function obtenerAlertas() {
    try {
      if (connected()) {
        const alertas = await FirebaseClient.list('alertas', 'Timestamp');
        AppState.set('alertas', alertas);
        write(LS_KEYS.ALERTS_CACHE, alertas);
        return { success: true, data: alertas };
      } else {
        const cached = read(LS_KEYS.ALERTS_CACHE, []);
        AppState.set('alertas', cached);
        return { success: true, data: cached, offline: true };
      }
    } catch (error) {
      console.error('[API] Error obtenerAlertas:', error);
      const cached = read(LS_KEYS.ALERTS_CACHE, []);
      return { success: true, data: cached, offline: true };
    }
  }

  async function marcarAlertaRevisada(alertId) {
    try {
      if (connected()) {
        // merge=true es obligatorio: sin él `set()` reemplaza el documento
        // completo, la regla `hasOnly(['Revisada'])` deniega la operación y,
        // de colarse, se perderían Tipo/Mensaje/Timestamp de la alerta.
        await FirebaseClient.save('alertas', alertId, { Revisada: true }, true);
      }
      const alertas = AppState.get('alertas') || [];
      const updated = alertas.map((a) =>
        (a.ID_Alerta === alertId || a.id === alertId) ? { ...a, Revisada: true } : a,
      );
      AppState.set('alertas', updated);
      write(LS_KEYS.ALERTS_CACHE, updated);
      return { success: true };
    } catch (error) {
      console.error('[API] Error marcarAlertaRevisada:', error);
      if (error.code === 'permission-denied' || (error.message && error.message.includes('permission'))) {
        const alertas = AppState.get('alertas') || [];
        const updated = alertas.map((a) =>
          (a.ID_Alerta === alertId || a.id === alertId) ? { ...a, Revisada: true } : a,
        );
        AppState.set('alertas', updated);
        write(LS_KEYS.ALERTS_CACHE, updated);
        return { success: true, offline: true };
      }
      return { success: false, error: error.message };
    }
  }

  // ─── Configuración ──────────────────────────────────────────────────────
  async function obtenerConfiguracion() {
    // Siempre leer local primero (evita error de permisos si el usuario no es admin)
    const localConfig = AppState.get('config') || {};
    if (connected()) {
      try {
        // Solo admins pueden leer configuracion en Firestore
        const docs = await FirebaseClient.list('configuracion', null, 1);
        if (docs.length > 0) {
          const remoteConfig = { ...localConfig, ...docs[0] };
          AppState.set('config', remoteConfig);
          write(LS_KEYS.CONFIG, remoteConfig);
          return { success: true, data: remoteConfig };
        }
      } catch (err) {
        // Permiso denegado (usuario no admin) → usar config local silenciosamente
        if (window.Logger) window.Logger.warn('API', 'obtenerConfiguracion: sin permisos, usando local', { error: err.message });
      }
    }
    return { success: true, data: localConfig };
  }

  async function guardarConfiguracion(payload) {
    const config = { ...(AppState.get('config') || {}), ...payload };
    AppState.set('config', config);
    write(LS_KEYS.CONFIG, config);
    if (connected()) {
      try {
        await FirebaseClient.save('configuracion', 'general', config);
      } catch (error) {
        console.warn('[API] Error guardando config en Firestore:', error);
        return { success: true, data: config, offline: true };
      }
    }
    return { success: true, data: config };
  }

  // ─── Sincronización ───────────────────────────────────────────────────────
  async function syncOfflineQueue() {
    const queue = read(LS_KEYS.OFFLINE_QUEUE, []);
    if (queue.length === 0) return { success: true, enviadas: 0, errores: 0 };

    // Sin sesión / sin red: no intentar (evita permission-denied en bucle)
    if (!connected()) {
      return {
        success: false,
        enviadas: 0,
        errores: queue.length,
        error: 'Se requiere sesión y conexión para sincronizar.',
        needsAuth: true,
      };
    }

    const failed = [];
    let synced = 0;
    for (const item of queue) {
      try {
        if (item.type === 'personal-create') {
          const worker = normalizeWorker(item.payload);
          await FirebaseClient.save('personal', worker.ID_Trabajador, worker, false);
        } else if (item.type === 'personal-update') {
          const existing = (AppState.get('personal') || []).find((w) => w.ID_Trabajador === item.payload.id);
          const worker = normalizeWorker(item.payload, existing);
          const updateFields = {
            ID_Trabajador: worker.ID_Trabajador, Nombre_Completo: worker.Nombre_Completo,
            DPI_CUI: worker.DPI_CUI, Puesto: worker.Puesto, Jefe_Inmediato: worker.Jefe_Inmediato,
            Telefono: worker.Telefono, WhatsApp: worker.WhatsApp, Direccion: worker.Direccion,
            Fotografia_URL: worker.Fotografia_URL, Estado: worker.Estado,
            Fecha_Registro: worker.Fecha_Registro,
          };
          await FirebaseClient.save('personal', worker.ID_Trabajador, updateFields, true);
        } else if (item.type === 'personal-delete') {
          // Igual que eliminarPersonal: necesita documento completo para isValidWorkerData
          const existingW = (AppState.get('personal') || []).find((w) => w.ID_Trabajador === item.payload.id);
          if (existingW) {
            const delFields = {
              ID_Trabajador:   existingW.ID_Trabajador,
              Nombre_Completo: existingW.Nombre_Completo,
              DPI_CUI:         existingW.DPI_CUI,
              Puesto:          existingW.Puesto,
              Jefe_Inmediato:  existingW.Jefe_Inmediato  || '',
              Telefono:        existingW.Telefono        || '',
              WhatsApp:        existingW.WhatsApp        || '',
              Direccion:       existingW.Direccion       || '',
              Fotografia_URL:  existingW.Fotografia_URL  || '',
              Estado:          'Inactivo',
              Fecha_Registro:  existingW.Fecha_Registro  || new Date().toISOString(),
            };
            await FirebaseClient.save('personal', item.payload.id, delFields, true);
          } else {
            failed.push(item);
            continue;
          }
        } else if (item.type === 'attendance-create') {
          const marcacion = normalizeAttendance(item.payload);
          await FirebaseClient.save('asistencias', marcacion.ID_Marcacion, marcacion, false);
        } else if (item.type === 'attendance-update') {
          const existing = (AppState.get('asistencias') || []).find((a) => a.ID_Marcacion === item.payload.id);
          if (!existing) throw new Error('Marcación pendiente no encontrada para actualizar');
          const patch = item.payload.payload || {};
          // Documento completo para pasar isValidAttendanceData en Firestore
          await FirebaseClient.save('asistencias', item.payload.id, {
            ...existing,
            Hora_Real:        patch.horaReal        || existing.Hora_Real,
            Estado_Marcacion: patch.estadoMarcacion || existing.Estado_Marcacion,
            Horas_Extra:      patch.horasExtra !== undefined ? patch.horasExtra : existing.Horas_Extra,
          }, true);
        } else if (item.type === 'attendance-delete') {
          await FirebaseClient.remove('asistencias', item.payload.id);
        }
        synced++;
      } catch (error) {
        console.error('[API] Error sync item:', error);
        failed.push(item);
      }
    }
    write(LS_KEYS.OFFLINE_QUEUE, failed);
    if (synced > 0) {
      write(LS_KEYS.LAST_SYNC, new Date().toISOString());
      AppState.set('lastSync', new Date().toISOString());
      await obtenerPersonal();
    }
    return { success: true, enviadas: synced, errores: failed.length };
  }

  // ─── Exportar API ───────────────────────────────────────────────────────
  window.API = {
    ping: async () => {
      if (!FirebaseClient || !FirebaseClient.isReady()) {
        updateConnection(false);
        return { success: false, mode: 'local' };
      }
      if (!FirebaseClient.getCurrentUser || !FirebaseClient.getCurrentUser()) {
        updateConnection(false);
        return { success: false, mode: 'auth-required', error: 'Sesión de Firebase requerida.' };
      }
      const healthy = await FirebaseClient.checkHealth();
      updateConnection(healthy);
      return healthy ? { success: true, mode: 'firestore' } : { success: false, mode: 'local' };
    },
    obtenerPersonal,
    // Aliases usados por ModuloPersonal
    registrarPersonal: guardarTrabajador,
    actualizarPersonal: guardarTrabajador,
    guardarTrabajador,
    eliminarPersonal,
    obtenerAsistencias,
    obtenerAsistenciaRango,
    registrarMarcacion,
    actualizarAsistencia,
    eliminarAsistencia,
    obtenerAlertas,
    marcarAlertaRevisada,
    obtenerConfiguracion,
    guardarConfiguracion,
    syncOfflineQueue,
    getOfflineQueue: () => read(LS_KEYS.OFFLINE_QUEUE, []),
  };
})();
