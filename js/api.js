/**
 * CONTROL PERSONAL CAMPO — api.js
 * API para operaciones CRUD y sincronización
 * Implementación JavaScript para reemplazar TypeScript eliminado
 * @version 1.0.0
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
    return FirebaseClient && FirebaseClient.isReady() && 
           (FirebaseClient.getConnectionState() === 'connected' || FirebaseClient.getConnectionState() === 'degraded') &&
           Boolean(AppState.get('connected'));
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
    const workerId = payload.id || id('TRAB');
    const worker = {
      ID_Trabajador: workerId,
      Nombre_Completo: payload.nombre || '',
      DPI_CUI: payload.dpi || '',
      Puesto: payload.puesto || '',
      Jefe_Inmediato: payload.jefe || '',
      Telefono: payload.telefono || '',
      WhatsApp: payload.whatsapp || '',
      Direccion: payload.direccion || '',
      Fotografia_URL: payload.fotografia || '',
      Codigo_QR_Data: JSON.stringify({ id: workerId, dpi: payload.dpi, nombre: payload.nombre }),
      Fecha_Registro: new Date().toISOString(),
      Estado: 'Activo',
    };

    try {
      if (connected()) {
        await FirebaseClient.save('personal', workerId, worker);
        await obtenerPersonal();
        return { success: true, data: worker };
      } else {
        const personal = AppState.get('personal') || [];
        const updated = [...personal, worker];
        AppState.set('personal', updated);
        write(LS_KEYS.PERSONAL_CACHE, updated);
        return { success: true, data: worker, offline: true };
      }
    } catch (error) {
      console.error('[API] Error guardarTrabajador:', error);
      return { success: false, error: error.message };
    }
  }

  async function eliminarPersonal(workerId) {
    try {
      if (connected()) {
        await FirebaseClient.save('personal', workerId, { Estado: 'Inactivo' });
        await obtenerPersonal();
        return { success: true };
      } else {
        const personal = AppState.get('personal') || [];
        const updated = personal.map(w => 
          w.ID_Trabajador === workerId ? { ...w, Estado: 'Inactivo' } : w
        );
        AppState.set('personal', updated);
        write(LS_KEYS.PERSONAL_CACHE, updated);
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
      return { success: true, data: cached, offline: true };
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
      return { success: false, error: error.message };
    }
  }

  async function registrarMarcacion(payload) {
    const marcacionId = id('MARC');
    const marcacion = {
      ID_Marcacion: marcacionId,
      ID_Trabajador: payload.id,
      Nombre_Trabajador: payload.nombre,
      Tipo_Marcacion: payload.tipo,
      Fecha: payload.fecha || AppState.today(),
      Hora_Real: payload.horaReal || new Date().toLocaleTimeString('es-GT', { hour12: false }),
      Estado_Marcacion: 'A Tiempo',
      Metodo_Registro: payload.metodo || 'Manual',
      Ubicacion_Obra: payload.ubicacion || '',
      Timestamp: Date.now(),
    };

    try {
      if (connected()) {
        await FirebaseClient.save('asistencias', marcacionId, marcacion);
        const asistencias = AppState.get('asistencias') || [];
        AppState.set('asistencias', [...asistencias, marcacion]);
        write(LS_KEYS.ATTENDANCE_CACHE, [...asistencias, marcacion]);
        return { success: true, data: marcacion };
      } else {
        const asistencias = AppState.get('asistencias') || [];
        AppState.set('asistencias', [...asistencias, marcacion]);
        write(LS_KEYS.ATTENDANCE_CACHE, [...asistencias, marcacion]);
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
        return { success: true, data: alertas };
      } else {
        const cached = read(LS_KEYS.ALERTS_CACHE, []);
        AppState.set('alertas', cached);
        return { success: true, data: cached, offline: true };
      }
    } catch (error) {
      console.error('[API] Error obtenerAlertas:', error);
      return { success: false, error: error.message };
    }
  }

  // ─── Sincronización ───────────────────────────────────────────────────────
  async function syncOfflineQueue() {
    const queue = read(LS_KEYS.OFFLINE_QUEUE, []);
    if (queue.length === 0) return { success: true, synced: 0 };

    let synced = 0;
    for (const item of queue) {
      try {
        if (item.type === 'personal-create') {
          await guardarTrabajador(item.payload);
        } else if (item.type === 'attendance-create') {
          await registrarMarcacion(item.payload);
        }
        synced++;
      } catch (error) {
        console.error('[API] Error sync item:', error);
      }
    }

    write(LS_KEYS.OFFLINE_QUEUE, []);
    return { success: true, synced };
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
    syncOfflineQueue,
  };

  console.log('[API] Módulo cargado correctamente');
})();