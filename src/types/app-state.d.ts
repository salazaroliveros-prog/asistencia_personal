/**
 * Tipos estrictos para AppState, LS_KEYS y la configuración de la app.
 * @module app-state-types
 */

import type { FirebaseConfigShape } from './firebase';

/** Claves de localStorage usadas por la aplicación. */
export interface LocalStoreKeys {
  FIREBASE_CONFIG: string;
  CONFIG: string;
  PERSONAL_CACHE: string;
  ATTENDANCE_CACHE: string;
  ALERTS_CACHE: string;
  LAST_SYNC: string;
  OFFLINE_QUEUE: string;
}

/** Configuración general de la obra / sistema. */
export interface AppConfig {
  Nombre_App: string;
  Nombre_Obra: string;
  Tolerancia_Minutos: number;
  Hora_Entrada: string;
  Hora_Salida_Receso: string;
  Hora_Regreso_Receso: string;
  Hora_Salida_Obra: string;
  Encargado: string;
  Logo_Base64: string;
  Webhook_URL: string;
  Version: string;
  GPS_Habilitado: boolean;
  GPS_Requerir_Ubicacion: boolean;
  GPS_Centro_Lat: number | null;
  GPS_Centro_Lon: number | null;
  GPS_Radio_Metros: number;
}

/** Estados de trabajador aceptados por firestore.rules. */
export type WorkerEstado = 'Activo' | 'Inactivo' | 'Eliminado' | 'Suspendido';

/** Trabajador. */
export interface Worker {
  ID_Trabajador: string;
  Nombre_Completo: string;
  DPI_CUI: string;
  Puesto: string;
  Jefe_Inmediato?: string;
  Telefono?: string;
  WhatsApp?: string;
  Direccion?: string;
  Fotografia_URL?: string;
  Codigo_QR_Data: string;
  Fecha_Registro: string;
  Estado: WorkerEstado;
}

/**
 * Marcación de asistencia.
 *
 * Los campos obligatorios son exactamente los que exige
 * firestore.rules → isValidAttendanceData(); si falta alguno, la escritura se
 * deniega con permission-denied.
 */
export interface Marcacion {
  ID_Marcacion: string;
  ID_Registro: string;
  ID_Trabajador: string;
  Nombre_Trabajador: string;
  Fecha: string;
  Tipo_Marcacion: string;
  Hora_Programada: string;
  Hora_Real: string;
  Estado_Marcacion: string;
  Metodo_Registro: string;
  Horas_Extra: number;
  Ubicacion_Obra: string;
  GPS_Latitud: number | null;
  GPS_Longitud: number | null;
  GPS_Accuracy: number | null;
  Geofence_Inside: boolean | null;
  Geofence_Distance: number | null;
  Timestamp: number;
}

/** Contrato del store reactivo AppState. */
export interface AppStateContract {
  get<T = unknown>(key: string): T | undefined;
  getAll(): Record<string, unknown>;
  set(key: string, value: unknown): void;
  on(key: string, cb: (value: unknown, prev: unknown) => void): void;
  off(key: string, cb: (value: unknown, prev: unknown) => void): void;
  today(): string;
}

/** Tipado de window.FirebaseConfigShape (inyectado por firebase-config.js). */
declare global {
  interface Window {
    FIREBASE_CONFIG: FirebaseConfigShape;
    AppState: AppStateContract;
    LS_KEYS: LocalStoreKeys;
    DEFAULT_CONFIG: AppConfig;
  }
}
