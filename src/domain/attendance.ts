import type { AttendancePayload, AttendanceRecord, AttendanceSummary, Worker } from './types';

const nowIso = (): string => new Date().toISOString();
const today = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function makeAttendanceId(payload: AttendancePayload): string {
  return payload.ID_Marcacion || payload.ID_Asistencia || payload.ID_Registro || payload.id || `MARC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function normalizeAttendance(payload: AttendancePayload, previous: Partial<AttendanceRecord> = {}): AttendanceRecord {
  const id = makeAttendanceId(payload);
  return {
    ...previous,
    ID_Marcacion: id,
    ID_Registro: id,
    ID_Trabajador: payload.ID_Trabajador || payload.idTrabajador || '',
    Nombre_Trabajador: payload.Nombre_Trabajador || payload.nombreTrabajador || '',
    Fecha: payload.Fecha || payload.fecha || today(),
    Tipo_Marcacion: payload.Tipo_Marcacion || payload.tipoMarcacion || 'Entrada',
    Hora_Programada: payload.Hora_Programada || payload.horaProgramada || '',
    Hora_Real: payload.Hora_Real || payload.horaReal || new Date().toLocaleTimeString('es-GT', { hour12: false }),
    Estado_Marcacion: payload.Estado_Marcacion || payload.estadoMarcacion || payload.estado || 'A Tiempo',
    Metodo_Registro: payload.Metodo_Registro || payload.metodo || 'Manual_Fisica',
    Horas_Extra: Number(payload.Horas_Extra ?? payload.horasExtra ?? 0) || 0,
    Ubicacion_Obra: payload.Ubicacion_Obra || payload.obra || '',
    Fecha_Registro: payload.Fecha_Registro || nowIso(),
  };
}

export function filterByRange(records: readonly AttendanceRecord[], start: string, end: string): AttendanceRecord[] {
  return records.filter(record => record.Fecha >= start && record.Fecha <= end);
}

export function summarizeAttendance(records: readonly AttendanceRecord[], start: string, end: string): AttendanceSummary {
  const workedDays = new Set(records.filter(record => record.Tipo_Marcacion === 'Entrada').map(record => record.Fecha)).size;
  const lateEntries = records.filter(record => record.Tipo_Marcacion === 'Entrada' && ['Atraso', 'Tolerancia'].includes(record.Estado_Marcacion)).length;
  const overtimeHours = records.reduce((total, record) => total + record.Horas_Extra, 0);
  const first = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  let workingDays = 0;
  for (const cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    if (cursor.getDay() !== 0) workingDays += 1;
  }
  return { workedDays, lateEntries, overtimeHours, absences: Math.max(0, workingDays - workedDays) };
}

export function latestByWorker(records: readonly AttendanceRecord[]): Map<string, AttendanceRecord> {
  const latest = new Map<string, AttendanceRecord>();
  for (const record of records) {
    const previous = latest.get(record.ID_Trabajador);
    if (!previous || record.Hora_Real > previous.Hora_Real) latest.set(record.ID_Trabajador, record);
  }
  return latest;
}

export function activeWorkers(workers: readonly Worker[]): Worker[] {
  return workers.filter(worker => worker.Estado === 'Activo');
}
