export function normalizeAttendance(payload) {
  const now = new Date();
  const id = generateId();

  return {
    ID_Marcacion: id,
    ID_Trabajador: payload.workerId,
    Tipo: payload.tipo,
    Hora_Programada: '',
    Hora_Real: now.toISOString(),
    Estado: 'A_Tiempo',
    Metodo_Registro: payload.metodo,
    Ubicacion_Obra: payload.ubicacion ?? null,
    Id_Dispositivo: getDeviceId(),
    Fecha_Sincronizacion: now.toISOString(),
  };
}

export function generateId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `MOV-${ts}-${rand}`.toUpperCase();
}

function getDeviceId() {
  try {
    const key = 'cpc_movil_device_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `DEV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `DEV-${Date.now().toString(36)}`;
  }
}
