/**
 * Estados de trabajador aceptados por firestore.rules (isValidWorkerData).
 */
export type WorkerStatus = 'Activo' | 'Inactivo' | 'Eliminado' | 'Suspendido';

/** Estados de marcación aceptados por firestore.rules (isValidAttendanceData). */
export type AttendanceStatus = 'A Tiempo' | 'Puntual' | 'Tolerancia' | 'Atraso' | 'Ausencia';

/** Tipos de marcación aceptados por firestore.rules (isValidAttendanceData). */
export type AttendanceType = 'Entrada' | 'Salida_Receso' | 'Regreso_Receso' | 'Salida_Obra' | 'Entrada_Extra';

export interface Worker {
  ID_Trabajador: string;
  Nombre_Completo: string;
  DPI_CUI: string;
  Puesto: string;
  Estado: WorkerStatus;
  Jefe_Inmediato?: string;
  Telefono?: string;
  WhatsApp?: string;
  Direccion?: string;
  Fotografia_URL?: string;
  Codigo_QR_Data?: string;
  Fecha_Registro?: string;
}

export interface AttendanceRecord {
  ID_Marcacion: string;
  ID_Registro: string;
  ID_Trabajador: string;
  Nombre_Trabajador: string;
  Fecha: string;
  Tipo_Marcacion: AttendanceType;
  Hora_Programada: string;
  Hora_Real: string;
  Estado_Marcacion: AttendanceStatus;
  Metodo_Registro: string;
  Horas_Extra: number;
  Ubicacion_Obra: string;
  Fecha_Registro: string;
  GPS_Latitud?: number | null;
  GPS_Longitud?: number | null;
  GPS_Accuracy?: number | null;
  Geofence_Inside?: boolean | null;
  Geofence_Distance?: number | null;
  Timestamp: number;
}

export interface AttendanceSummary {
  workedDays: number;
  lateEntries: number;
  overtimeHours: number;
  absences: number;
}

export interface AttendancePayload extends Partial<AttendanceRecord> {
  ID_Asistencia?: string;
  id?: string;
  idTrabajador?: string;
  nombreTrabajador?: string;
  fecha?: string;
  tipoMarcacion?: AttendanceType;
  horaProgramada?: string;
  horaReal?: string;
  estado?: AttendanceStatus;
  estadoMarcacion?: AttendanceStatus;
  metodo?: string;
  horasExtra?: number | string;
  obra?: string;
}
