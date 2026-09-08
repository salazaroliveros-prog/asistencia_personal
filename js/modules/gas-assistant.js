/**
 * CONTROL PERSONAL CAMPO — modules/gas-assistant.js
 * Asistente de configuración automatizada para Google Apps Script
 * @version 1.0.0
 */

const GASAssistant = (() => {
  let _currentStep = 1;
  let _userEmail = '';
  let _webAppUrl = '';

  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _loadGASCode();
  }

  function _bindEvents() {
    // Botón principal en ajustes
    const btnStartAssistant = document.getElementById('btn-start-assistant');
    if (btnStartAssistant) {
      btnStartAssistant.addEventListener('click', _openAssistant);
    }

    // Cerrar modal
    const btnClose = document.getElementById('btn-gas-assistant-close');
    if (btnClose) {
      btnClose.addEventListener('click', _closeAssistant);
    }

    // Navegación entre pasos
    document.getElementById('gas-start-step-2')?.addEventListener('click', () => _goToStep(2));
    document.getElementById('gas-back-step-1')?.addEventListener('click', () => _goToStep(1));
    document.getElementById('gas-start-step-3')?.addEventListener('click', () => _goToStep(3));
    document.getElementById('gas-back-step-2')?.addEventListener('click', () => _goToStep(2));
    document.getElementById('gas-step-3-confirm')?.addEventListener('click', () => _goToStep(4));
    document.getElementById('gas-back-step-3')?.addEventListener('click', () => _goToStep(3));
    document.getElementById('gas-step-4-confirm')?.addEventListener('click', () => _goToStep(5));
    document.getElementById('gas-back-step-4')?.addEventListener('click', () => _goToStep(4));
    document.getElementById('gas-test-connection')?.addEventListener('click', _testConnection);
    document.getElementById('gas-auto-setup')?.addEventListener('click', _autoSetup);
    document.getElementById('gas-finalize-setup')?.addEventListener('click', _finalizeSetup);
    document.getElementById('gas-close-assistant')?.addEventListener('click', _closeAssistant);

    // Copiar código
    document.getElementById('gas-copy-code')?.addEventListener('click', _copyCode);
  }

  // ─── Navegación ─────────────────────────────────────────────────────────────
  function _openAssistant() {
    const modal = document.getElementById('modal-gas-assistant');
    if (modal) {
      modal.hidden = false;
      _currentStep = 1;
      _showStep(1);
    }
  }

  function _closeAssistant() {
    const modal = document.getElementById('modal-gas-assistant');
    if (modal) {
      modal.hidden = true;
      _currentStep = 1;
      _showStep(1);
    }
  }

  function _goToStep(step) {
    _currentStep = step;
    _showStep(step);
  }

  function _showStep(step) {
    // Ocultar todos los pasos
    document.querySelectorAll('.gas-step').forEach(el => {
      el.classList.remove('active');
      el.hidden = true;
    });

    // Mostrar paso actual
    const currentStepEl = document.getElementById(`gas-step-${step}`);
    if (currentStepEl) {
      currentStepEl.classList.add('active');
      currentStepEl.hidden = false;
    }

    // Acciones específicas por paso
    if (step === 3) {
      _generateCreateLink();
    }
  }

  // ─── Carga de Código GAS ──────────────────────────────────────────────────────
  function _loadGASCode() {
    const codeContent = document.getElementById('gas-code-content');
    if (!codeContent) return;

    // Código del archivo Code.gs del repositorio
    const gasCode = `/**
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
    if (data[i][idColumna] == idValor) return i + 1;
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
  var HORA_SALIDA_MIN = 17 * 60 + 15;
  var partes = horaRealStr.split(':');
  var minutosReal = parseInt(partes[0]) * 60 + parseInt(partes[1]);
  if (minutosReal > HORA_SALIDA_MIN) {
    var exceso = minutosReal - HORA_SALIDA_MIN;
    return Math.round(exceso / 30) * 0.5;
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

  var estadoMarcacion = payload.estadoMarcacion;
  if (!estadoMarcacion && payload.horaProgramada) {
    estadoMarcacion = calcularEstadoMarcacion(payload.horaProgramada, horaActualCorta, tolerancia);
  }

  var horasExtra = payload.horasExtra || 0;
  if (payload.tipoMarcacion === 'Salida_Obra') {
    horasExtra = calcularHorasExtra(horaActualCorta, "17:00");
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
    payload.metodo || 'Manual_Fisica',
    payload.obra || 'Obra Principal',
    payload.gpsData ? (payload.gpsData.latitude || '') : '',
    payload.gpsData ? (payload.gpsData.longitude || '') : '',
    payload.gpsData ? (payload.gpsData.accuracy || '') : '',
    payload.geofenceStatus !== null ? (payload.geofenceStatus.inside ? 'Si' : 'No') : '',
    payload.geofenceStatus ? (payload.geofenceStatus.distance || '') : ''
  ]);

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
}`;

    codeContent.textContent = gasCode;

    // Mantener el código mostrado sincronizado con los archivos reales.
    Promise.all([
      fetch('gas/Code.gs').then(response => response.ok ? response.text() : Promise.reject(new Error('Code.gs no disponible'))),
      fetch('gas/SetupSheets.gs').then(response => response.ok ? response.text() : Promise.reject(new Error('SetupSheets.gs no disponible')))
    ]).then(([code, setup]) => {
      codeContent.textContent = code + '\n\n' + setup;
    }).catch(() => {
      // El código embebido anterior permite continuar sin red.
    });
  }

  function _generateCreateLink() {
    const emailInput = document.getElementById('gas-email');
    const email = emailInput?.value.trim();
    
    _userEmail = email && email.includes('@') ? email : '';

    // Generar enlace para crear proyecto Apps Script
    const createLink = `https://script.google.com/macros/create?fromDrive=true&fromDriveUpload=true&u=${encodeURIComponent(email)}`;
    
    const linkElement = document.getElementById('gas-create-link');
    if (linkElement) {
      linkElement.href = createLink;
    }
  }

  function _copyCode() {
    const codeContent = document.getElementById('gas-code-content');
    if (codeContent) {
      navigator.clipboard.writeText(codeContent.textContent).then(() => {
        Alerts.success('Código copiado al portapapeles');
      }).catch(() => {
        Alerts.error('Error al copiar el código');
      });
    }
  }

  async function _testConnection() {
    const webAppUrl = document.getElementById('gas-webapp-url')?.value.trim();
    
    if (!webAppUrl) {
      Alerts.error('Por favor ingresa la URL de la Web App');
      return;
    }

    if (!webAppUrl.includes('/exec')) {
      Alerts.warning('La URL debe terminar en /exec, no en /dev');
      return;
    }

    const statusEl = document.getElementById('gas-connection-status');
    statusEl.className = 'gas-connection-status loading';
    statusEl.textContent = '⏳ Probando conexión...';
    statusEl.style.display = 'block';

    try {
      AppState.set('gasUrl', webAppUrl);
      
      const result = await API.ping();
      
      if (result.success) {
        statusEl.textContent = '⏳ Conexión válida. Preparando Google Sheets...';
        const provision = await API.initializeConnection();
        await API.diagnoseConnection();
        statusEl.className = 'gas-connection-status success';
        statusEl.textContent = `✅ Google Sheets listo${provision.spreadsheetUrl ? ' y conectado' : ''}`;
        _webAppUrl = webAppUrl;
        
        const previewEl = document.getElementById('gas-url-preview');
        if (previewEl) {
          previewEl.textContent = webAppUrl;
        }
        
        Alerts.success('Google Sheets se preparó y conectó automáticamente');
      } else {
        statusEl.className = 'gas-connection-status error';
        statusEl.textContent = '❌ Error de conexión';
        Alerts.error('No se pudo conectar con Google Sheets: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      statusEl.className = 'gas-connection-status error';
      statusEl.textContent = '❌ Error de conexión';
      Alerts.error('Error de conexión: ' + err.message);
    }
  }

  async function _autoSetup() {
    const input = document.getElementById('gas-webapp-url');
    const url = input?.value.trim();
    const statusEl = document.getElementById('gas-connection-status');
    const button = document.getElementById('gas-auto-setup');

    if (!url || !url.includes('/exec')) {
      Alerts.warning('Primero pega la URL /exec de tu Web App de Apps Script.');
      input?.focus();
      return;
    }

    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    if (statusEl) {
      statusEl.className = 'gas-connection-status loading';
      statusEl.style.display = 'block';
      statusEl.textContent = '⏳ Conectando, creando la hoja y verificando pestañas...';
    }

    try {
      AppState.set('gasUrl', url);
      const ping = await API.ping();
      if (!ping.success) throw new Error(ping.error || 'Apps Script no respondió correctamente.');
      const provision = await API.initializeConnection();
      await API.diagnoseConnection();
      _webAppUrl = url;
      document.getElementById('gas-url-preview')?.replaceChildren(document.createTextNode(url));
      if (statusEl) {
        statusEl.className = 'gas-connection-status success';
        statusEl.textContent = '✅ Todo listo: hoja, pestañas y conexión verificadas.';
      }
      Alerts.success(provision.spreadsheetUrl ? 'Cuenta conectada y Google Sheets creado automáticamente.' : 'Conexión verificada correctamente.');
    } catch (error) {
      if (statusEl) {
        statusEl.className = 'gas-connection-status error';
        statusEl.textContent = `❌ ${_friendlySetupError(error)}`;
      }
      Alerts.error(_friendlySetupError(error), 'No se pudo completar la conexión');
    } finally {
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
    }
  }

  function _friendlySetupError(error) {
    const message = String(error?.message || error || 'Error desconocido');
    if (/Acción no válida|initialize/i.test(message)) {
      return 'Tu Apps Script necesita actualizarse con la versión de configuración automática y volver a desplegarse.';
    }
    if (/getActiveSpreadsheet|null|Spreadsheet/i.test(message)) {
      return 'Google autorizó la conexión, pero el Apps Script aún no tiene una hoja vinculada. Pulsa “Actualizar instrucciones” y vuelve a desplegarlo.';
    }
    return message;
  }

  async function _finalizeSetup() {
    if (!_webAppUrl) {
      Alerts.error('Primero debes probar la conexión exitosamente');
      return;
    }

    try {
      const loader = Alerts.loading('Finalizando configuración...');
      
      // Guardar URL en localStorage
      localStorage.setItem(LS_KEYS.GAS_URL, _webAppUrl);
      AppState.set('gasUrl', _webAppUrl);
      
      // Actualizar campo de URL en ajustes
      const urlInput = document.getElementById('gas-url');
      if (urlInput) {
        urlInput.value = _webAppUrl;
      }

      loader.close();
      
      _goToStep(6);
      
      setTimeout(() => {
        Alerts.success('Configuración completada exitosamente');
      }, 500);
      
    } catch (err) {
      Alerts.error('Error al finalizar configuración: ' + err.message);
    }
  }

  // ─── API Pública ───────────────────────────────────────────────────────────
  return {
    init
  };
})();
