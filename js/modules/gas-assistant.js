/**
 * CONTROL PERSONAL CAMPO — modules/gas-assistant.js
 * Asistente de configuración para Google Apps Script
 * @version 1.5.0
 */

const GasAssistant = (() => {
  
  // ─── Estado del asistente ───────────────────────────────────────────────────
  let _currentStep = 1;
  let _gasUrl = '';
  let _gasEmail = '';
  
  // ─── Código de Google Apps Script ───────────────────────────────────────────
  const _APPS_SCRIPT_CODE = `// CONTROL PERSONAL CAMPO - Google Apps Script Backend
// Este código configura automáticamente Google Sheets y crea los endpoints necesarios

function setupCompleto() {
  // Crear la hoja de cálculo principal
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Crear pestañas necesarias si no existen
  const tabs = ['Personal', 'Asistencia', 'Config'];
  tabs.forEach(tabName => {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
  });
  
  // Configurar estructura de la pestaña Personal
  const personalSheet = ss.getSheetByName('Personal');
  if (personalSheet.getLastRow() === 0) {
    personalSheet.appendRow([
      'ID_Trabajador', 'Nombre_Completo', 'DPI_CUI', 'Puesto', 
      'Jefe_Inmediato', 'Telefono', 'WhatsApp', 'Direccion', 
      'Fotografia_URL', 'Estado', 'Fecha_Registro'
    ]);
  }
  
  // Configurar estructura de la pestaña Asistencia
  const asistenciaSheet = ss.getSheetByName('Asistencia');
  if (asistenciaSheet.getLastRow() === 0) {
    asistenciaSheet.appendRow([
      'ID_Marcacion', 'ID_Trabajador', 'Nombre_Completo', 'Fecha', 
      'Hora_Entrada', 'Hora_Salida_Receso', 'Hora_Regreso_Receso', 
      'Hora_Salida', 'Tipo_Marcacion', 'Ubicacion', 'Estado'
    ]);
  }
  
  // Configurar estructura de la pestaña Config
  const configSheet = ss.getSheetByName('Config');
  if (configSheet.getLastRow() === 0) {
    configSheet.appendRow(['Clave', 'Valor']);
    configSheet.appendRow(['Nombre_Obra', 'Mi Obra']);
    configSheet.appendRow(['Encargado', '']);
    configSheet.appendRow(['Tolerancia_Minutos', '15']);
  }
  
  return "Configuración completada exitosamente";
}

// Endpoint para obtener personal
function doGetPersonal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Personal');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const personal = rows.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: personal
  })).setMimeType(ContentService.MimeType.JSON);
}

// Endpoint para guardar personal
function doPostGuardarPersonal(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Personal');
  
  sheet.appendRow([
    data.ID_Trabajador,
    data.Nombre_Completo,
    data.DPI_CUI,
    data.Puesto,
    data.Jefe_Inmediato,
    data.Telefono,
    data.WhatsApp,
    data.Direccion,
    data.Fotografia_URL,
    data.Estado,
    data.Fecha_Registro
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Trabajador guardado'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Endpoint para registrar asistencia
function doPostRegistrarAsistencia(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Asistencia');
  
  sheet.appendRow([
    data.ID_Marcacion,
    data.ID_Trabajador,
    data.Nombre_Completo,
    data.Fecha,
    data.Hora_Entrada,
    data.Hora_Salida_Receso,
    data.Hora_Regreso_Receso,
    data.Hora_Salida,
    data.Tipo_Marcacion,
    data.Ubicacion,
    data.Estado
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Asistencia registrada'
  })).setMimeType(ContentService.MimeType.JSON);
}

// Endpoint principal para manejar todas las solicitudes
function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'personal') {
    return doGetPersonal();
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Acción no reconocida'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const action = e.parameter.action;
  
  if (action === 'guardarPersonal') {
    return doPostGuardarPersonal(e);
  }
  
  if (action === 'registrarAsistencia') {
    return doPostRegistrarAsistencia(e);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Acción no reconocida'
  })).setMimeType(ContentService.MimeType.JSON);
}`;

  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _generateAppsScriptLink();
    _loadAppsScriptCode();
  }

  // ─── Eventos ─────────────────────────────────────────────────────────────
  function _bindEvents() {
    // Paso 1 → Paso 2
    document.getElementById('gas-start-step-2')?.addEventListener('click', () => {
      _goToStep(2);
    });

    // Paso 2 navegación
    document.getElementById('gas-back-step-1')?.addEventListener('click', () => {
      _goToStep(1);
    });
    document.getElementById('gas-start-step-3')?.addEventListener('click', () => {
      _gasEmail = document.getElementById('gas-email')?.value || '';
      _goToStep(3);
    });

    // Paso 3 navegación
    document.getElementById('gas-back-step-2')?.addEventListener('click', () => {
      _goToStep(2);
    });
    document.getElementById('gas-step-3-confirm')?.addEventListener('click', () => {
      _goToStep(4);
    });

    // Copiar código
    document.getElementById('gas-copy-code')?.addEventListener('click', _copyCodeToClipboard);

    // Paso 4 navegación
    document.getElementById('gas-back-step-3')?.addEventListener('click', () => {
      _goToStep(3);
    });
    document.getElementById('gas-step-4-confirm')?.addEventListener('click', () => {
      _gasUrl = document.getElementById('gas-webapp-url')?.value || '';
      if (!_gasUrl) {
        Alerts.error('Por favor ingresa la URL de la Web App', 'URL requerida');
        return;
      }
      _updateUrlPreview();
      _goToStep(5);
    });

    // Paso 5 acciones
    document.getElementById('gas-back-step-4')?.addEventListener('click', () => {
      _goToStep(4);
    });
    document.getElementById('gas-auto-setup')?.addEventListener('click', _autoSetup);
    document.getElementById('gas-test-connection')?.addEventListener('click', _testConnection);
    document.getElementById('gas-finalize-setup')?.addEventListener('click', _finalizeSetup);

    // Cerrar asistente
    document.getElementById('gas-close-assistant')?.addEventListener('click', _closeAssistant);
    document.getElementById('btn-gas-assistant-close')?.addEventListener('click', _closeAssistant);
  }

  // ─── Navegación entre pasos ───────────────────────────────────────────────
  function _goToStep(stepNumber) {
    // Ocultar todos los pasos
    document.querySelectorAll('.gas-step').forEach(step => {
      step.classList.remove('active');
      step.hidden = true;
    });

    // Mostrar paso actual
    const currentStep = document.getElementById(`gas-step-${stepNumber}`);
    if (currentStep) {
      currentStep.classList.add('active');
      currentStep.hidden = false;
    }

    _currentStep = stepNumber;

    // Renderizar iconos Lucide
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // ─── Generar enlace de Apps Script ───────────────────────────────────────
  function _generateAppsScriptLink() {
    const createLink = document.getElementById('gas-create-link');
    if (createLink) {
      createLink.href = 'https://script.google.com/';
    }
  }

  // ─── Cargar código de Apps Script ───────────────────────────────────────────
  function _loadAppsScriptCode() {
    const codeContent = document.getElementById('gas-code-content');
    if (codeContent) {
      codeContent.textContent = _APPS_SCRIPT_CODE;
    }
  }

  // ─── Copiar código al portapapeles ───────────────────────────────────────────
  function _copyCodeToClipboard() {
    navigator.clipboard.writeText(_APPS_SCRIPT_CODE).then(() => {
      Alerts.success('Código copiado al portapapeles', 'Copiado');
    }).catch(() => {
      Alerts.error('No se pudo copiar el código', 'Error');
    });
  }

  // ─── Actualizar preview de URL ─────────────────────────────────────────────
  function _updateUrlPreview() {
    const urlPreview = document.getElementById('gas-url-preview');
    if (urlPreview && _gasUrl) {
      urlPreview.textContent = _gasUrl;
    }
  }

  // ─── Configuración automática ───────────────────────────────────────────────
  async function _autoSetup() {
    const statusDiv = document.getElementById('gas-connection-status');
    if (statusDiv) {
      statusDiv.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Configurando Google Sheets...</p></div>';
    }

    try {
      // Llamar al endpoint de setup
      const response = await fetch(`${_gasUrl}?action=setup`);
      const result = await response.json();

      if (result.success) {
        if (statusDiv) {
          statusDiv.innerHTML = '<div class="success-message"><i data-lucide="check-circle"></i><p>Google Sheets configurado exitosamente</p></div>';
          if (window.lucide) lucide.createIcons();
        }
        Alerts.success('Google Sheets configurado correctamente', 'Configuración completada');
      } else {
        throw new Error(result.error || 'Error en la configuración');
      }
    } catch (error) {
      if (statusDiv) {
        statusDiv.innerHTML = '<div class="error-message"><i data-lucide="alert-circle"></i><p></p></div>';
        statusDiv.querySelector('p').textContent = 'Error: ' + error.message;
        if (window.lucide) lucide.createIcons();
      }
      Alerts.error(error.message, 'Error de configuración');
    }
  }

  // ─── Probar conexión ───────────────────────────────────────────────────────
  async function _testConnection() {
    const statusDiv = document.getElementById('gas-connection-status');
    if (statusDiv) {
      statusDiv.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Probando conexión...</p></div>';
    }

    try {
      // Probar conexión básica
      const response = await fetch(`${_gasUrl}?action=personal`);
      const result = await response.json();

      if (result.success) {
        if (statusDiv) {
          statusDiv.innerHTML = '<div class="success-message"><i data-lucide="check-circle"></i><p>Conexión exitosa. Endpoint funcionando correctamente.</p></div>';
          if (window.lucide) lucide.createIcons();
        }
        Alerts.success('Conexión con Google Apps Script establecida', 'Conexión exitosa');
      } else {
        throw new Error(result.error || 'Error en la respuesta del servidor');
      }
    } catch (error) {
      if (statusDiv) {
        statusDiv.innerHTML = '<div class="error-message"><i data-lucide="alert-circle"></i><p></p></div>';
        statusDiv.querySelector('p').textContent = 'Error: ' + error.message;
        if (window.lucide) lucide.createIcons();
      }
      Alerts.error(error.message, 'Error de conexión');
    }
  }

  // ─── Finalizar configuración ───────────────────────────────────────────────
  function _finalizeSetup() {
    // Guardar la URL en la configuración
    if (_gasUrl) {
      const config = AppState.get('config') || {};
      config.gasUrl = _gasUrl;
      AppState.set('config', config);
      
      // También guardar en localStorage
      try {
        localStorage.setItem('cpc_gas_url', _gasUrl);
      } catch (e) {
        console.warn('No se pudo guardar la URL en localStorage:', e);
      }

      // Actualizar configuración de API para usar GAS
      if (window.API && window.API.setBackendUrl) {
        API.setBackendUrl(_gasUrl);
      }
    }

    // Ir al paso final
    _goToStep(6);
    
    Alerts.success('Configuración completada. Tu aplicación está conectada con Google Sheets.', '¡Listo!');
  }

  // ─── Cerrar asistente ───────────────────────────────────────────────────────
  function _closeAssistant() {
    const modal = document.getElementById('modal-gas-assistant');
    if (modal) {
      modal.hidden = true;
    }
    
    // Resetear al paso 1 para la próxima vez
    _currentStep = 1;
    _gasUrl = '';
    _gasEmail = '';
  }

  // ─── Abrir asistente ───────────────────────────────────────────────────────
  function open() {
    const modal = document.getElementById('modal-gas-assistant');
    if (modal) {
      modal.hidden = false;
      _goToStep(1);
    }
  }

  // ─── Exportar funciones públicas ───────────────────────────────────────────
  return {
    init,
    open
  };
})();

// Auto-inicializar si estamos en el DOM
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GasAssistant.init());
  } else {
    GasAssistant.init();
  }
  window.GasAssistant = GasAssistant;
}