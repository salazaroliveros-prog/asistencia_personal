/** API de datos: Firestore en línea con respaldo local y cola offline. */
const API = (() => {
  const now = () => new Date().toISOString();
  const local = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { return []; } };
  const saveLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const queue = () => local(LS_KEYS.OFFLINE_QUEUE);
  const setQueue = value => { saveLocal(LS_KEYS.OFFLINE_QUEUE, value); AppState.set('offlineQueue', value.length); };
  const isOnline = () => FirebaseClient.isReady() && AppState.get('connected');
  let connectivityBound = false;
  const result = (data = [], extra = {}) => ({ success: true, data, ...extra });
  const makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  function status(connected) {
    AppState.set('connected', Boolean(connected));
    const dot = document.querySelector('.connection-dot');
    const text = document.getElementById('connection-text');
    if (dot) dot.className = `connection-dot ${connected ? 'connected' : 'disconnected'}`;
    if (text) text.textContent = connected ? 'Firestore en línea' : 'Modo local';
  }
  function cachePersonal(data) { AppState.set('personal', data); saveLocal(LS_KEYS.PERSONAL_CACHE, data); saveLocal(LS_KEYS.LAST_SYNC, now()); AppState.set('lastSync', now()); }
  function localPersonal() { return AppState.get('personal') || local(LS_KEYS.PERSONAL_CACHE); }
  function localAssistances() { const cached = local(LS_KEYS.ATTENDANCE_CACHE); return cached.length ? cached : (AppState.get('asistencias') || []); }
  function cacheAttendance(data) { AppState.set('asistencias', data); saveLocal(LS_KEYS.ATTENDANCE_CACHE, data); }
  function addOffline(type, payload) { const items = queue(); items.push({ id: makeId('Q'), type, payload, timestamp: now() }); setQueue(items); }
  function personalFromPayload(payload, old = {}) {
    const id = payload.id || old.ID_Trabajador || makeId('TRAB');
    return { ...old, ID_Trabajador: id, Nombre_Completo: payload.nombre, DPI_CUI: payload.dpi, Puesto: payload.puesto, Jefe_Inmediato: payload.jefe || '', Telefono: payload.telefono || '', WhatsApp: payload.whatsapp || '', Direccion: payload.direccion || '', Fotografia_URL: payload.fotografia || old.Fotografia_URL || '', Codigo_QR_Data: old.Codigo_QR_Data || JSON.stringify({ id, dpi: payload.dpi, nombre: payload.nombre }), Fecha_Registro: old.Fecha_Registro || now().replace('T', ' ').substring(0, 19), Estado: old.Estado || 'Activo' };
  }
  function localSavePersonal(payload, edit) {
    const list = [...localPersonal()]; const index = list.findIndex(item => item.ID_Trabajador === payload.id);
    if (edit && index < 0) return { success: false, error: 'Trabajador no encontrado.' };
    const item = personalFromPayload(payload, index >= 0 ? list[index] : {}); if (index >= 0) list[index] = item; else list.push(item); cachePersonal(list);
    return result([item], { offline: true, message: edit ? 'Trabajador actualizado en modo local.' : 'Trabajador registrado en modo local.' });
  }
  function attendanceFromPayload(payload, old = {}) {
    if (typeof window !== 'undefined' && window.CpcDomain?.normalizeAttendance) {
      return window.CpcDomain.normalizeAttendance(payload, old);
    }
    const id = payload.ID_Marcacion || payload.ID_Asistencia || payload.ID_Registro || payload.id || makeId('MARC');
    return {
      ...old,
      ID_Marcacion: id,
      ID_Registro: id,
      ID_Trabajador: payload.ID_Trabajador || payload.idTrabajador,
      Nombre_Trabajador: payload.Nombre_Trabajador || payload.nombreTrabajador || '',
      Fecha: payload.Fecha || payload.fecha || AppState.today(),
      Tipo_Marcacion: payload.Tipo_Marcacion || payload.tipoMarcacion || 'Entrada',
      Hora_Programada: payload.Hora_Programada || payload.horaProgramada || '',
      Hora_Real: payload.Hora_Real || payload.horaReal || new Date().toLocaleTimeString('es-GT', { hour12: false }),
      Estado_Marcacion: payload.Estado_Marcacion || payload.estadoMarcacion || payload.estado || 'A Tiempo',
      Metodo_Registro: payload.Metodo_Registro || payload.metodo || 'Manual_Fisica',
      Horas_Extra: payload.Horas_Extra ?? payload.horasExtra ?? 0,
      Ubicacion_Obra: payload.Ubicacion_Obra || payload.obra || '',
      Fecha_Registro: payload.Fecha_Registro || now(),
    };
  }
  function localAttendance(payload) {
    const item = attendanceFromPayload(payload);
    cacheAttendance([...localAssistances(), item]); addOffline('attendance', payload);
    return result([item], { offline: true, estadoMarcacion: item.Estado_Marcacion, horaReal: item.Hora_Real, message: 'Marcación guardada localmente; se sincronizará al conectar.' });
  }
  function setupRealtime() {
    if (!isOnline() || API._realtimeReady) return; API._realtimeReady = true;
    FirebaseClient.subscribe('personal', data => cachePersonal(data.filter(item => item.Estado !== 'Eliminado')));
    FirebaseClient.subscribe('alertas', data => AppState.set('alertas', data));
    FirebaseClient.subscribe('asistencias', data => cacheAttendance(data));
    FirebaseClient.subscribe('configuracion', data => { if (data[0]) { const c = { ...DEFAULT_CONFIG, ...data[0] }; AppState.set('config', c); saveLocal(LS_KEYS.CONFIG, c); } });
  }
  function bindConnectivity() {
    if (connectivityBound || typeof window === 'undefined') return;
    connectivityBound = true;
    window.addEventListener('offline', () => status(false));
    window.addEventListener('online', async () => {
      if (!FirebaseClient.isReady()) return;
      status(true);
      const sync = await API.syncOfflineQueue();
      if (sync.enviadas) await API.obtenerPersonal();
    });
  }
  return {
    _realtimeReady: false,
    async initialize() { bindConnectivity(); const connection = await FirebaseClient.initialize(); status(connection.success); if (connection.success) setupRealtime(); return connection; },
    async ping() { const connection = await this.initialize(); return { ...connection, message: connection.success ? 'Firestore listo y sincronizando en tiempo real.' : 'Modo local activo.' }; },
    async obtenerPersonal(limit, offset) { if (!isOnline()) return result(localPersonal(), { offline: true }); const data = (await FirebaseClient.list('personal')).filter(item => item.Estado !== 'Eliminado'); cachePersonal(data); return result(data.slice(offset || 0, limit ? (offset || 0) + limit : undefined)); },
    async registrarPersonal(payload) { if (!isOnline()) { const response = localSavePersonal(payload, false); addOffline('personal', { ...payload, id: response.data[0].ID_Trabajador }); return response; } const item = personalFromPayload(payload); await FirebaseClient.save('personal', item.ID_Trabajador, item); await this.obtenerPersonal(); return result([item]); },
    async actualizarPersonal(payload) { const old = localPersonal().find(item => item.ID_Trabajador === payload.id); if (!isOnline()) { const response = localSavePersonal(payload, true); addOffline('personal', payload); return response; } const item = personalFromPayload(payload, old); await FirebaseClient.save('personal', item.ID_Trabajador, item); await this.obtenerPersonal(); return result([item]); },
    async eliminarPersonal(id) { if (!isOnline()) { cachePersonal(localPersonal().map(item => item.ID_Trabajador === id ? { ...item, Estado: 'Inactivo' } : item)); addOffline('personal-delete', { id }); return result([], { offline: true }); } await FirebaseClient.save('personal', id, { Estado: 'Inactivo' }); await this.obtenerPersonal(); return result([]); },
    async registrarMarcacion(payload) { if (!isOnline()) return localAttendance(payload); const item = attendanceFromPayload(payload); await FirebaseClient.save('asistencias', item.ID_Marcacion, item); cacheAttendance([...localAssistances(), item]); return result([item], { estadoMarcacion: item.Estado_Marcacion, horaReal: item.Hora_Real }); },
    async obtenerAsistencias(fecha = AppState.today(), limit, offset) { let data = isOnline() ? await FirebaseClient.list('asistencias') : localAssistances(); if (isOnline()) cacheAttendance(data); data = data.filter(item => item.Fecha === fecha); return result(data.slice(offset || 0, limit ? (offset || 0) + limit : undefined), { offline: !isOnline() }); },
    async obtenerAsistenciaRango(fechaInicio, fechaFin, limit, offset) { let data = isOnline() ? await FirebaseClient.list('asistencias') : localAssistances(); if (isOnline()) cacheAttendance(data); data = data.filter(item => item.Fecha >= fechaInicio && item.Fecha <= fechaFin); return result(data.slice(offset || 0, limit ? (offset || 0) + limit : undefined), { offline: !isOnline() }); },
    async obtenerAlertas(limit, offset) { const data = isOnline() ? await FirebaseClient.list('alertas') : (AppState.get('alertas') || []); AppState.set('alertas', data); return result(data.slice(offset || 0, limit ? (offset || 0) + limit : undefined)); },
    async marcarAlertaRevisada(id) { if (isOnline()) await FirebaseClient.save('alertas', id, { Revisada: true }); AppState.set('alertas', (AppState.get('alertas') || []).map(item => item.ID_Alerta === id || item._docId === id ? { ...item, Revisada: true } : item)); return result([]); },
    async obtenerConfiguracion() { const data = isOnline() ? await FirebaseClient.list('configuracion') : []; if (data[0]) { const c = { ...DEFAULT_CONFIG, ...data[0] }; AppState.set('config', c); saveLocal(LS_KEYS.CONFIG, c); } return result(AppState.get('config')); },
    async guardarConfiguracion(payload) { const c = { ...AppState.get('config'), ...payload }; AppState.set('config', c); saveLocal(LS_KEYS.CONFIG, c); if (isOnline()) await FirebaseClient.save('configuracion', 'general', c); return result(c); },
    isOffline() { return !isOnline(); }, getPersonalFromCache() { return localPersonal(); }, getOfflineQueue() { return queue(); }, hasPendingSync() { return queue().length > 0; },
    async syncOfflineQueue() { if (!isOnline()) return { enviadas: 0, errores: queue().length }; const pending = queue(); let enviadas = 0; const failed = []; for (const item of pending) { try { const p = item.payload || item; if (item.type === 'personal-delete') await FirebaseClient.save('personal', p.id, { Estado: 'Inactivo' }); else if (item.type === 'personal') { const worker = personalFromPayload(p); await FirebaseClient.save('personal', worker.ID_Trabajador, worker); } else { const record = attendanceFromPayload(p); await FirebaseClient.save('asistencias', record.ID_Marcacion, record); } enviadas++; } catch (_) { failed.push(item); } } setQueue(failed); if (enviadas) saveLocal(LS_KEYS.LAST_SYNC, now()); return { enviadas, errores: failed.length }; },
  };
})();
