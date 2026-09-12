import { FirebaseClient } from './firebase.js';
import { enqueue, syncOfflineQueue } from './sync/queue.js';
import { Backoff } from './sync/backoff.js';
import { normalizeAttendance } from './domain/attendance.js';

const listeners = [];
const backoff = new Backoff();
let initialized = false;

class AttendanceApi {
  async initialize(config) {
    const result = await FirebaseClient.initialize(config);
    this.bindConnection();
    initialized = true;
    return result;
  }

  async ping() {
    if (!initialized) return { success: false, message: 'No inicializado' };
    const state = FirebaseClient.getConnectionState();
    return { success: state === 'connected' || state === 'degraded', message: state === 'connected' ? 'En línea' : state === 'degraded' ? 'Degradado' : 'Sin conexión' };
  }

  async registrar(payload) {
    if (FirebaseClient.isReady()) {
      try {
        const record = normalizeAttendance(payload);
        await FirebaseClient.saveAttendance(record);
        return { success: true, data: record };
      } catch (error) {
        await enqueue(payload);
        return { success: true, data: normalizeAttendance(payload), offline: true, error: error.message };
      }
    }
    await enqueue(payload);
    return { success: true, data: normalizeAttendance(payload), offline: true };
  }

  async sync() {
    return syncOfflineQueue();
  }

  onConnectionChange(listener) {
    listeners.push(listener);
    return () => { listeners.splice(listeners.indexOf(listener), 1); };
  }

  bindConnection() {
    FirebaseClient.onConnectionChange((state) => {
      listeners.forEach((l) => l(state));
      if ((state === 'connected' || state === 'degraded') && FirebaseClient.isReady()) {
        backoff.reset();
        this.sync().catch(() => {});
      }
    });

    window.addEventListener('online', async () => {
      if (FirebaseClient.isReady()) await this.sync();
    });
  }
}

export const API = new AttendanceApi();
