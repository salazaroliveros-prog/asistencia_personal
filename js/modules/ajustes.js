/**
 * CONTROL PERSONAL CAMPO — modules/ajustes.js
 * Configuración de obra: general, horarios, GPS, logo, backup y escáner.
 * Auth / Firestore viven en ConnectionHub (connection-hub.js).
 * @version 2.0.0
 */

const _ModuloAjustes = (() => {

  let _eventsBound = false;

  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _cargarConfigLocal();
  }

  function _bindEvents() {
    if (_eventsBound) return;
    _eventsBound = true;

    // ─── Configuración General ────────────────────────────────────────────
    const btnSaveGeneral = document.getElementById('btn-save-general');
    if (btnSaveGeneral) btnSaveGeneral.addEventListener('click', _guardarGeneral);

    // ─── Horarios ─────────────────────────────────────────────────────────
    const btnSaveHorarios = document.getElementById('btn-save-horarios');
    if (btnSaveHorarios) btnSaveHorarios.addEventListener('click', _guardarHorarios);

    // ─── GPS y Geocercas ──────────────────────────────────────────────────
    const btnCapturarUbicacion = document.getElementById('btn-capturar-ubicacion');
    const btnSaveGPS = document.getElementById('btn-save-gps');
    if (btnCapturarUbicacion) btnCapturarUbicacion.addEventListener('click', _capturarUbicacionActual);
    if (btnSaveGPS)           btnSaveGPS.addEventListener('click', _guardarConfigGPS);

    // ─── Configuración SMTP ─────────────────────────────────────────────────
    const btnTestSMTP = document.getElementById('btn-test-smtp');
    const btnSaveSMTP = document.getElementById('btn-save-smtp');
    if (btnTestSMTP) btnTestSMTP.addEventListener('click', _probarConexionSMTP);
    if (btnSaveSMTP) btnSaveSMTP.addEventListener('click', _guardarConfigSMTP);

    // ─── Auditoría Escáner de Campo ───────────────────────────────────────
    const btnLoadAudit    = document.getElementById('btn-load-scanner-audit');
    const btnClearAudit   = document.getElementById('btn-clear-scanner-audit');
    const btnExportAudit  = document.getElementById('btn-export-scanner-audit');
    const btnShareWhatsApp = document.getElementById('btn-share-scanner-whatsapp');
    const btnQrInstalacion = document.getElementById('btn-qr-scanner-instalacion');
    if (btnLoadAudit)    btnLoadAudit.addEventListener('click', _mostrarAuditoriaScanner);
    if (btnClearAudit)   btnClearAudit.addEventListener('click', _limpiarAuditoriaScanner);
    if (btnExportAudit)  btnExportAudit.addEventListener('click', _exportarAuditoriaScannerCSV);
    if (btnShareWhatsApp) btnShareWhatsApp.addEventListener('click', _compartirScannerWhatsApp);
    if (btnQrInstalacion) btnQrInstalacion.addEventListener('click', _mostrarQrScannerInstalacion);

    // ─── Logo ─────────────────────────────────────────────────────────────
    const logoInput    = document.getElementById('logo-input');
    const logoDropArea = document.getElementById('logo-drop-area');
    const btnSaveLogo  = document.getElementById('btn-save-logo');

    if (logoInput)  logoInput.addEventListener('change', _handleLogoUpload);
    if (btnSaveLogo) btnSaveLogo.addEventListener('click', _guardarLogo);

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

    // ─── Backup ───────────────────────────────────────────────────────────
    const btnExport   = document.getElementById('btn-export-backup');
    const btnImport   = document.getElementById('btn-import-backup');
    const importInput = document.getElementById('import-backup-input');

    if (btnExport)   btnExport.addEventListener('click', _exportarBackup);
    if (btnImport)   btnImport.addEventListener('click', () => importInput?.click());
    if (importInput) importInput.addEventListener('change', _importarBackup);

    // ─── Exportación CSV ──────────────────────────────────────────────────
    const btnExportTrabajadores = document.getElementById('btn-export-trabajadores');
    const btnExportAsistencias  = document.getElementById('btn-export-asistencias');
    if (btnExportTrabajadores) btnExportTrabajadores.addEventListener('click', _exportarTrabajadoresCSV);
    if (btnExportAsistencias)  btnExportAsistencias.addEventListener('click', _exportarAsistenciasCSV);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CARGAR CONFIGURACIÓN LOCAL (obra — no auth)
  // ─────────────────────────────────────────────────────────────────────────
  function _cargarConfigLocal() {
    const config = AppState.get('config') || DEFAULT_CONFIG;

    _setInput('cfg-nombre-obra',  config.Nombre_Obra);
    _setInput('cfg-encargado',    config.Encargado);
    _setInput('cfg-tolerancia',   config.Tolerancia_Minutos);

    _setInput('cfg-hora-entrada',        config.Hora_Entrada        || '07:00');
    _setInput('cfg-hora-salida-receso',  config.Hora_Salida_Receso  || '10:00');
    _setInput('cfg-hora-regreso-receso', config.Hora_Regreso_Receso || '10:30');
    _setInput('cfg-hora-salida-obra',    config.Hora_Salida_Obra    || '17:00');

    _setCheckbox('cfg-gps-habilitado', config.GPS_Habilitado !== false);
    _setCheckbox('cfg-gps-requerir',   config.GPS_Requerir_Ubicacion === true);
    _setInput('cfg-gps-centro-lat', config.GPS_Centro_Lat);
    _setInput('cfg-gps-centro-lon', config.GPS_Centro_Lon);
    _setInput('cfg-gps-radio',      config.GPS_Radio_Metros || 200);

    // Cargar configuración SMTP desde AppState o variables de entorno
    let smtpConfig = config.SMTP_Config;
    
    // Si no hay configuración en AppState, intentar cargar desde variables de entorno
    if (!smtpConfig && typeof import.meta !== 'undefined' && import.meta.env) {
      const envConfig = {
        host: import.meta.env.VITE_SMTP_HOST,
        port: import.meta.env.VITE_SMTP_PORT,
        user: import.meta.env.VITE_SMTP_USER,
        password: import.meta.env.VITE_SMTP_PASSWORD,
        from: import.meta.env.VITE_SMTP_FROM,
        fromName: import.meta.env.VITE_SMTP_FROM_NAME,
        secure: import.meta.env.VITE_SMTP_SECURE === 'true'
      };
      
      // Solo usar configuración de entorno si todos los campos requeridos están presentes
      if (envConfig.host && envConfig.port && envConfig.user && envConfig.password) {
        smtpConfig = envConfig;
      }
    }

    if (smtpConfig) {
      _setInput('cfg-smtp-host', smtpConfig.host);
      _setInput('cfg-smtp-port', smtpConfig.port);
      _setInput('cfg-smtp-user', smtpConfig.user);
      _setInput('cfg-smtp-from', smtpConfig.from);
      _setInput('cfg-smtp-from-name', smtpConfig.fromName);
      _setCheckbox('cfg-smtp-secure', smtpConfig.secure !== false);
      // No cargamos la contraseña por seguridad, a menos que venga de variables de entorno
      if (smtpConfig.password && typeof import.meta !== 'undefined' && import.meta.env?.VITE_SMTP_PASSWORD) {
        _setInput('cfg-smtp-password', smtpConfig.password);
      }
    }

    if (config.Logo_Base64) _mostrarLogoPreview(config.Logo_Base64);
  }

  function _setCheckbox(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  }

  function _setInput(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURACIÓN GENERAL
  // Fix #3: Nombre_Obra es campo requerido — valida antes de guardar
  // ─────────────────────────────────────────────────────────────────────────
  async function _guardarGeneral() {
    const nombreObra = document.getElementById('cfg-nombre-obra')?.value.trim() || '';
    const encargado  = document.getElementById('cfg-encargado')?.value.trim()   || '';
    const tolRaw     = document.getElementById('cfg-tolerancia')?.value         || '15';
    const tol        = parseInt(tolRaw, 10);

    // Fix #3: validar nombre de obra requerido
    if (!nombreObra) {
      Alerts.error('El nombre de la obra / empresa es obligatorio.');
      document.getElementById('cfg-nombre-obra')?.focus();
      return;
    }

    // Validar tolerancia
    if (isNaN(tol) || tol < 0 || tol > 60) {
      Alerts.error('La tolerancia debe ser un número entre 0 y 60 minutos.');
      return;
    }

    const payload = {
      Nombre_Obra:        nombreObra,
      Encargado:          encargado,
      Tolerancia_Minutos: tol,
    };

    // Guardar localmente primero (offline-first)
    const newConfig = { ...AppState.get('config'), ...payload };
    AppState.set('config', newConfig);
    localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));

    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando en Firestore...');
      try {
        await API.guardarConfiguracion(payload);
        loader.close();
        Alerts.success('Configuración general guardada y sincronizada con Firestore.');
      } catch (err) {
        loader.close();
        Alerts.warning('Guardado localmente. No se pudo sincronizar con Firestore: ' + err.message);
      }
    } else {
      Alerts.success('Configuración guardada localmente.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HORARIOS
  // ─────────────────────────────────────────────────────────────────────────
  async function _guardarHorarios() {
    const payload = {
      Hora_Entrada:        document.getElementById('cfg-hora-entrada')?.value        || '07:00',
      Hora_Salida_Receso:  document.getElementById('cfg-hora-salida-receso')?.value  || '10:00',
      Hora_Regreso_Receso: document.getElementById('cfg-hora-regreso-receso')?.value || '10:30',
      Hora_Salida_Obra:    document.getElementById('cfg-hora-salida-obra')?.value    || '17:00',
    };

    // Validar orden lógico
    const toMin = (h) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
    const min1 = toMin(payload.Hora_Entrada);
    const min2 = toMin(payload.Hora_Salida_Receso);
    const min3 = toMin(payload.Hora_Regreso_Receso);
    const min4 = toMin(payload.Hora_Salida_Obra);

    if (min2 <= min1) { Alerts.error('La salida a receso debe ser después de la entrada.');        return; }
    if (min3 <= min2) { Alerts.error('El regreso de receso debe ser después de la salida a receso.'); return; }
    if (min4 <= min3) { Alerts.error('La salida de obra debe ser después del regreso de receso.'); return; }

    const newConfig = { ...AppState.get('config'), ...payload };
    AppState.set('config', newConfig);
    localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));

    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando horarios...');
      try {
        await API.guardarConfiguracion(payload);
        loader.close();
        Alerts.success('Horarios guardados y sincronizados.');
      } catch (err) {
        loader.close();
        Alerts.warning('Guardado localmente. Error de sincronización: ' + err.message);
      }
    } else {
      Alerts.success('Horarios guardados localmente.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GPS Y GEOCERCAS
  // Fix #4: GPS_Radio_Metros se convierte a Number
  // Fix #5: GPS_Centro_Lat y GPS_Centro_Lon se convierten a float
  // ─────────────────────────────────────────────────────────────────────────
  async function _capturarUbicacionActual() {
    if (!GPS.isAvailable()) {
      Alerts.error('Geolocalización no soportada por este navegador.');
      return;
    }

    const statusEl    = document.getElementById('gps-status');
    const btnCapturar = document.getElementById('btn-capturar-ubicacion');

    if (btnCapturar) btnCapturar.disabled = true;
    if (statusEl) {
      statusEl.className   = 'gps-status info';
      statusEl.textContent = '📍 Obteniendo ubicación...';
      statusEl.style.display = 'block';
    }

    try {
      const position = await GPS.getCurrentPosition();
      _setInput('cfg-gps-centro-lat', position.latitude.toFixed(6));
      _setInput('cfg-gps-centro-lon', position.longitude.toFixed(6));

      if (statusEl) {
        statusEl.className   = 'gps-status success';
        statusEl.textContent = `✅ Ubicación capturada: ${GPS.formatCoordinates(position.latitude, position.longitude)} (±${Math.round(position.accuracy)}m)`;
      }
      Alerts.success('Ubicación capturada correctamente.');
    } catch (err) {
      if (statusEl) {
        statusEl.className   = 'gps-status error';
        statusEl.textContent = `❌ Error: ${err.message}`;
      }
      Alerts.error(err.message, 'Error de ubicación');
    } finally {
      if (btnCapturar) btnCapturar.disabled = false;
    }
  }

  async function _guardarConfigGPS() {
    const latRaw   = document.getElementById('cfg-gps-centro-lat')?.value || '';
    const lonRaw   = document.getElementById('cfg-gps-centro-lon')?.value || '';
    const radioRaw = document.getElementById('cfg-gps-radio')?.value      || '200';

    // Fix #4 y #5: conversión correcta de tipos antes de validar y guardar
    const payload = {
      GPS_Habilitado:         document.getElementById('cfg-gps-habilitado')?.checked ?? true,
      GPS_Requerir_Ubicacion: document.getElementById('cfg-gps-requerir')?.checked   ?? false,
      GPS_Centro_Lat:         latRaw   ? parseFloat(latRaw)   : null,  // float o null
      GPS_Centro_Lon:         lonRaw   ? parseFloat(lonRaw)   : null,  // float o null
      GPS_Radio_Metros:       parseInt(radioRaw, 10) || 200,           // number entero
    };

    // Validar con Validators centralizado
    const validation = Validators.validateConfigGPS(payload);
    if (!validation.valid) {
      const firstError = validation.errors[0];
      Alerts.error(firstError.error, 'Error de validación GPS');
      return;
    }

    const newConfig = { ...AppState.get('config'), ...payload };
    AppState.set('config', newConfig);
    localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));

    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando configuración GPS...');
      try {
        await API.guardarConfiguracion(payload);
        loader.close();
        Alerts.success('Configuración GPS guardada y sincronizada.');
      } catch (err) {
        loader.close();
        Alerts.warning('Guardado localmente. Error de sincronización: ' + err.message);
      }
    } else {
      Alerts.success('Configuración GPS guardada localmente.');
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
      Alerts.warning('El logo es mayor a 500 KB. Se comprimirá automáticamente.');
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
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
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
    if (preview)     { preview.src = src; preview.hidden = false; }
    if (placeholder) { placeholder.style.display = 'none'; }
  }

  async function _guardarLogo() {
    const logoSrc = _logoPendiente || AppState.get('config').Logo_Base64;

    if (!logoSrc) {
      Alerts.error('No hay logo para guardar. Sube una imagen primero.');
      return;
    }

    const newConfig = { ...AppState.get('config'), Logo_Base64: logoSrc };
    AppState.set('config', newConfig);
    localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));

    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando logo...');
      try {
        await API.guardarConfiguracion({ Logo_Base64: logoSrc });
        loader.close();
        Alerts.success('Logo guardado y sincronizado correctamente.');
      } catch (err) {
        loader.close();
        Alerts.warning('Logo guardado localmente. Error de sincronización: ' + err.message);
      }
    } else {
      Alerts.success('Logo guardado localmente.');
    }

    _logoPendiente = '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BACKUP
  // Fix #6: _importarBackup restaura también asistencias si el backup las incluye
  // ─────────────────────────────────────────────────────────────────────────
  function _exportarBackup() {
    const backup = {
      version:     APP_VERSION,
      fecha:       new Date().toISOString(),
      config:      AppState.get('config')      || DEFAULT_CONFIG,
      personal:    AppState.get('personal')    || [],
      asistencias: AppState.get('asistencias') || [],
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
      Alerts.error('El archivo debe ser un JSON de backup válido (.json).');
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
        if (typeof backup.config !== 'object' || Array.isArray(backup.config)) {
          Alerts.error('Estructura de backup inválida: "config" debe ser un objeto.');
          return;
        }

        // Resumen de lo que se va a restaurar
        const resumen = [
          `Fecha del backup: ${new Date(backup.fecha).toLocaleString('es-GT')}`,
          `Versión: ${backup.version}`,
          backup.personal?.length    ? `Trabajadores: ${backup.personal.length}`    : null,
          backup.asistencias?.length ? `Asistencias: ${backup.asistencias.length}`  : null,
        ].filter(Boolean).join('\n');

        const confirmed = await Alerts.confirm(
          `¿Restaurar datos del backup?\n\n${resumen}\n\nEsto sobreescribirá los datos actuales.`,
          'Restaurar Backup',
        );
        if (!confirmed) return;

        // Fix #6: restaurar config
        const newConfig = { ...DEFAULT_CONFIG, ...backup.config };
        localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));
        AppState.set('config', newConfig);

        // Fix #6: restaurar personal si existe
        if (Array.isArray(backup.personal) && backup.personal.length > 0) {
          localStorage.setItem(LS_KEYS.PERSONAL_CACHE, JSON.stringify(backup.personal));
          AppState.set('personal', backup.personal);
        }

        // Fix #6: restaurar asistencias si existen en el backup
        if (Array.isArray(backup.asistencias) && backup.asistencias.length > 0) {
          localStorage.setItem(LS_KEYS.ATTENDANCE_CACHE, JSON.stringify(backup.asistencias));
          AppState.set('asistencias', backup.asistencias);
        }

        // Recargar campos del formulario
        _cargarConfigLocal();

        const partes = ['Configuración'];
        if (Array.isArray(backup.personal)    && backup.personal.length > 0)    partes.push(`${backup.personal.length} trabajadores`);
        if (Array.isArray(backup.asistencias) && backup.asistencias.length > 0) partes.push(`${backup.asistencias.length} asistencias`);
        Alerts.success(`Backup restaurado: ${partes.join(', ')}.`);

      } catch (err) {
        Alerts.error('Error al leer el archivo de backup: ' + err.message);
      }
    };
    reader.readAsText(file);

    // Limpiar input para permitir re-importar el mismo archivo
    e.target.value = '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUDITORÍA ESCÁNER DE CAMPO
  // Fix #7: _limpiarAuditoriaScanner pide confirmación antes de borrar
  // ─────────────────────────────────────────────────────────────────────────
  function _mostrarAuditoriaScanner() {
    const output = document.getElementById('scanner-audit-output');
    const logEl  = document.getElementById('scanner-audit-log');
    if (!output || !logEl) return;

    try {
      const raw = localStorage.getItem('field_scanner_audit_log');
      const log = raw ? JSON.parse(raw) : [];
      if (!log.length) {
        logEl.textContent = 'Sin registros de auditoría.';
        output.hidden = false;
        return;
      }
      const esc   = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const lines = log.slice().reverse().slice(0, 50).map((entry) => {
        const when = new Date(entry.timestamp).toLocaleString('es-GT');
        return `[${esc(when)}] ${esc(entry.operator)} · ${esc(entry.device)}\n  ${esc(entry.workerName)} · ${esc(entry.tipo)} · ${esc(entry.status)}`;
      });
      logEl.textContent = lines.join('\n\n');
      output.hidden = false;
    } catch {
      logEl.textContent = 'No se pudo leer el log de auditoría.';
      output.hidden = false;
    }
  }

  /**
   * Fix #7: confirma antes de borrar el log de auditoría permanentemente.
   */
  async function _limpiarAuditoriaScanner() {
    const raw = localStorage.getItem('field_scanner_audit_log');
    const log = raw ? JSON.parse(raw) : [];
    if (!log.length) {
      Alerts.warning('No hay registros de auditoría para limpiar.');
      return;
    }

    const confirmed = await Alerts.confirm(
      `¿Eliminar permanentemente ${log.length} registro(s) de auditoría del escáner?\n\nEsta acción no se puede deshacer.`,
      'Limpiar Auditoría',
    );
    if (!confirmed) return;

    localStorage.removeItem('field_scanner_audit_log');
    const output = document.getElementById('scanner-audit-output');
    const logEl  = document.getElementById('scanner-audit-log');
    if (logEl)  logEl.textContent = '';
    if (output) output.hidden = true;
    Alerts.success('Registros de auditoría eliminados.');
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
      const rows    = log.map((entry) => {
        const when = new Date(entry.timestamp).toISOString();
        return [
          when,
          entry.operator  || '',
          entry.device    || '',
          entry.action    || '',
          entry.workerName || entry.workerId || '',
          entry.tipo      || '',
          entry.status    || '',
          entry.context   || '',
          entry.error     || '',
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
      });

      const csv  = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = `auditoria_scanner_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      Alerts.success('CSV de auditoría exportado correctamente.');
    } catch {
      Alerts.error('No se pudo exportar la auditoría.');
    }
  }

  function _compartirScannerWhatsApp() {
    try {
      const url     = window.location.origin + '/field-scanner.html';
      const mensaje = encodeURIComponent(
        'Escáner de Campo — Control Personal\n\n' +
        'Instalá la subaplicación de escaneo QR desde el siguiente link:\n' +
        url + '\n\n' +
        'PIN de acceso: consultá al administrador.',
      );
      window.open(`https://wa.me/?text=${mensaje}`, '_blank', 'noopener,noreferrer');
      Alerts.success('Se abrió WhatsApp para compartir el link.');
    } catch {
      Alerts.error('No se pudo abrir WhatsApp.');
    }
  }

  /**
   * Alterna un QR de instalación del escáner de campo para enseñarlo a la
   * cámara del dispositivo en campo (instalación sin escribir el link).
   */
  function _mostrarQrScannerInstalacion() {
    const url     = window.location.origin + '/field-scanner.html';
    const box     = document.getElementById('scanner-install-qr');
    const code    = document.getElementById('scanner-install-qr-code');
    const urlEl   = document.getElementById('scanner-install-url');

    if (!box || !code) {
      Alerts.error('No se encontró el espacio para el QR.');
      return;
    }

    if (!box.hidden) {
      box.hidden = true;
      return;
    }

    if (typeof window.QRCode === 'undefined' && typeof window.QRGenerator === 'undefined') {
      Alerts.error('El generador de QR aún no está disponible. Intenta de nuevo.');
      return;
    }

    try {
      code.innerHTML = '';

      if (window.QRGenerator && typeof window.QRGenerator.render === 'function') {
        window.QRGenerator.render(code, url, { size: 200 });
      } else if (window.QRCode) {
        new window.QRCode(code, {
          text:         url,
          width:        200,
          height:       200,
          colorDark:    '#003459',
          colorLight:   '#FFFFFF',
          correctLevel: window.QRCode.CorrectLevel.M,
        });
      }

      if (urlEl) urlEl.textContent = url;
      box.hidden = false;
    } catch (err) {
      console.error('[Ajustes] Error al generar el QR de instalación:', err);
      code.innerHTML = '';
      box.hidden = true;
      Alerts.error('No se pudo generar el QR de instalación.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORTACIÓN CSV — TRABAJADORES
  // ─────────────────────────────────────────────────────────────────────────
  function _exportarTrabajadoresCSV() {
    const personal = AppState.get('personal') || [];
    if (!personal.length) {
      Alerts.warning('No hay trabajadores para exportar.');
      return;
    }

    const headers = ['ID_Trabajador', 'Nombre_Completo', 'DPI_CUI', 'Puesto',
      'Jefe_Inmediato', 'Telefono', 'WhatsApp', 'Direccion', 'Estado', 'Fecha_Registro'];
    const q = (v) => `"${String(v || '').replace(/"/g, '""')}"`;

    const csvRows = [
      headers.join(','),
      ...personal.map((w) => [
        w.ID_Trabajador  || '',
        q(w.Nombre_Completo),
        w.DPI_CUI        || '',
        q(w.Puesto),
        q(w.Jefe_Inmediato),
        w.Telefono       || '',
        w.WhatsApp       || '',
        q(w.Direccion),
        w.Estado         || 'Activo',
        w.Fecha_Registro || '',
      ].join(',')),
    ];

    const filename = `trabajadores-${AppState.today()}.csv`;
    _descargarCSV(csvRows.join('\n'), filename);
    Alerts.success(`CSV "${filename}" descargado correctamente.`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORTACIÓN CSV — ASISTENCIAS
  // ─────────────────────────────────────────────────────────────────────────
  function _exportarAsistenciasCSV() {
    const asistencias = AppState.get('asistencias') || [];
    if (!asistencias.length) {
      Alerts.warning('No hay asistencias para exportar.');
      return;
    }

    const headers = ['ID_Marcacion', 'ID_Trabajador', 'Nombre_Trabajador', 'Fecha',
      'Tipo_Marcacion', 'Hora_Programada', 'Hora_Real', 'Estado_Marcacion',
      'Metodo_Registro', 'Horas_Extra', 'GPS_Latitud', 'GPS_Longitud'];
    const q = (v) => `"${String(v || '').replace(/"/g, '""')}"`;

    const csvRows = [
      headers.join(','),
      ...asistencias.map((a) => [
        a.ID_Marcacion    || a.ID_Asistencia || '',
        a.ID_Trabajador   || '',
        q(a.Nombre_Trabajador),
        a.Fecha           || '',
        q(a.Tipo_Marcacion),
        a.Hora_Programada || '',
        a.Hora_Real       || '',
        q(a.Estado_Marcacion),
        q(a.Metodo_Registro),
        a.Horas_Extra !== undefined ? a.Horas_Extra : '0',
        a.GPS_Latitud  || '',
        a.GPS_Longitud || '',
      ].join(',')),
    ];

    const filename = `asistencias-${AppState.today()}.csv`;
    _descargarCSV(csvRows.join('\n'), filename);
    Alerts.success(`CSV "${filename}" descargado correctamente.`);
  }

  /**
   * Helper: descarga un string CSV como archivo.
   * @param {string} csv  - Contenido CSV
   * @param {string} name - Nombre del archivo
   */
  function _descargarCSV(csv, name) {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURACIÓN SMTP
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Prueba la conexión SMTP con las credenciales proporcionadas
   */
  async function _probarConexionSMTP() {
    const host = document.getElementById('cfg-smtp-host')?.value?.trim();
    const port = document.getElementById('cfg-smtp-port')?.value?.trim();
    const user = document.getElementById('cfg-smtp-user')?.value?.trim();
    const password = document.getElementById('cfg-smtp-password')?.value;
    const secure = document.getElementById('cfg-smtp-secure')?.checked;

    // Validar campos requeridos
    if (!host || !port || !user || !password) {
      Alerts.error('Por favor completa todos los campos de configuración SMTP.');
      return;
    }

    // Validar puerto
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alerts.error('El puerto debe ser un número entre 1 y 65535.');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user)) {
      Alerts.error('El usuario debe ser una dirección de correo válida.');
      return;
    }

    const statusEl = document.getElementById('smtp-status');
    if (statusEl) {
      statusEl.className = 'gps-status info';
      statusEl.textContent = '📧 Probando conexión SMTP...';
      statusEl.style.display = 'block';
    }

    try {
      // Verificar si el usuario está autenticado en Firebase
      if (!window.FirebaseClient?.getCurrentUser()) {
        Alerts.error('Debes estar autenticado para probar la conexión SMTP.');
        if (statusEl) {
          statusEl.className = 'gps-status error';
          statusEl.textContent = '❌ Error: No autenticado';
        }
        return;
      }

      // Llamar a la Firebase Function para probar conexión
      const testFunction = window.firebase?.functions?.()?.httpsCallable?.('testSMTPConnection');
      if (!testFunction) {
        throw new Error('Firebase Functions no disponible');
      }

      const result = await testFunction({
        host,
        port,
        user,
        password,
        secure
      });

      if (result.data.success) {
        if (statusEl) {
          statusEl.className = 'gps-status success';
          statusEl.textContent = `✅ Conexión exitosa: ${user}`;
        }
        Alerts.success('Conexión SMTP establecida correctamente.');
      } else {
        throw new Error(result.data.message || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error al probar conexión SMTP:', error);
      if (statusEl) {
        statusEl.className = 'gps-status error';
        statusEl.textContent = `❌ Error: ${error.message}`;
      }
      Alerts.error(error.message, 'Error de conexión SMTP');
    }
  }

  /**
   * Guarda la configuración SMTP
   */
  async function _guardarConfigSMTP() {
    const host = document.getElementById('cfg-smtp-host')?.value?.trim();
    const port = document.getElementById('cfg-smtp-port')?.value?.trim();
    const user = document.getElementById('cfg-smtp-user')?.value?.trim();
    const password = document.getElementById('cfg-smtp-password')?.value;
    const from = document.getElementById('cfg-smtp-from')?.value?.trim() || user;
    const fromName = document.getElementById('cfg-smtp-from-name')?.value?.trim() || 'Control Personal Campo';
    const secure = document.getElementById('cfg-smtp-secure')?.checked;

    // Validar campos requeridos
    if (!host || !port || !user || !password) {
      Alerts.error('Por favor completa todos los campos de configuración SMTP.');
      return;
    }

    // Validar puerto
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Alerts.error('El puerto debe ser un número entre 1 y 65535.');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user)) {
      Alerts.error('El usuario debe ser una dirección de correo válida.');
      return;
    }

    if (from && !emailRegex.test(from)) {
      Alerts.error('La dirección de envío debe ser una dirección de correo válida.');
      return;
    }

    const smtpConfig = {
      host,
      port: portNum,
      user,
      password, // Guardamos la contraseña encriptada o como texto plano (nota: no ideal para producción)
      from,
      fromName,
      secure
    };

    // Guardar localmente
    const newConfig = { ...AppState.get('config'), SMTP_Config: smtpConfig };
    AppState.set('config', newConfig);
    localStorage.setItem(LS_KEYS.CONFIG, JSON.stringify(newConfig));

    // Sincronizar con Firestore si está conectado
    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando configuración SMTP...');
      try {
        await API.guardarConfiguracion({ SMTP_Config: smtpConfig });
        loader.close();
        Alerts.success('Configuración SMTP guardada y sincronizada con Firestore.');
      } catch (err) {
        loader.close();
        Alerts.warning('Guardado localmente. Error de sincronización: ' + err.message);
      }
    } else {
      Alerts.success('Configuración SMTP guardada localmente.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CICLO DE VIDA DEL MÓDULO
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Cargar módulo — llamado desde el router al navegar a #ajustes
   */
  async function cargar() {
    _cargarConfigLocal();
    if (window.ConnectionHub) window.ConnectionHub.cargar();

    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      try {
        await API.obtenerConfiguracion();
        _cargarConfigLocal();
      } catch (err) {
        console.warn('[Ajustes] No se pudo sincronizar configuración:', err.message);
      }
    }
  }

  function cleanup() {
    // Los event listeners están ligados al DOM de la sección;
    // al navegar a otra página el SPA oculta la sección sin destruirla,
    // por lo que no es necesario remover los listeners manualmente.
  }

  return { init, cargar, cleanup };
})();

// Exponer el módulo globalmente
window.ModuloAjustes = _ModuloAjustes;
