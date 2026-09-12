import { FirebaseClient } from '../firebase.js';
import { normalizeAttendance } from '../domain/attendance.js';

const DB_NAME = 'cpc_movil_db';
const DB_VERSION = 1;
const STORE_QUEUE = 'queue';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        store.createIndex('creada_en', 'creada_en', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDb().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

export async function enqueue(payload) {
  const store = await tx(STORE_QUEUE, 'readwrite');
  const item = {
    id: `Q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
    payload,
    intentos: 0,
    ultimo_error: null,
    creada_en: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function listQueue() {
  const store = await tx(STORE_QUEUE);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function removeQueueItem(id) {
  const store = await tx(STORE_QUEUE, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function updateQueueItem(item) {
  const store = await tx(STORE_QUEUE, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function syncOfflineQueue() {
  const items = await listQueue();
  const failed = [];
  let enviadas = 0;

  for (const item of items) {
    try {
      if (!FirebaseClient.isReady()) throw new Error('Firebase no listo');
      const record = normalizeAttendance(item.payload);
      await FirebaseClient.saveAttendance(record);
      await removeQueueItem(item.id);
      enviadas++;
    } catch (error) {
      item.intentos += 1;
      item.ultimo_error = error.message;
      if (item.intentos < 10) failed.push(item);
    }
  }

  for (const item of failed) await updateQueueItem(item);
  return { enviadas, errores: failed.length };
}

export async function clearQueue() {
  const store = await tx(STORE_QUEUE, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
