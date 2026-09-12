/**
 * CONTROL PERSONAL CAMPO — modules/ajustes.js
 * Módulo de configuración: Firestore, general, horarios, logo y backup.
 * @version 1.0.0
 */

const ModuloAjustes = (() => {

  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _cargarConfigLocal();
  }

  function _bindEvents() {
    const btnFirebase = document.getElementById('btn-connect-firebase');
    const btnLocal = document.getElementById('btn-use-local');
    if (btnFirebase) btnFirebase.addEventListener('click', _conectarFirebase);
    if (btnLocal) btnLocal.addEventListener('click', _usarModoLocal);

    // ─── Configuración General ─────────────────────────────────────────
    const btnSaveGeneral = document.getElementById('btn-save-general');
    if (btnSaveGeneral) btnSaveGeneral.addEventListener('click', _guardarGeneral);

    // ─── Horarios ──────────────────────────────────────────────────────
    const btnSaveHorarios = document.getElementById('btn-save-horarios');
    if (btnSaveHorarios) btnSaveHorarios.addEventListener('click', _guardarHorarios);

    // ─── GPS y Geocercas ────────────────────────────────────────────────
    const btnCapturarUbicacion = document.getElementById('btn-capturar-ubicacion');
    const btnSaveGPS = document.getElementById('btn-save-gps');
    if (btnCapturarUbicacion) btnCapturarUbicacion.addEventListener('click', _capturarUbicacionActual);
    if (btnSaveGPS) btnSaveGPS.addEventListener('click', _guardarConfigGPS);

    // ─── Auditoría Escáner de Campo ──────────────────────────────────────
    const btnLoadAudit = document.getElementById('btn-load-scanner-audit');
    const btnClearAudit = document.getElementById('btn-clear-scanner-audit');
    const btnExportAudit = document.getElementById('btn-export-scanner-audit');
    const btnShareWhatsApp = document.getElementById('btn-share-scanner-whatsapp');
    if (btnLoadAudit) btnLoadAudit.addEventListener('click', _mostrarAuditoriaScanner);
    if (btnClearAudit) btnClearAudit.addEventListener('click', _limpiarAuditoriaScanner);
    if (btnExportAudit) btnExportAudit.addEventListener('click', _exportarAuditoriaScannerCSV);
    if (btnShareWhatsApp) btnShareWhatsApp.addEventListener('click', _compartirScannerWhatsApp);

    // ─── Logo ──────────────────────────────────────────────────────────
    const logoInput   = document.getElementById('logo-input');
    const logoDropArea = document.getElementById('logo-drop-area');
    const btnSaveLogo = document.getElementById('btn-save-logo');

    if (logoInput) logoInput.addEventListener('change', _handleLogoUpload);
    if (btnSaveLogo) btnSaveLogo.addEventListener('click', _guardarLogo);

    // Drag & Drop del logo
    if (logoDropArea) {
      logoDropArea.addEventListener('click', () => logoInput?.click());
      logoDropArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); logoInput?.click(); }
      });
      logoDropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        logoDropArea.classList.add('drag-over');
      });
      logoDropArea.addEventListener('dragleave', () => {
        logoDropArea.classList.remove('drag-over');
      });
      logoDropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        logoDropArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          _procesarLogo(file);
        }
      });
    }

    // ─── Backup ────────────────────────────────────────────────────────
    const btnExport = document.getElementById('btn-export-backup');
    const btnImport = document.getElementById('btn-import-backup');
    const importInput = document.getElementById('import-backup-input');

    if (btnExport) btnExport.addEventListener('click', _exportarBackup);
    if (btnImport) btnImport.addEventListener('click', () => importInput?.click());
    if (importInput) importInput.addEventListener('change', _importarBackup);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CARGAR CONFIGURACIÓN LOCAL
  // ─────────────────────────────────────────────────────────────────────────
  function _cargarConfigLocal() {
    const config = AppState.get('config') || DEFAULT_CONFIG;
    const firebase = FirebaseClient.getConfig();
    _setInput('firebase-project-id', firebase.projectId);
    _setInput('firebase-api-key', firebase.apiKey);
    _setInput('firebase-auth-domain', firebase.authDomain);
    _setInput('firebase-app-id', firebase.appId);

    // General
    _setInput('cfg-nombre-obra', config.Nombre_Obra);
    _setInput('cfg-encargado',   config.Encargado);
    _setInput('cfg-tolerancia',  config.Tolerancia_Minutos);

    // Field scanner PIN
    const scannerPin = localStorage.getItem('cpc_field_scanner_pin');
    _setInput('cfg-scanner-pin', scannerPin || '');

    // Horarios
    _setInput('cfg-hora-entrada',       config.Hora_Entrada       || '07:00');
    _setInput('cfg-hora-salida-receso', config.Hora_Salida_Receso  || '10:00');
    _setInput('cfg-hora-regreso-receso',config.Hora_Regreso_Receso || '10:30');
    _setInput('cfg-hora-salida-obra',   config.Hora_Salida_Obra    || '17:00');

    // GPS
    _setCheckbox('cfg-gps-habilitado', config.GPS_Habilitado !== false);
    _setCheckbox('cfg-gps-requerir', config.GPS_Requerir_Ubicacion === true);
    _setInput('cfg-gps-centro-lat', config.GPS_Centro_Lat);
    _setInput('cfg-gps-centro-lon', config.GPS_Centro_Lon);
    _setInput('cfg-gps-radio', config.GPS_Radio_Metros || 200);

    // Logo
    const logo = config.Logo_Base64;
    if (logo) _mostrarLogoPreview(logo);
  }

  function _setCheckbox(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  }

  function _setInput(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
  }

  async function _conectarFirebase() {
    const config = { ...FirebaseClient.getConfig(),
      projectId: document.getElementById('firebase-project-id')?.value.trim(),
      apiKey: document.getElementById('firebase-api-key')?.value.trim(),
      authDomain: document.getElementById('firebase-auth-domain')?.value.trim(),
      appId: document.getElementById('firebase-app-id')?.value.trim(),
    };
    
    // Validate config before attempting connection
    const validation = window.validateFirebaseConfig ? window.validateFirebaseConfig(config) : { valid: true };
    if (!validation.valid) { 
      Alerts.error(validation.error || 'Completa ID del proyecto, API Key, dominio de autenticación y App ID.'); 
      return; 
    }
    
    if (!FirebaseClient.isConfigured(config)) { 
      Alerts.error('Completa ID del proyecto, API Key, dominio de autenticación y App ID.'); 
      return; 
    }
    
    const statusEl = document.getElementById('connection-status-detail');
    if (statusEl) statusEl.textContent = '⏳ Conectando con Firestore…';
    
    try {
      const result = await API.initialize();
      if (result.success) { 
        if (statusEl) { 
          statusEl.className = 'connection-status-detail success'; 
          statusEl.textContent = `✅ Firestore conectado: ${config.projectId}`; 
        } 
        Alerts.success('Firestore conectado y sincronización en tiempo real activa.'); 
      } else { 
        if (statusEl) { 
          statusEl.className = 'connection-status-detail error'; 
          statusEl.textContent = `❌ ${result.error || 'No se pudo conectar.'}`; 
        } 
        Alerts.error(result.error || 'No se pudo conectar con Firestore.'); 
      }
    } catch (error) {
      if (statusEl) { 
        statusEl.className = 'connection-status-detail error'; 
        statusEl.textContent = `❌ Error: ${error.message}`; 
      } 
      Alerts.error('Error al conectar con Firestore: ' + error.message);
    }
  }

  function _usarModoLocal() {
    FirebaseClient.stop();
    AppState.set('backendMode', 'local'); AppState.set('connected', false);
    const statusEl = document.getElementById('connection-status-detail');
    if (statusEl) { statusEl.className = 'connection-status-detail'; statusEl.textContent = '💾 Modo local activo en este dispositivo.'; }
    Alerts.success('Modo local activado. Tus datos se conservarán en este dispositivo.');
  }

  async function _guardarConfigFirebase() {
    const config = {
      projectId: document.getElementById('firebase-project-id')?.value.trim(),
      apiKey: document.getElementById('firebase-api-key')?.value.trim(),
      authDomain: document.getElementById('firebase-auth-domain')?.value.trim(),
      appId: document.getElementById('firebase-app-id')?.value.trim(),
    };
    
    // Validate before saving
    const validation = window.validateFirebaseConfig ? window.validateFirebaseConfig(config) : { valid: true };
    if (!validation.valid) {
      Alerts.error(validation.error || 'Configuración inválida.');
      return;
    }
    
    localStorage.setItem(LS_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
    Alerts.success('Configuración de Firebase guardada. La app intentará conectar automáticamente.');
    
    // Try to connect automatically
    setTimeout(() => _conectarFirebase(), 500);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURACIÓN GENERAL
  // ─────────────────────────────────────────────────────────────────────────
  async function _guardarGeneral() {
    const payload = {
      Nombre_Obra:         document.getElementById('cfg-nombre-obra')?.value.trim(),
      Encargado:           document.getElementById('cfg-encargado')?.value.trim(),
      Tolerancia_Minutos:  document.getElementById('cfg-tolerancia')?.value || '15',
    };

    // Validar tolerancia
    const tol = parseInt(payload.Tolerancia_Minutos);
    if (isNaN(tol) || tol < 0 || tol > 60) {
      Alerts.error('La tolerancia debe ser entre 0 y 60 minutos.');
      return;
    }

    // Guardar localmente primero
    const config = AppState.get('config');
    const newConfig = { ...config, ...payload };
    AppState.set('config', newConfig);
    localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));

    // Guardar PIN del escáner de campo
    const scannerPinInput = document.getElementById('cfg-scanner-pin');
    const scannerPin = (scannerPinInput?.value || '').trim();
    if (scannerPin) {
      localStorage.setItem('cpc_field_scanner_pin', scannerPin);
    } else {
      localStorage.removeItem('cpc_field_scanner_pin');
    }

    // Sincronizar con GAS si hay conexión
    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando en Firestore...');
      try {
        await API.guardarConfiguracion(payload);
        loader.close();
        Alerts.success('Configuración general guardada y sincronizada con Firestore');
      } catch (err) {
        loader.close();
        Alerts.warning('Guardado localmente. No se pudo sincronizar con Firestore: ' + err.message);
      }
    } else {
      Alerts.success('Configuración guardada localmente');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HORARIOS
  // ─────────────────────────────────────────────────────────────────────────
  async function _guardarHorarios() {
    const payload = {
      Hora_Entrada:        document.getElementById('cfg-hora-entrada')?.value       || '07:00',
      Hora_Salida_Receso:  document.getElementById('cfg-hora-salida-receso')?.value  || '10:00',
      Hora_Regreso_Receso: document.getElementById('cfg-hora-regreso-receso')?.value || '10:30',
      Hora_Salida_Obra:    document.getElementById('cfg-hora-salida-obra')?.value    || '17:00',
    };

    // Validar orden lógico de horarios
    const [h1, m1] = payload.Hora_Entrada.split(':').map(Number);
    const [h2, m2] = payload.Hora_Salida_Receso.split(':').map(Number);
    const [h3, m3] = payload.Hora_Regreso_Receso.split(':').map(Number);
    const [h4, m4] = payload.Hora_Salida_Obra.split(':').map(Number);

    const min1 = h1*60+m1, min2 = h2*60+m2, min3 = h3*60+m3, min4 = h4*60+m4;

    if (min2 <= min1) { Alerts.error('La salida a receso debe ser después de la entrada.'); return; }
    if (min3 <= min2) { Alerts.error('El regreso de receso debe ser después de la salida a receso.'); return; }
    if (min4 <= min3) { Alerts.error('La salida de obra debe ser después del regreso de receso.'); return; }

    const config = AppState.get('config');
    const newConfig = { ...config, ...payload };
    AppState.set('config', newConfig);
    localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));

    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando horarios...');
      try {
        await API.guardarConfiguracion(payload);
        loader.close();
        Alerts.success('Horarios guardados y sincronizados');
      } catch (err) {
        loader.close();
        Alerts.warning('Guardado localmente. Error de sincronización: ' + err.message);
      }
    } else {
      Alerts.success('Horarios guardados localmente');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOGO
  // ─────────────────────────────────────────────────────────────────────────
  let _logoPendiente = '';

  function _handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    _procesarLogo(file);
  }

  function _procesarLogo(file) {
    if (!file.type.startsWith('image/')) {
      Alerts.error('El archivo debe ser una imagen.');
      return;
    }

    if (file.size > 600 * 1024) {
      Alerts.warning('El logo es mayor a 500KB. Se comprimirá automáticamente.');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 300;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        _logoPendiente = canvas.toDataURL('image/png', 0.85);
        _mostrarLogoPreview(_logoPendiente);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function _mostrarLogoPreview(src) {
    const preview     = document.getElementById('logo-preview');
    const placeholder = document.getElementById('logo-placeholder');

    if (preview) {
      preview.src = src;
      preview.hidden = false;
    }
    if (placeholder) placeholder.style.display = 'none';
  }

  async function _guardarLogo() {
    const logoSrc = _logoPendiente || AppState.get('config').Logo_Base64;

    if (!logoSrc) {
      Alerts.error('No hay logo para guardar. Sube una imagen primero.');
      return;
    }

    const config    = AppState.get('config');
    const newConfig = { ...config, Logo_Base64: logoSrc };
    AppState.set('config', newConfig);
    localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));

    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando logo...');
      try {
        await API.guardarConfiguracion({ Logo_Base64: logoSrc });
        loader.close();
        Alerts.success('Logo guardado y sincronizado correctamente');
      } catch (err) {
        loader.close();
        Alerts.warning('Logo guardado localmente. Error de sincronización: ' + err.message);
      }
    } else {
      Alerts.success('Logo guardado localmente');
    }

    _logoPendiente = '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BACKUP
  // ─────────────────────────────────────────────────────────────────────────
  function _exportarBackup() {
    const backup = {
      version:   APP_VERSION,
      fecha:     new Date().toISOString(),
      config:    AppState.get('config') || DEFAULT_CONFIG,
      personal:  AppState.get('personal') || [],
    };

    const json     = JSON.stringify(backup, null, 2);
    const blob     = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url      = URL.createObjectURL(blob);
    const filename = `control-campo-backup-${AppState.today()}.json`;

    const a = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Alerts.success(`Backup exportado: ${filename}`);
  }

  function _importarBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      Alerts.error('El archivo debe ser un JSON de backup válido (.json)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);

        if (!backup.version || !backup.config) {
          Alerts.error('El archivo no parece ser un backup válido de este sistema.');
          return;
        }

        const confirmed = await Alerts.confirm(
          `¿Restaurar configuración del backup del ${new Date(backup.fecha).toLocaleString('es-GT')}?\n\nEsto sobreescribirá la configuración actual.`,
          'Restaurar Backup'
        );

        if (!confirmed) return;

        // Restaurar
        if (backup.config) {
          const newConfig = { ...DEFAULT_CONFIG, ...backup.config };
          localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));
          AppState.set('config', newConfig);
        }

        // Recargar campos del formulario
        _cargarConfigLocal();

        Alerts.success('Backup restaurado correctamente. La configuración ha sido actualizada.');

      } catch (err) {
        Alerts.error('Error al leer el archivo de backup: ' + err.message);
      }
    };
    reader.readAsText(file);

    // Limpiar input para permitir re-importar
    e.target.value = '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GPS Y GEOCERCAS
  // ─────────────────────────────────────────────────────────────────────────
  async function _capturarUbicacionActual() {
    if (!GPS.isAvailable()) {
      Alerts.error('Geolocalización no soportada por este navegador');
      return;
    }

    const statusEl = document.getElementById('gps-status');
    const btnCapturar = document.getElementById('btn-capturar-ubicacion');
    
    if (btnCapturar) btnCapturar.disabled = true;
    if (statusEl) {
      statusEl.className = 'gps-status info';
      statusEl.textContent = '📍 Obteniendo ubicación...';
      statusEl.style.display = 'block';
    }

    try {
      const position = await GPS.getCurrentPosition();
      
      // Llenar campos
      document.getElementById('cfg-gps-centro-lat').value = position.latitude.toFixed(6);
      document.getElementById('cfg-gps-centro-lon').value = position.longitude.toFixed(6);
      
      if (statusEl) {
        statusEl.className = 'gps-status success';
        statusEl.textContent = `✅ Ubicación capturada: ${GPS.formatCoordinates(position.latitude, position.longitude)} (±${Math.round(position.accuracy)}m)`;
      }
      
      Alerts.success('Ubicación capturada correctamente');
    } catch (err) {
      if (statusEl) {
        statusEl.className = 'gps-status error';
        statusEl.textContent = `❌ Error: ${err.message}`;
      }
      Alerts.error(err.message, 'Error de ubicación');
    } finally {
      if (btnCapturar) btnCapturar.disabled = false;
    }
  }

  async function _guardarConfigGPS() {
    const payload = {
      GPS_Habilitado:         document.getElementById('cfg-gps-habilitado')?.checked,
      GPS_Requerir_Ubicacion: document.getElementById('cfg-gps-requerir')?.checked,
      GPS_Centro_Lat:         document.getElementById('cfg-gps-centro-lat')?.value || null,
      GPS_Centro_Lon:         document.getElementById('cfg-gps-centro-lon')?.value || null,
      GPS_Radio_Metros:       document.getElementById('cfg-gps-radio')?.value || 200,
    };

    // Validar usando el módulo de validaciones compartido
    const validation = Validators.validateConfigGPS(payload);
    if (!validation.valid) {
      const firstError = validation.errors[0];
      Alerts.error(firstError.error, 'Error de validación GPS');
      return;
    }

    // Guardar localmente
    const config = AppState.get('config');
    const newConfig = { ...config, ...payload };
    AppState.set('config', newConfig);
    localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));

    // Sincronizar con GAS si hay conexión
    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando configuración GPS...');
      try {
        await API.guardarConfiguracion(payload);
        loader.close();
        Alerts.success('Configuración GPS guardada y sincronizada');
      } catch (err) {
        loader.close();
        Alerts.warning('Guardado localmente. Error de sincronización: ' + err.message);
      }
    } else {
      Alerts.success('Configuración GPS guardada localmente');
    }
  }

  // Cargar módulo (llamado desde router)
  async function cargar() {
    _cargarConfigLocal();

    // Si hay conexión, sincronizar config desde GAS
    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      try {
        await API.obtenerConfiguracion();
        _cargarConfigLocal(); // Re-llenar con datos actualizados
      } catch (err) {
        console.warn('[Ajustes] No se pudo sincronizar configuración:', err.message);
      }
    }
  }

  // ─── Auditoría Escáner de Campo ──────────────────────────────────────
  function _mostrarAuditoriaScanner() {
    const output = document.getElementById('scanner-audit-output');
    const logEl = document.getElementById('scanner-audit-log');
    if (!output || !logEl) return;

    try {
      const raw = localStorage.getItem('field_scanner_audit_log');
      const log = raw ? JSON.parse(raw) : [];
      if (!log.length) {
        logEl.textContent = 'Sin registros de auditoría.';
        output.hidden = false;
        return;
      }
      const lines = log.slice().reverse().slice(0, 50).map((entry) => {
        const when = new Date(entry.timestamp).toLocaleString('es-GT');
        return `[${when}] ${entry.operator} · ${entry.device}\n  ${entry.workerName} · ${entry.tipo} · ${entry.status}`;
      });
      logEl.textContent = lines.join('\n\n');
      output.hidden = false;
    } catch {
      logEl.textContent = 'No se pudo leer el log de auditoría.';
      output.hidden = false;
    }
  }

  function _limpiarAuditoriaScanner() {
    localStorage.removeItem('field_scanner_audit_log');
    const output = document.getElementById('scanner-audit-output');
    const logEl = document.getElementById('scanner-audit-log');
    if (logEl) logEl.textContent = '';
    if (output) output.hidden = true;
  }

  function _exportarAuditoriaScannerCSV() {
    try {
      const raw = localStorage.getItem('field_scanner_audit_log');
      const log = raw ? JSON.parse(raw) : [];
      if (!log.length) {
        Alerts.warning('No hay registros para exportar.');
        return;
      }

      const headers = ['Fecha', 'Operador', 'Dispositivo', 'Acción', 'Trabajador', 'Tipo', 'Estado', 'Contexto', 'Error'];
      const rows = log.map((entry) => {
        const when = new Date(entry.timestamp).toISOString();
        return [
          when,
          entry.operator || '',
          entry.device || '',
          entry.action || '',
          entry.workerName || entry.workerId || '',
          entry.tipo || '',
          entry.status || '',
          entry.context || '',
          entry.error || '',
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditoria_scanner_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      Alerts.success('CSV exportado correctamente');
    } catch {
      Alerts.error('No se pudo exportar la auditoría.');
    }
  }

  function _compartirScannerWhatsApp() {
    try {
      const url = window.location.origin + '/field-scanner.html';
      const mensaje = encodeURIComponent(
        'Escáner de Campo — Control Personal\n\n' +
        'Instalá la subaplicación de escaneo QR desde el siguiente link:\n' +
        url + '\n\n' +
        'PIN de acceso: consultá al administrador.'
      );
      const waUrl = `https://wa.me/?text=${mensaje}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      Alerts.success('Se abrió WhatsApp para compartir el link.');
    } catch {
      Alerts.error('No se pudo abrir WhatsApp.');
    }
  }

  return { init, cargar };
})();
