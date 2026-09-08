/**
 * CONTROL PERSONAL CAMPO - Backend Google Apps Script
 * Versión: 1.0.0
 * Descripción: Web App serverless para gestión de personal y asistencia en obra.
 * Zona horaria: GMT-6 (Guatemala)
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN GLOBAL
// ─────────────────────────────────────────────────────────────────────────────
var TIMEZONE = "GMT-6";

// ─────────────────────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA HTTP POST
// ─────────────────────────────────────────────────────────────────────────────
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case 'registrarPersonal':
        return responseJSON(registrarPersonal(ss, data.payload));
      case 'actualizarPersonal':
        return responseJSON(actualizarPersonal(ss, data.payload));
      case 'eliminarPersonal':
        return responseJSON(eliminarPersonal(ss, data.id));
      case 'obtenerPersonal':
        return responseJSON(obtenerPersonal(ss));
      case 'obtenerTodosPersonal':
        return responseJSON(obtenerTodosPersonal(ss));
      case 'registrarMarcacion':
        return responseJSON(registrarMarcacion(ss, data.payload));
      case 'obtenerAsistencias':
        return responseJSON(obtenerAsistencias(ss, data.fecha));
      case 'obtenerAsistenciaRango':
        return responseJSON(obtenerAsistenciaRango(ss, data.fechaInicio, data.fechaFin));
      case 'obtenerAlertas':
        return responseJSON(obtenerAlertas(ss));
      case 'marcarAlertaRevisada':
        return responseJSON(marcarAlertaRevisada(ss, data.id));
      case 'obtenerConfiguracion':
        return responseJSON(obtenerConfiguracion(ss));
      case 'guardarConfiguracion':
        return responseJSON(guardarConfiguracion(ss, data.payload));
      case 'ping':
        return responseJSON({ success: true, message: 'Conexión exitosa', timestamp: new Date().toString() });
      default:
        return responseJSON({ success: false, error: 'Acción no válida: ' + action });
    }
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA HTTP GET
// ─────────────────────────────────────────────────────────────────────────────
function doGet(e) {
  var action = e.parameter.action || 'ping';
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    switch (action) {
      case 'obtenerPersonal':
        return responseJSON(obtenerPersonal(ss));
      case 'obtenerAsistencias':
        return responseJSON(obtenerAsistencias(ss, e.parameter.fecha));
      case 'ping':
        return responseJSON({ success: true, message: 'API CONTROL PERSONAL CAMPO activa', timestamp: new Date().toString() });
      default:
        return responseJSON({ success: false, error: 'Acción GET no válida' });
    }
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function responseJSON(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function generarID(prefijo) {
  return prefijo + "-" + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function sheetToObjects(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  var headers = rows[0];
  var result = [];
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = rows[i][j];
      // Convertir fechas a string para JSON
      if (val instanceof Date) {
        obj[headers[j]] = Utilities.formatDate(val, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
      } else {
        obj[headers[j]] = val;
      }
    }
    result.push(obj);
  }
  return result;
}

function encontrarFilaPorID(sheet, idColumna, idValor) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][idColumna] == idValor) return i + 1; // 1-indexed row
  }
  return -1;
}

function calcularEstadoMarcacion(horaProgramadaStr, horaRealStr, toleranciaMinutos) {
  var partesProgramada = horaProgramadaStr.split(':');
  var partesReal = horaRealStr.split(':');
  var minutosProgramados = parseInt(partesProgramada[0]) * 60 + parseInt(partesProgramada[1]);
  var minutosReal = parseInt(partesReal[0]) * 60 + parseInt(partesReal[1]);
  var diferencia = minutosReal - minutosProgramados;

  if (diferencia <= 0) return 'A Tiempo';
  if (diferencia <= toleranciaMinutos) return 'Tolerancia';
  return 'Atraso';
}

function calcularHorasExtra(horaRealStr, horaSalidaStr) {
  var partesSalida = horaSalidaStr.split(':');
  var HORA_SALIDA_MIN = parseInt(partesSalida[0]) * 60 + parseInt(partesSalida[1]) + 15;
  var partes = horaRealStr.split(':');
  var minutosReal = parseInt(partes[0]) * 60 + parseInt(partes[1]);
  if (minutosReal > HORA_SALIDA_MIN) {
    var exceso = minutosReal - HORA_SALIDA_MIN;
    return Math.round(exceso / 30) * 0.5; // Bloques de 0.5 hora
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: PERSONAL
// ─────────────────────────────────────────────────────────────────────────────
function registrarPersonal(ss, payload) {
  var sheet = ss.getSheetByName("Personal");
  if (!sheet) throw new Error("Hoja 'Personal' no encontrada. Ejecute SetupSheets primero.");

  var id = generarID("TRAB");
  var qrData = JSON.stringify({ id: id, dpi: payload.dpi, nombre: payload.nombre });
  var fecha = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow([
    id,
    payload.nombre,
    payload.dpi,
    payload.puesto,
    payload.jefe || '',
    payload.telefono || '',
    payload.whatsapp || '',
    payload.direccion || '',
    payload.fotografia || '',
    qrData,
    fecha,
    "Activo"
  ]);

  return { success: true, id: id, qrData: qrData, message: "Personal registrado correctamente" };
}

function actualizarPersonal(ss, payload) {
  var sheet = ss.getSheetByName("Personal");
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var fila = encontrarFilaPorID(sheet, 0, payload.id);

  if (fila === -1) return { success: false, error: "Trabajador no encontrado" };

  var columnas = {
    'Nombre_Completo': payload.nombre,
    'DPI_CUI': payload.dpi,
    'Puesto': payload.puesto,
    'Jefe_Inmediato': payload.jefe || '',
    'Telefono': payload.telefono || '',
    'WhatsApp': payload.whatsapp || '',
    'Direccion': payload.direccion || '',
    'Fotografia_URL': payload.fotografia || ''
  };

  for (var col = 0; col < headers.length; col++) {
    if (columnas.hasOwnProperty(headers[col])) {
      sheet.getRange(fila, col + 1).setValue(columnas[headers[col]]);
    }
  }

  return { success: true, message: "Personal actualizado correctamente" };
}

function eliminarPersonal(ss, id) {
  var sheet = ss.getSheetByName("Personal");
  var fila = encontrarFilaPorID(sheet, 0, id);

  if (fila === -1) return { success: false, error: "Trabajador no encontrado" };

  // Borrado lógico: cambiar Estado a "Inactivo"
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colEstado = headers.indexOf("Estado") + 1;
  if (colEstado > 0) {
    sheet.getRange(fila, colEstado).setValue("Inactivo");
  }

  return { success: true, message: "Trabajador dado de baja correctamente" };
}

function obtenerPersonal(ss) {
  var sheet = ss.getSheetByName("Personal");
  if (!sheet) return { success: false, error: "Hoja 'Personal' no encontrada" };

  var todos = sheetToObjects(sheet);
  var activos = todos.filter(function(t) { return t.Estado === "Activo"; });

  return { success: true, data: activos, total: activos.length };
}

function obtenerTodosPersonal(ss) {
  var sheet = ss.getSheetByName("Personal");
  if (!sheet) return { success: false, error: "Hoja 'Personal' no encontrada" };

  var todos = sheetToObjects(sheet);
  return { success: true, data: todos, total: todos.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: ASISTENCIAS
// ─────────────────────────────────────────────────────────────────────────────
function registrarMarcacion(ss, payload) {
  var sheet = ss.getSheetByName("Asistencias");
  if (!sheet) throw new Error("Hoja 'Asistencias' no encontrada");

  var config = obtenerConfiguracion(ss);
  var tolerancia = config.data ? (parseInt(config.data['Tolerancia_Minutos'] || 15)) : 15;

  var idAsistencia = generarID("ASIS");
  var horaActual = Utilities.formatDate(new Date(), TIMEZONE, "HH:mm:ss");
  var horaActualCorta = horaActual.substring(0, 5);
  var fecha = payload.fecha || Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");

  // Calcular estado marcación
  var estadoMarcacion = payload.estadoMarcacion;
  if (!estadoMarcacion && payload.horaProgramada) {
    estadoMarcacion = calcularEstadoMarcacion(payload.horaProgramada, horaActualCorta, tolerancia);
  }

  // Calcular horas extra si es salida de obra
  var horasExtra = payload.horasExtra || 0;
  if (payload.tipoMarcacion === 'Salida_Obra') {
    var horaSalidaObra = config.data ? (config.data['Hora_Salida_Obra'] || '17:00') : '17:00';
    horasExtra = calcularHorasExtra(horaActualCorta, horaSalidaObra);
  }

  sheet.appendRow([
    idAsistencia,
    payload.idTrabajador,
    payload.nombreTrabajador,
    fecha,
    payload.tipoMarcacion,
    payload.horaProgramada || '',
    horaActual,
    tolerancia,
    estadoMarcacion || 'A Tiempo',
    horasExtra,
    payload.metodo || 'Manual_Fisica',  // Metodo_Registro
    payload.obra || 'Obra Principal',
    payload.gpsData ? (payload.gpsData.latitude || '') : '',  // GPS_Latitud
    payload.gpsData ? (payload.gpsData.longitude || '') : '', // GPS_Longitud
    payload.gpsData ? (payload.gpsData.accuracy || '') : '',  // GPS_Accuracy
    payload.geofenceStatus !== null ? (payload.geofenceStatus.inside ? 'Si' : 'No') : '', // Geofence_Inside
    payload.geofenceStatus ? (payload.geofenceStatus.distance || '') : '' // Geofence_Distance
  ]);

  // Registrar alerta si hay tardanza o atraso
  if (estadoMarcacion === 'Atraso') {
    registrarAlerta(ss, payload.idTrabajador, 'Tardanza en ' + payload.tipoMarcacion);
  }

  return {
    success: true,
    id: idAsistencia,
    horaReal: horaActual,
    estadoMarcacion: estadoMarcacion,
    horasExtra: horasExtra,
    message: "Marcación registrada con éxito"
  };
}

function obtenerAsistencias(ss, fecha) {
  var sheet = ss.getSheetByName("Asistencias");
  if (!sheet) return { success: false, error: "Hoja 'Asistencias' no encontrada" };

  var todos = sheetToObjects(sheet);
  if (fecha) {
    todos = todos.filter(function(a) { return a.Fecha === fecha; });
  }

  return { success: true, data: todos, total: todos.length };
}

function obtenerAsistenciaRango(ss, fechaInicio, fechaFin) {
  var sheet = ss.getSheetByName("Asistencias");
  if (!sheet) return { success: false, error: "Hoja 'Asistencias' no encontrada" };

  var todos = sheetToObjects(sheet);
  if (fechaInicio && fechaFin) {
    todos = todos.filter(function(a) {
      return a.Fecha >= fechaInicio && a.Fecha <= fechaFin;
    });
  }

  return { success: true, data: todos, total: todos.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: ALERTAS
// ─────────────────────────────────────────────────────────────────────────────
function registrarAlerta(ss, idTrabajador, tipoIncidencia) {
  var sheet = ss.getSheetByName("Alertas");
  if (!sheet) return;

  var id = generarID("ALRT");
  var fechaHora = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  sheet.appendRow([id, fechaHora, idTrabajador, tipoIncidencia, "Pendiente"]);
}

function obtenerAlertas(ss) {
  var sheet = ss.getSheetByName("Alertas");
  if (!sheet) return { success: false, error: "Hoja 'Alertas' no encontrada" };

  var todos = sheetToObjects(sheet);
  var pendientes = todos.filter(function(a) { return a.Estatus === "Pendiente"; });

  return { success: true, data: pendientes, total: pendientes.length };
}

function marcarAlertaRevisada(ss, id) {
  var sheet = ss.getSheetByName("Alertas");
  var fila = encontrarFilaPorID(sheet, 0, id);
  if (fila === -1) return { success: false, error: "Alerta no encontrada" };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colEstatus = headers.indexOf("Estatus") + 1;
  if (colEstatus > 0) {
    sheet.getRange(fila, colEstatus).setValue("Revisado");
  }

  return { success: true, message: "Alerta marcada como revisada" };
}

// ─────────────────────────────────────────────────────────────────────────────
// MÓDULO: CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────
function obtenerConfiguracion(ss) {
  var sheet = ss.getSheetByName("Configuracion");
  if (!sheet) return { success: false, error: "Hoja 'Configuracion' no encontrada" };

  var rows = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) config[rows[i][0]] = rows[i][1];
  }

  return { success: true, data: config };
}

function guardarConfiguracion(ss, payload) {
  var sheet = ss.getSheetByName("Configuracion");
  if (!sheet) return { success: false, error: "Hoja 'Configuracion' no encontrada" };

  var rows = sheet.getDataRange().getValues();

  for (var clave in payload) {
    var encontrado = false;
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] === clave) {
        sheet.getRange(i + 1, 2).setValue(payload[clave]);
        encontrado = true;
        break;
      }
    }
    if (!encontrado) {
      sheet.appendRow([clave, payload[clave]]);
    }
  }

  return { success: true, message: "Configuración guardada correctamente" };
}
