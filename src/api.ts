import { normalizeAttendance } from './domain/attendance';
import type { AttendancePayload, AttendanceRecord, Worker } from './domain/types';

type Result<T> = { success: boolean; data: T; offline?: boolean; error?: string; [key: string]: unknown };
type AppStateLike = { get<T = unknown>(key: string): T; set(key: string, value: unknown): void };
type FirebaseLike = {
  isReady(): boolean;
  initialize(): Promise<{ success: boolean; [key: string]: unknown }>;
  list(collection: string): Promise<Record<string, unknown>[]>;
  save(collection: string, id: string, data: Record<string, unknown>): Promise<unknown>;
  remove(collection: string, id: string): Promise<void>;
  subscribe(collection: string, callback: (records: Record<string, unknown>[]) => void): () => void;
};

declare global {
  interface Window {
    AppState: AppStateLike;
    LS_KEYS: Record<string, string>;
    DEFAULT_CONFIG: Record<string, unknown>;
    API: Api;
  }
}

const state = (): AppStateLike => window.AppState;
const firebase = (): FirebaseLike => window.FirebaseClient;
const keys = (): Record<string, string> => window.LS_KEYS;
const now = (): string => new Date().toISOString();
const read = <T>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) as T; } catch { return fallback; }
};
const write = (key: string, value: unknown): void => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn('[API] No se pudo persistir localmente:', error); }
};
const id = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const result = <T>(data: T, extra: Record<string, unknown> = {}): Result<T> => ({ success: true, data, ...extra });

function queue(): Record<string, unknown>[] { return read(keys().OFFLINE_QUEUE, []); }
function setQueue(items: Record<string, unknown>[]): void {
  write(keys().OFFLINE_QUEUE, items);
  state().set('offlineQueue', items.length);
}
function connected(): boolean { return firebase().isReady() && Boolean(state().get('connected')); }
function personalCache(): Worker[] { return (state().get<Worker[]>('personal') || read(keys().PERSONAL_CACHE, [])) as Worker[]; }
function attendanceCache(): AttendanceRecord[] {
  const cached = read<AttendanceRecord[]>(keys().ATTENDANCE_CACHE, []);
  return cached.length ? cached : (state().get<AttendanceRecord[]>('asistencias') || []);
}
function savePersonalCache(items: Worker[]): void {
  state().set('personal', items);
  write(keys().PERSONAL_CACHE, items);
  write(keys().LAST_SYNC, now());
  state().set('lastSync', now());
}
function saveAttendanceCache(items: AttendanceRecord[]): void {
  state().set('asistencias', items);
  write(keys().ATTENDANCE_CACHE, items);
}
function enqueue(type: string, payload: Record<string, unknown>): void {
  setQueue([...queue(), { id: id('Q'), type, payload, timestamp: now() }]);
}
function normalizeWorker(payload: Record<string, unknown>, previous: Partial<Worker> = {}): Worker {
  const workerId = String(payload.id || previous.ID_Trabajador || id('TRAB'));
  return {
    ...previous,
    ID_Trabajador: workerId,
    Nombre_Completo: String(payload.nombre || previous.Nombre_Completo || ''),
    DPI_CUI: String(payload.dpi || previous.DPI_CUI || ''),
    Puesto: String(payload.puesto || previous.Puesto || ''),
    Jefe_Inmediato: String(payload.jefe || previous.Jefe_Inmediato || ''),
    Telefono: String(payload.telefono || previous.Telefono || ''),
    WhatsApp: String(payload.whatsapp || previous.WhatsApp || ''),
    Direccion: String(payload.direccion || previous.Direccion || ''),
    Fotografia_URL: String(payload.fotografia || previous.Fotografia_URL || ''),
    Codigo_QR_Data: previous.Codigo_QR_Data || JSON.stringify({ id: workerId, dpi: payload.dpi, nombre: payload.nombre }),
    Fecha_Registro: previous.Fecha_Registro || now(),
    Estado: (previous.Estado as Worker['Estado']) || 'Activo',
  };
}
function localSaveWorker(payload: Record<string, unknown>, edit: boolean): Result<Worker[]> {
  const items = [...personalCache()];
  const index = items.findIndex(worker => worker.ID_Trabajador === payload.id);
  if (edit && index < 0) return { success: false, data: [], error: 'Trabajador no encontrado.' };
  const worker = normalizeWorker(payload, index >= 0 ? items[index] : {});
  if (index >= 0) items[index] = worker; else items.push(worker);
  savePersonalCache(items);
  return result([worker], { offline: true, message: edit ? 'Trabajador actualizado localmente.' : 'Trabajador registrado localmente.' });
}
function localSaveAttendance(payload: AttendancePayload): Result<AttendanceRecord[]> {
  const record = normalizeAttendance(payload);
  saveAttendanceCache([...attendanceCache(), record]);
  enqueue('attendance', payload as Record<string, unknown>);
  return result([record], { offline: true, estadoMarcacion: record.Estado_Marcacion, horaReal: record.Hora_Real });
}
function updateConnection(value: boolean): void {
  state().set('connected', value);
  document.querySelector('.connection-dot')?.classList.toggle('connected', value);
  document.querySelector('.connection-dot')?.classList.toggle('disconnected', !value);
  const label = document.getElementById('connection-text');
  if (label) label.textContent = value ? 'Firestore en línea' : 'Modo local';
}

let connectivityBound = false;
let realtimeSubscriptionsBound = false;
function bindConnectivity(): void {
  if (connectivityBound) return;
  connectivityBound = true;
  window.addEventListener('offline', () => updateConnection(false));
  window.addEventListener('online', async () => {
    if (!firebase().isReady()) return;
    updateConnection(true);
    const sync = await API.syncOfflineQueue();
    if (sync.enviadas > 0) {
      await API.obtenerPersonal();
      await API.obtenerAsistencias();
    }
  });
}

export interface Api {
  initialize(): Promise<Record<string, unknown>>;
  ping(): Promise<Record<string, unknown>>;
  obtenerPersonal(limit?: number, offset?: number): Promise<Result<Worker[]>>;
  registrarPersonal(payload: Record<string, unknown>): Promise<Result<Worker[]>>;
  actualizarPersonal(payload: Record<string, unknown>): Promise<Result<Worker[]>>;
  eliminarPersonal(workerId: string): Promise<Result<never[]>>;
  registrarMarcacion(payload: AttendancePayload): Promise<Result<AttendanceRecord[]>>;
  obtenerAsistencias(fecha?: string, limit?: number, offset?: number): Promise<Result<AttendanceRecord[]>>;
  obtenerAsistenciaRango(inicio: string, fin: string, limit?: number, offset?: number): Promise<Result<AttendanceRecord[]>>;
  obtenerAlertas(limit?: number, offset?: number): Promise<Result<Record<string, unknown>[]>>;
  marcarAlertaRevisada(alertId: string): Promise<Result<never[]>>;
  obtenerConfiguracion(): Promise<Result<Record<string, unknown> | undefined>>;
  guardarConfiguracion(payload: Record<string, unknown>): Promise<Result<Record<string, unknown>>>;
  isOffline(): boolean;
  getPersonalFromCache(): Worker[];
  getOfflineQueue(): Record<string, unknown>[];
  hasPendingSync(): boolean;
  syncOfflineQueue(): Promise<{ enviadas: number; errores: number }>;
}

const API: Api = {
  async initialize() {
    bindConnectivity();
    if (state().get('backendMode') !== 'firestore') realtimeSubscriptionsBound = false;
    const connection = await firebase().initialize();
    updateConnection(connection.success);
    if (connection.success && !realtimeSubscriptionsBound) {
      firebase().subscribe('personal', records => savePersonalCache(records.filter(record => record.Estado !== 'Eliminado') as unknown as Worker[]));
      firebase().subscribe('asistencias', records => saveAttendanceCache(records as unknown as AttendanceRecord[]));
      firebase().subscribe('alertas', records => state().set('alertas', records));
      realtimeSubscriptionsBound = true;
    }
    return connection;
  },
  async ping() { const connection = await this.initialize(); return { ...connection, message: connection.success ? 'Firestore listo y sincronizando en tiempo real.' : 'Modo local activo.' }; },
  async obtenerPersonal(limit, offset = 0) {
    if (!connected()) return result(personalCache(), { offline: true });
    const data = (await firebase().list('personal')).filter(item => item.Estado !== 'Eliminado') as unknown as Worker[];
    savePersonalCache(data);
    return result(data.slice(offset, limit ? offset + limit : undefined));
  },
  async registrarPersonal(payload) {
    if (!connected()) { const local = localSaveWorker(payload, false); if (local.data[0]) enqueue('personal', { ...payload, id: local.data[0].ID_Trabajador }); return local; }
    const worker = normalizeWorker(payload);
    await firebase().save('personal', worker.ID_Trabajador, worker as unknown as Record<string, unknown>);
    await this.obtenerPersonal();
    return result([worker]);
  },
  async actualizarPersonal(payload) {
    const previous = personalCache().find(worker => worker.ID_Trabajador === payload.id);
    if (!connected()) { const local = localSaveWorker(payload, true); enqueue('personal', payload); return local; }
    const worker = normalizeWorker(payload, previous);
    await firebase().save('personal', worker.ID_Trabajador, worker as unknown as Record<string, unknown>);
    await this.obtenerPersonal();
    return result([worker]);
  },
  async eliminarPersonal(workerId) {
    if (!connected()) { savePersonalCache(personalCache().map(worker => worker.ID_Trabajador === workerId ? { ...worker, Estado: 'Inactivo' } : worker)); enqueue('personal-delete', { id: workerId }); return result([] as never[], { offline: true }); }
    await firebase().save('personal', workerId, { Estado: 'Inactivo' });
    await this.obtenerPersonal();
    return result([] as never[]);
  },
  async registrarMarcacion(payload) {
    if (!connected()) return localSaveAttendance(payload);
    const record = normalizeAttendance(payload);
    await firebase().save('asistencias', record.ID_Marcacion, record as unknown as Record<string, unknown>);
    saveAttendanceCache([...attendanceCache(), record]);
    return result([record], { estadoMarcacion: record.Estado_Marcacion, horaReal: record.Hora_Real });
  },
  async obtenerAsistencias(fecha = state().get<string>('dashboardDate') || new Date().toISOString().slice(0, 10), limit, offset = 0) {
    let data = connected() ? await firebase().list('asistencias') as unknown as AttendanceRecord[] : attendanceCache();
    if (connected()) saveAttendanceCache(data);
    data = data.filter(record => record.Fecha === fecha);
    return result(data.slice(offset, limit ? offset + limit : undefined), { offline: !connected() });
  },
  async obtenerAsistenciaRango(inicio, fin, limit, offset = 0) {
    let data = connected() ? await firebase().list('asistencias') as unknown as AttendanceRecord[] : attendanceCache();
    if (connected()) saveAttendanceCache(data);
    data = data.filter(record => record.Fecha >= inicio && record.Fecha <= fin);
    return result(data.slice(offset, limit ? offset + limit : undefined), { offline: !connected() });
  },
  async obtenerAlertas(limit, offset = 0) {
    const data = connected() ? await firebase().list('alertas') : state().get<Record<string, unknown>[]>('alertas') || [];
    state().set('alertas', data);
    return result(data.slice(offset, limit ? offset + limit : undefined));
  },
  async marcarAlertaRevisada(alertId) {
    if (connected()) await firebase().save('alertas', alertId, { Revisada: true });
    state().set('alertas', (state().get<Record<string, unknown>[]>('alertas') || []).map(item => item.ID_Alerta === alertId || item._docId === alertId ? { ...item, Revisada: true } : item));
    return result([] as never[]);
  },
  async obtenerConfiguracion() { return result(state().get<Record<string, unknown>>('config')); },
  async guardarConfiguracion(payload) {
    const config = { ...(state().get<Record<string, unknown>>('config') || {}), ...payload };
    state().set('config', config); write(keys().CONFIG, config);
    if (connected()) await firebase().save('configuracion', 'general', config);
    return result(config);
  },
  isOffline: () => !connected(),
  getPersonalFromCache: personalCache,
  getOfflineQueue: queue,
  hasPendingSync: () => queue().length > 0,
  async syncOfflineQueue() {
    if (!connected()) return { enviadas: 0, errores: queue().length };
    const failed: Record<string, unknown>[] = [];
    let sent = 0;
    for (const item of queue()) {
      try {
        const payload = (item.payload || {}) as Record<string, unknown>;
        if (item.type === 'personal-delete') await firebase().save('personal', String(payload.id), { Estado: 'Inactivo' });
        else if (item.type === 'personal') { const worker = normalizeWorker(payload); await firebase().save('personal', worker.ID_Trabajador, worker as unknown as Record<string, unknown>); }
        else { const record = normalizeAttendance(payload); await firebase().save('asistencias', record.ID_Marcacion, record as unknown as Record<string, unknown>); }
        sent += 1;
      } catch { failed.push(item); }
    }
    setQueue(failed);
    if (sent) { write(keys().LAST_SYNC, now()); await this.obtenerPersonal(); }
    return { enviadas: sent, errores: failed.length };
  },
};

window.API = API;
