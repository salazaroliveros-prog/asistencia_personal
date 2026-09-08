/**
 * CONTROL PERSONAL CAMPO — modules/ajustes.js
 * Módulo de configuración: URL GAS, general, horarios, logo y backup.
 * @version 1.0.0
 */

const ModuloAjustes = (() => {

  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _cargarConfigLocal();
  }

  function _bindEvents() {
    // ─── Conexión GAS ──────────────────────────────────────────────────
    const btnTestConn = document.getElementById('btn-test-connection');
    const btnSaveUrl  = document.getElementById('btn-save-url');

    if (btnTestConn) btnTestConn.addEventListener('click', _testConexion);
    if (btnSaveUrl)  btnSaveUrl.addEventListener('click', _guardarURL);

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
    const gasUrl = AppState.get('gasUrl');
    const config = AppState.get('config') || DEFAULT_CONFIG;

    // URL de GAS
    const urlInput = document.getElementById('gas-url');
    if (urlInput) urlInput.value = gasUrl || '';

    // General
    _setInput('cfg-nombre-obra', config.Nombre_Obra);
    _setInput('cfg-encargado',   config.Encargado);
    _setInput('cfg-tolerancia',  config.Tolerancia_Minutos);

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

  // ─────────────────────────────────────────────────────────────────────────
  // CONEXIÓN GOOGLE APPS SCRIPT
  // ─────────────────────────────────────────────────────────────────────────
  async function _testConexion() {
    const urlInput = document.getElementById('gas-url');
    const url      = urlInput?.value.trim();

    console.log('[Ajustes] _testConexion inicio', { url, stored: AppState.get('gasUrl') });

    if (!url) {
      Alerts.error('Ingresa la URL de tu Web App de Google Apps Script.');
      return;
    }

    if (!url.startsWith('https://script.google.com/macros/s/')) {
      Alerts.warning('La URL no parece ser válida. Debe comenzar con:\nhttps://script.google.com/macros/s/');
    }

    AppState.set('gasUrl', url);

    const statusEl = document.getElementById('connection-status-detail');
    const btnTest  = document.getElementById('btn-test-connection');
    if (btnTest) btnTest.disabled = true;

    if (statusEl) {
      statusEl.className = 'connection-status-detail';
      statusEl.textContent = '⏳ Probando conexión...';
      statusEl.style.display = 'block';
      statusEl.style.background = 'rgba(0,168,232,0.1)';
      statusEl.style.border = '1px solid rgba(0,168,232,0.3)';
      statusEl.style.color = 'var(--color-secondary)';
    }

    try {
      console.log('[Ajustes] Llamando API.ping desde', typeof window !== 'undefined' ? window.location.hostname : 'server');
      const result = await API.ping();
      console.log('[Ajustes] API.ping resultado', result);

      if (result.success) {
        if (statusEl) {
          statusEl.className = 'connection-status-detail success';
          statusEl.textContent = `✅ Conexión exitosa — ${result.message || 'API activa'} (${new Date().toLocaleTimeString('es-GT')})`;
        }
        Alerts.success('Conexión con Google Sheets establecida correctamente', 'Conexión exitosa');
      } else {
        if (statusEl) {
          statusEl.className = 'connection-status-detail error';
          statusEl.textContent = `❌ Error: ${result.error || 'Respuesta inesperada del servidor'}`;
        }
        console.warn('[Ajustes] Ping fallido', result);
      }
    } catch (err) {
      console.warn('[Ajustes] Error en prueba de conexión', err);
      if (statusEl) {
        statusEl.className = 'connection-status-detail error';
        statusEl.textContent = `❌ Error de conexión: ${err.message}`;
      }
      Alerts.error(err.message, 'Sin conexión');
    } finally {
      if (btnTest) btnTest.disabled = false;
    }
  }

  async function _guardarURL() {
    const url = document.getElementById('gas-url')?.value.trim();

    if (!url) {
      Alerts.error('Ingresa una URL válida.');
      return;
    }

    localStorage.setItem(LS_KEYS.GAS_URL, url);
    AppState.set('gasUrl', url);

    Alerts.success('URL guardada correctamente. Ahora prueba la conexión.');
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

    // Sincronizar con GAS si hay conexión
    if (AppState.get('gasUrl') && AppState.get('connected')) {
      const loader = Alerts.loading('Guardando en Google Sheets...');
      try {
        await API.guardarConfiguracion(payload);
        loader.close();
        Alerts.success('Configuración general guardada y sincronizada con Google Sheets');
      } catch (err) {
        loader.close();
        Alerts.warning('Guardado localmente. No se pudo sincronizar con Google Sheets: ' + err.message);
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

    if (AppState.get('gasUrl') && AppState.get('connected')) {
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

    if (AppState.get('gasUrl') && AppState.get('connected')) {
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
      gasUrl:    AppState.get('gasUrl') || '',
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
        if (backup.gasUrl) {
          localStorage.setItem(LS_KEYS.GAS_URL, backup.gasUrl);
          AppState.set('gasUrl', backup.gasUrl);
        }

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
    if (AppState.get('gasUrl') && AppState.get('connected')) {
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
    if (AppState.get('gasUrl') && AppState.get('connected')) {
      try {
        await API.obtenerConfiguracion();
        _cargarConfigLocal(); // Re-llenar con datos actualizados
      } catch (err) {
        console.warn('[Ajustes] No se pudo sincronizar configuración:', err.message);
      }
    }
  }

  return { init, cargar };
})();
