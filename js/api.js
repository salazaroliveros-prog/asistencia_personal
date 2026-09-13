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
    if (!FirebaseClient) return false;
    if (!FirebaseClient.isReady()) return false;
    const state = FirebaseClient.getConnectionState();
    return (state === 'connected' || state === 'degraded') &&
           Boolean(AppState.get('connected'));
  }

  function updateConnection(value) {
    AppState.set('connected', value);
    const dot = document.querySelector('.connection-dot');
    if (dot) {
      dot.classList.toggle('connected', value);
      dot.classList.toggle('disconnected', !value);
    }
    const label = document.getElementById('connection-text');
    if (label) label.textContent = value ? 'Firestore en línea' : 'Modo local';
  }

  function normalizeWorker(payload, previous) {
    const workerId = String(payload.id || (previous && previous.ID_Trabajador) || id('TRAB'));
    const prev = previous || {};
    return {
      ID_Trabajador: workerId,
      Nombre_Completo: String(payload.nombre || prev.Nombre_Completo || ''),
      DPI_CUI: String(payload.dpi || prev.DPI_CUI || ''),
      Puesto: String(payload.puesto || prev.Puesto || ''),
      Jefe_Inmediato: String(payload.jefe || prev.Jefe_Inmediato || ''),
      Telefono: String(payload.telefono || prev.Telefono || ''),
      WhatsApp: String(payload.whatsapp || prev.WhatsApp || ''),
      Direccion: String(payload.direccion || prev.Direccion || ''),
      Fotografia_URL: String(payload.fotografia || prev.Fotografia_URL || ''),
      Codigo_QR_Data: prev.Codigo_QR_Data || JSON.stringify({ id: workerId, dpi: payload.dpi, nombre: payload.nombre }),
      Fecha_Registro: prev.Fecha_Registro || new Date().toISOString(),
      Estado: prev.Estado || 'Activo',
    };
  }

  function normalizeAttendance(payload) {
    const marcacionId = payload.ID_Marcacion || id('MARC');
    return {
      ID_Marcacion: marcacionId,
      ID_Registro: marcacionId,
      ID_Trabajador: payload.ID_Trabajador || payload.id || '',
      Nombre_Trabajador: payload.nombre || payload.Nombre_Trabajador || '',
      Fecha: payload.fecha || payload.Fecha || AppState.today(),
      Tipo_Marcacion: payload.tipo || payload.Tipo_Marcacion || 'Entrada',
      Hora_Programada: payload.horaProgramada || payload.Hora_Programada || '',
      Hora_Real: payload.horaReal || payload.Hora_Real || new Date().toLocaleTimeString('es-GT', { hour12: false }),
      Estado_Marcacion: payload.estadoMarcacion || payload.Estado_Marcacion || 'A Tiempo',
      Metodo_Registro: payload.metodo || payload.Metodo_Registro || 'Manual',
      Horas_Extra: Number(payload.horasExtra ?? payload.Horas_Extra ?? 0) || 0,
      Ubicacion_Obra: payload.ubicacion || payload.Ubicacion_Obra || '',
      Timestamp: payload.Timestamp || Date.now(),
    };
  }

  function findRecentDuplicate(record) {
    const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
    const same = cached.find(c =>
      c.ID_Trabajador === record.ID_Trabajador &&
      c.Tipo_Marcacion === record.Tipo_Marcacion &&
      c.Fecha === record.Fecha
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
        const workers = await FirebaseClient.list('personal', 'Nombre_Completo');
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
      const cached = read(LS_KEYS.PERSONAL_CACHE, []);
      return { success: true, data: cached, offline: true };
    }
  }

  async function guardarTrabajador(payload) {
    const worker = normalizeWorker(payload);
    try {
      if (connected()) {
        await FirebaseClient.save('personal', worker.ID_Trabajador, worker);
        await obtenerPersonal();
        return { success: true, data: worker };
      } else {
        const personal = AppState.get('personal') || [];
        const existing = personal.findIndex(w => w.ID_Trabajador === worker.ID_Trabajador);
        const updated = [...personal];
        if (existing >= 0) updated[existing] = worker; else updated.push(worker);
        AppState.set('personal', updated);
        write(LS_KEYS.PERSONAL_CACHE, updated);
        enqueue('personal-create', { ...payload, id: worker.ID_Trabajador });
        return { success: true, data: worker, offline: true };
      }
    } catch (error) {
      console.error('[API] Error guardarTrabajador:', error);
      return { success: false, error: error.message };
    }
  }

  async function eliminarPersonal(workerId) {
    const update = { Estado: 'Inactivo', Fecha_Eliminacion: new Date().toISOString() };
    try {
      if (connected()) {
        await FirebaseClient.save('personal', workerId, update);
        await obtenerPersonal();
        return { success: true };
      } else {
        const personal = AppState.get('personal') || [];
        const updated = personal.map(w =>
          w.ID_Trabajador === workerId ? { ...w, ...update } : w
        );
        AppState.set('personal', updated);
        write(LS_KEYS.PERSONAL_CACHE, updated);
        enqueue('personal-delete', { id: workerId });
        return { success: true, offline: true };
      }
    } catch (error) {
      console.error('[API] Error eliminarPersonal:', error);
      return { success: false, error: error.message };
    }
  }

  // ─── Asistencias ───────────────────────────────────────────────────────────
  async function obtenerAsistencias(fecha = AppState.today(), limit = null, offset = 0) {
    try {
      if (connected()) {
        const asistencias = await FirebaseClient.list('asistencias', 'Fecha', limit);
        const filtered = asistencias.filter(a => a.Fecha === fecha);
        AppState.set('asistencias', filtered);
        write(LS_KEYS.ATTENDANCE_CACHE, filtered);
        return { success: true, data: filtered };
      } else {
        const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
        const filtered = cached.filter(a => a.Fecha === fecha);
        AppState.set('asistencias', filtered);
        return { success: true, data: filtered, offline: true };
      }
    } catch (error) {
      console.error('[API] Error obtenerAsistencias:', error);
      const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
      const filtered = cached.filter(a => a.Fecha === fecha);
      return { success: true, data: filtered, offline: true };
    }
  }

  async function obtenerAsistenciaRango(fechaInicio, fechaFin) {
    try {
      if (connected()) {
        const asistencias = await FirebaseClient.list('asistencias', 'Fecha');
        const filtered = asistencias.filter(a => a.Fecha >= fechaInicio && a.Fecha <= fechaFin);
        return { success: true, data: filtered };
      } else {
        const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
        const filtered = cached.filter(a => a.Fecha >= fechaInicio && a.Fecha <= fechaFin);
        return { success: true, data: filtered, offline: true };
      }
    } catch (error) {
      console.error('[API] Error obtenerAsistenciaRango:', error);
      const cached = read(LS_KEYS.ATTENDANCE_CACHE, []);
      const filtered = cached.filter(a => a.Fecha >= fechaInicio && a.Fecha <= fechaFin);
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
        await FirebaseClient.save('asistencias', marcacion.ID_Marcacion, marcacion);
        const asistencias = AppState.get('asistencias') || [];
        const updated = [...asistencias, marcacion];
        AppState.set('asistencias', updated);
        write(LS_KEYS.ATTENDANCE_CACHE, updated);
        return { success: true, data: marcacion };
      } else {
        const asistencias = AppState.get('asistencias') || [];
        const updated = [...asistencias, marcacion];
        AppState.set('asistencias', updated);
        write(LS_KEYS.ATTENDANCE_CACHE, updated);
        enqueue('attendance-create', payload);
        return { success: true, data: marcacion, offline: true };
      }
    } catch (error) {
      console.error('[API] Error registrarMarcacion:', error);
      return { success: false, error: error.message };
    }
  }

  async function actualizarAsistencia(marcacionId, payload) {
    try {
      if (connected()) {
        const asistencias = AppState.get('asistencias') || [];
        const existing = asistencias.find(a => a.ID_Marcacion === marcacionId);
        if (!existing) return { success: false, error: 'Marcación no encontrada' };
        const updated = {
          ...existing,
          Hora_Real: payload.horaReal || existing.Hora_Real,
          Estado_Marcacion: payload.estadoMarcacion || existing.Estado_Marcacion,
          Horas_Extra: payload.horasExtra !== undefined ? payload.horasExtra : existing.Horas_Extra,
        };
        await FirebaseClient.save('asistencias', marcacionId, updated);
        const newCache = asistencias.map(a => a.ID_Marcacion === marcacionId ? updated : a);
        AppState.set('asistencias', newCache);
        write(LS_KEYS.ATTENDANCE_CACHE, newCache);
        return { success: true, data: updated };
      } else {
        const asistencias = AppState.get('asistencias') || [];
        const updated = asistencias.map(a =>
          a.ID_Marcacion === marcacionId ? { ...a, Hora_Real: payload.horaReal || a.Hora_Real, Estado_Marcacion: payload.estadoMarcacion || a.Estado_Marcacion, Horas_Extra: payload.horasExtra || a.Horas_Extra } : a
        );
        AppState.set('asistencias', updated);
        write(LS_KEYS.ATTENDANCE_CACHE, updated);
        enqueue('attendance-update', { id: marcacionId, payload });
        return { success: true, offline: true };
      }
    } catch (error) {
      console.error('[API] Error actualizarAsistencia:', error);
      return { success: false, error: error.message };
    }
  }

  async function eliminarAsistencia(marcacionId) {
    try {
      if (connected()) {
        await FirebaseClient.remove('asistencias', marcacionId);
        const asistencias = AppState.get('asistencias') || [];
        const newCache = asistencias.filter(a => a.ID_Marcacion !== marcacionId);
        AppState.set('asistencias', newCache);
        write(LS_KEYS.ATTENDANCE_CACHE, newCache);
        return { success: true };
      } else {
        const asistencias = AppState.get('asistencias') || [];
        const newCache = asistencias.filter(a => a.ID_Marcacion !== marcacionId);
        AppState.set('asistencias', newCache);
        write(LS_KEYS.ATTENDANCE_CACHE, newCache);
        enqueue('attendance-delete', { id: marcacionId });
        return { success: true, offline: true };
      }
    } catch (error) {
      console.error('[API] Error eliminarAsistencia:', error);
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
        await FirebaseClient.save('alertas', alertId, { Revisada: true });
      }
      const alertas = AppState.get('alertas') || [];
      const updated = alertas.map(a =>
        (a.ID_Alerta === alertId || a.id === alertId) ? { ...a, Revisada: true } : a
      );
      AppState.set('alertas', updated);
      write(LS_KEYS.ALERTS_CACHE, updated);
      return { success: true };
    } catch (error) {
      console.error('[API] Error marcarAlertaRevisada:', error);
      return { success: false, error: error.message };
    }
  }

  // ─── Configuración ──────────────────────────────────────────────────────
  async function obtenerConfiguracion() {
    return { success: true, data: AppState.get('config') };
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
    if (queue.length === 0) return { success: true, synced: 0, errores: 0 };
    const failed = [];
    let synced = 0;
    for (const item of queue) {
      try {
        if (item.type === 'personal-create' || item.type === 'personal') {
          await guardarTrabajador(item.payload);
        } else if (item.type === 'personal-delete') {
          await FirebaseClient.save('personal', item.payload.id, { Estado: 'Inactivo' });
        } else if (item.type === 'attendance-create' || item.type === 'attendance') {
          await registrarMarcacion(item.payload);
        } else if (item.type === 'attendance-update') {
          await FirebaseClient.save('asistencias', item.payload.id, item.payload);
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
      await obtenerPersonal();
    }
    return { success: true, synced, errores: failed.length };
  }

  // ─── Exportar API ───────────────────────────────────────────────────────
  window.API = {
    initialize: () => FirebaseClient.initialize(),
    obtenerPersonal,
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
  };
})();