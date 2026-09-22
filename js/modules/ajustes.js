/**
 * CONTROL PERSONAL CAMPO — modules/ajustes.js
 * Módulo de configuración: Firestore, general, horarios, GPS, logo y backup.
 * @version 1.5.0
 *
 * Correcciones aplicadas:
 *  #1 _iniciarSesionFirebase — valida email/password vacíos antes del SDK
 *  #2 _conectarFirebase — desactiva botón durante conexión (anti-doble-clic)
 *  #3 _guardarGeneral — Nombre_Obra es campo requerido
 *  #4 _guardarConfigGPS — GPS_Radio_Metros se guarda como Number
 *  #5 _guardarConfigGPS — GPS_Centro_Lat/Lon se guardan como Float
 *  #6 _importarBackup — restaura asistencias del backup si existen
 *  #7 _limpiarAuditoriaScanner — pide confirmación antes de borrar
 *  #8 _iniciarSesionFirebase — llama a _actualizarEstadoConexion tras login
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
    const btnFirebase    = document.getElementById('btn-connect-firebase');
    const btnLocal       = document.getElementById('btn-use-local');
    const btnLogin       = document.getElementById('btn-login-firebase');
    const btnLoginGoogle = document.getElementById('btn-login-google');
    const btnLogout      = document.getElementById('btn-logout-firebase');
    const btnGasAssistant = document.getElementById('btn-open-gas-assistant');

    if (btnLogin)        btnLogin.addEventListener('click', _iniciarSesionFirebase);
    if (btnLoginGoogle)  btnLoginGoogle.addEventListener('click', _iniciarSesionGoogle);
    if (btnLogout)       btnLogout.addEventListener('click', _cerrarSesionFirebase);
    const formAuth = document.getElementById('form-firebase-auth');
    if (formAuth) {
      formAuth.addEventListener('submit', (e) => {
        e.preventDefault();
        _iniciarSesionFirebase();
      });
    }
    if (btnFirebase)     btnFirebase.addEventListener('click', _conectarFirebase);
    if (btnLocal)        btnLocal.addEventListener('click', _usarModoLocal);
    if (btnGasAssistant) btnGasAssistant.addEventListener('click', () => {
      if (window.GasAssistant) {
        window.GasAssistant.open();
      } else {
        Alerts.error('Módulo de asistente GAS no disponible', 'Error');
      }
    });

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
  // CARGAR CONFIGURACIÓN LOCAL
  // ─────────────────────────────────────────────────────────────────────────
  function _cargarConfigLocal() {
    const config   = AppState.get('config') || DEFAULT_CONFIG;
    const fbConfig = FirebaseClient.getConfig();

    // Credenciales Firebase
    _setInput('firebase-project-id',  fbConfig.projectId);
    _setInput('firebase-api-key',     fbConfig.apiKey);
    _setInput('firebase-auth-domain', fbConfig.authDomain);
    _setInput('firebase-app-id',      fbConfig.appId);

    // General
    _setInput('cfg-nombre-obra',  config.Nombre_Obra);
    _setInput('cfg-encargado',    config.Encargado);
    _setInput('cfg-tolerancia',   config.Tolerancia_Minutos);

    // Horarios
    _setInput('cfg-hora-entrada',        config.Hora_Entrada        || '07:00');
    _setInput('cfg-hora-salida-receso',  config.Hora_Salida_Receso  || '10:00');
    _setInput('cfg-hora-regreso-receso', config.Hora_Regreso_Receso || '10:30');
    _setInput('cfg-hora-salida-obra',    config.Hora_Salida_Obra    || '17:00');

    // GPS
    _setCheckbox('cfg-gps-habilitado', config.GPS_Habilitado !== false);
    _setCheckbox('cfg-gps-requerir',   config.GPS_Requerir_Ubicacion === true);
    _setInput('cfg-gps-centro-lat', config.GPS_Centro_Lat);
    _setInput('cfg-gps-centro-lon', config.GPS_Centro_Lon);
    _setInput('cfg-gps-radio',      config.GPS_Radio_Metros || 200);

    // Logo
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
  // CONEXIÓN FIREBASE — Botón "Conectar Firestore"
  // Fix #2: desactiva el botón durante la operación async para evitar doble clic
  // ─────────────────────────────────────────────────────────────────────────
  async function _conectarFirebase() {
    const btn = document.getElementById('btn-connect-firebase');
    const statusEl = document.getElementById('connection-status-detail');

    // Fix #2: bloquear botón mientras conecta
    if (btn) btn.disabled = true;

    const config = {
      ...FirebaseClient.getConfig(),
      projectId:  document.getElementById('firebase-project-id')?.value.trim(),
      apiKey:     document.getElementById('firebase-api-key')?.value.trim(),
      authDomain: document.getElementById('firebase-auth-domain')?.value.trim(),
      appId:      document.getElementById('firebase-app-id')?.value.trim(),
    };

    // Validar configuración antes de intentar conexión
    const validation = window.validateFirebaseConfig
      ? window.validateFirebaseConfig(config)
      : { valid: true };
    if (!validation.valid) {
      Alerts.error(validation.error || 'Completa ID del proyecto, API Key, dominio de autenticación y App ID.');
      if (btn) btn.disabled = false;
      return;
    }

    if (!FirebaseClient.isConfigured(config)) {
      Alerts.error('Completa ID del proyecto, API Key, dominio de autenticación y App ID.');
      if (btn) btn.disabled = false;
      return;
    }

    if (statusEl) statusEl.textContent = '⏳ Conectando con Firestore…';

    try {
      const result = await FirebaseClient.configure(config);
      if (result.success) {
        // El estado de conexión no se fuerza: lo dicta FirebaseClient
        // (onAuthStateChanged + health check). Forzarlo aquí mostraba
        // "Firestore en línea" sin sesión, cuando las reglas deniegan escrituras.
        _sincronizarEstadoConexion();
        _actualizarEstadoConexion();
        if (AppState.get('connected')) {
          Alerts.success('Firestore conectado y sincronización en tiempo real activa.');
          // Cargar datos iniciales desde Firestore en background
          API.obtenerPersonal().catch((err) => console.warn('[Ajustes] Error cargando personal tras conexión:', err.message));
          API.obtenerConfiguracion().catch((err) => console.warn('[Ajustes] Error cargando config tras conexión:', err.message));
        } else {
          Alerts.info('Configuración aceptada. Inicia sesión para escribir en Firestore; mientras tanto la app trabaja en modo local.');
        }
      } else {
        AppState.set('backendMode', 'local');
        AppState.set('connected', false);
        if (statusEl) {
          statusEl.className = 'connection-status-detail error';
          statusEl.textContent = `❌ ${result.error || 'No se pudo conectar.'}`;
        }
        Alerts.error(result.error || 'No se pudo conectar con Firestore.');
      }
    } catch (error) {
      AppState.set('backendMode', 'local');
      AppState.set('connected', false);
      if (statusEl) {
        statusEl.className = 'connection-status-detail error';
        statusEl.textContent = `❌ Error: ${error.message}`;
      }
      Alerts.error('Error al conectar con Firestore: ' + error.message);
    } finally {
      // Fix #2: reactivar botón siempre
      if (btn) btn.disabled = false;
    }
  }

  function _usarModoLocal() {
    if (typeof window._teardownRealtimeSubscriptions === 'function') {
      window._teardownRealtimeSubscriptions();
    }
    FirebaseClient.stop();
    AppState.set('backendMode', 'local');
    AppState.set('connected', false);
    const statusEl = document.getElementById('connection-status-detail');
    if (statusEl) {
      statusEl.className = 'connection-status-detail';
      statusEl.textContent = '💾 Modo local activo en este dispositivo.';
    }
    Alerts.success('Modo local activado. Tus datos se conservarán en este dispositivo.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SESIÓN FIREBASE — Botón "Iniciar sesión segura"
  // Fix #1: valida email/password vacíos antes de llamar al SDK
  // Fix #8: llama a _actualizarEstadoConexion() tras login exitoso
  // ─────────────────────────────────────────────────────────────────────────
  async function _iniciarSesionFirebase() {
    const email    = document.getElementById('firebase-auth-email')?.value.trim();
    const password = document.getElementById('firebase-auth-password')?.value || '';
    const statusEl = document.getElementById('connection-status-detail');
    const btnLogin = document.getElementById('btn-login-firebase');

    // Fix #1: validar campos vacíos con mensajes en español antes del SDK
    if (!email) {
      Alerts.error('El correo electrónico es obligatorio.');
      document.getElementById('firebase-auth-email')?.focus();
      return;
    }
    if (!password) {
      Alerts.error('La contraseña es obligatoria.');
      document.getElementById('firebase-auth-password')?.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alerts.error('El correo electrónico no tiene un formato válido.');
      document.getElementById('firebase-auth-email')?.focus();
      return;
    }

    // Deshabilitar botón durante autenticación (anti-doble-clic)
    if (btnLogin) btnLogin.disabled = true;
    if (statusEl) statusEl.textContent = '⏳ Autenticando…';

    try {
      const result = await FirebaseClient.signInWithEmail(email, password);
      if (!result.success) throw new Error(result.error || 'Credenciales rechazadas.');

      // Limpiar contraseña del DOM inmediatamente por seguridad
      const pwdInput = document.getElementById('firebase-auth-password');
      if (pwdInput) pwdInput.value = '';

      AppState.set('connected', true);
      AppState.set('backendMode', 'firestore');

      // Fix #8: usar _actualizarEstadoAuth Y _actualizarEstadoConexion centralizado
      _actualizarEstadoAuth();
      _actualizarEstadoConexion();
      // Verificar conexión y cargar datos
      await API.ping();
      // API.ping() → checkHealth() confirma el estado real; se refleja en el store.
      _sincronizarEstadoConexion();
      _actualizarEstadoConexion();
      await Promise.all([API.obtenerPersonal(), API.obtenerConfiguracion()]);

      Alerts.success('Sesión persistente de Firestore iniciada.');
    } catch (error) {
      AppState.set('connected', false);
      // Traducir errores comunes de Firebase Auth al español
      const msg = _traducirErrorAuth(error.message || error.code || '');
      if (statusEl) {
        statusEl.className = 'connection-status-detail error';
        statusEl.textContent = `❌ ${msg}`;
      }
      Alerts.error(msg, 'Error de autenticación');
    } finally {
      if (btnLogin) btnLogin.disabled = false;
    }
  }

  /**
   * Traduce los mensajes de error de Firebase Auth al español.
   * @param {string} msg - Mensaje de error del SDK
   * @returns {string} Mensaje en español
   */
  function _traducirErrorAuth(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('popup-closed-by-user') || lower.includes('popup closed') || lower.includes('cancelled-popup')) {
      return 'Autenticación cancelada.';
    }
    if (lower.includes('popup-blocked')) {
      return 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.';
    }
    if (lower.includes('account-exists-with-different-credential') || lower.includes('account exists with different')) {
      return 'Ya existe una cuenta con ese correo. Inicia sesión con "Iniciar sesión segura" (correo y contraseña) o vincula la cuenta en Firebase Console.';
    }
    if (lower.includes('user-not-found') || lower.includes('no user record') || lower.includes('email not found'))
      return 'No existe una cuenta con ese correo electrónico en Firebase Auth.';
    if (lower.includes('wrong-password') || lower.includes('invalid-password'))
      return 'Contraseña incorrecta. Verifica tus credenciales.';
    if (lower.includes('invalid-credential') || lower.includes('invalid credential'))
      return 'Correo o contraseña no válidos. La cuenta debe existir como operador en Firebase Auth (crea la del administrador con scripts/setup-operator-account.js) o usa "Ingresar con Google".';
    if (lower.includes('too-many-requests') || lower.includes('too many'))
      return 'Demasiados intentos fallidos. Espera unos minutos antes de intentarlo de nuevo.';
    if (lower.includes('user-disabled'))
      return 'Esta cuenta ha sido desactivada. Contacta al administrador.';
    if (lower.includes('network') || lower.includes('unavailable'))
      return 'Sin conexión a internet. Verifica tu red e inténtalo de nuevo.';
    if (lower.includes('invalid-email'))
      return 'El formato del correo electrónico no es válido.';
    if (lower.includes('email-already-in-use'))
      return 'Ya existe una cuenta con este correo electrónico.';
    // Mensaje genérico si no se reconoce el error
    return 'No se pudo iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.';
  }

  /**
   * Inicio de sesión con cuenta de Google (OAuth popup). Google valida el
   * correo/contraseña real del usuario, por lo que NO necesita estar registrado
   * como usuario email/password en Firebase Auth (solo el proveedor "Google"
   * habilitado en Firebase Console → Authentication → Sign-in method).
   */
  async function _iniciarSesionGoogle() {
    const statusEl = document.getElementById('connection-status-detail');
    const btnGoogle = document.getElementById('btn-login-google');

    if (btnGoogle) btnGoogle.disabled = true;
    if (statusEl) statusEl.textContent = '⏳ Esperando autenticación de Google…';

    try {
      const result = await FirebaseClient.signInWithGoogle();
      if (!result.success) {
        const code = (result.code || '').toLowerCase();
        if (code.includes('cancelled')) {
          if (statusEl) statusEl.textContent = '⏸ Autenticación con Google cancelada.';
          return;
        }
        AppState.set('connected', false);
        const msg = _traducirErrorAuth(result.code || result.error || '');
        if (statusEl) {
          statusEl.className = 'connection-status-detail error';
          statusEl.textContent = `❌ ${msg}`;
        }
        Alerts.error(msg, 'Error de autenticación');
        return;
      }

      AppState.set('connected', true);
      AppState.set('backendMode', 'firestore');
      _actualizarEstadoAuth();
      _actualizarEstadoConexion();
      await API.ping();
      _sincronizarEstadoConexion();
      _actualizarEstadoConexion();
      await Promise.all([API.obtenerPersonal(), API.obtenerConfiguracion()]);
      Alerts.success('Sesión de Google iniciada.');
    } catch (error) {
      AppState.set('connected', false);
      const msg = _traducirErrorAuth(error.message || error.code || '');
      if (statusEl) {
        statusEl.className = 'connection-status-detail error';
        statusEl.textContent = `❌ ${msg}`;
      }
      Alerts.error(msg, 'Error de autenticación');
    } finally {
      if (btnGoogle) btnGoogle.disabled = false;
    }
  }

  /**
   * Sincroniza el store (AppState) con el estado real del cliente Firebase.
   *
   * Única fuente de verdad: FirebaseClient.getConnectionState(). Evita que la UI
   * muestre "Firestore en línea" mientras las reglas siguen denegando escrituras
   * (p. ej. tras conectar sin haber iniciado sesión).
   * @returns {void}
   */
  function _sincronizarEstadoConexion() {
    const state  = FirebaseClient.getConnectionState ? FirebaseClient.getConnectionState() : 'idle';
    const online = state === 'connected' || state === 'degraded';
    AppState.set('backendMode', online ? 'firestore' : 'local');
    AppState.set('connected', online);
  }

  async function _cerrarSesionFirebase() {
    const btnLogout = document.getElementById('btn-logout-firebase');
    if (btnLogout) btnLogout.disabled = true;

    try {
      await FirebaseClient.signOut();
      _sincronizarEstadoConexion();
      _actualizarEstadoAuth();
      const statusEl = document.getElementById('connection-status-detail');
      if (statusEl) {
        statusEl.className = 'connection-status-detail';
        statusEl.textContent = '💾 Sesión cerrada; modo local activo.';
      }
    } finally {
      if (btnLogout) btnLogout.disabled = false;
    }
  }

  /**
   * Actualiza la visibilidad de los botones login/logout según el usuario activo.
   */
  function _actualizarEstadoAuth() {
    const user   = FirebaseClient.getCurrentUser?.();
    const login  = document.getElementById('btn-login-firebase');
    const loginGoogle = document.getElementById('btn-login-google');
    const logout = document.getElementById('btn-logout-firebase');
    const email  = document.getElementById('firebase-auth-email');
    if (login)        login.hidden        = Boolean(user);
    if (loginGoogle)  loginGoogle.hidden  = Boolean(user);
    if (logout)       logout.hidden       = !user;
    if (email && user?.email) email.value = user.email;
  }

  /**
   * Actualiza el indicador de estado de conexión.
   * Refleja el estado real: sesión activa, conectado, configurado, o modo local.
   */
  function _actualizarEstadoConexion() {
    const statusEl = document.getElementById('connection-status-detail');
    if (!statusEl) return;

    const mode         = AppState.get('backendMode');
    const connected    = AppState.get('connected');
    const user         = FirebaseClient.getCurrentUser?.();
    const config       = FirebaseClient.getConfig();
    const isConfigured = FirebaseClient.isConfigured ? FirebaseClient.isConfigured(config) : false;

    if (mode === 'firestore' && connected && user) {
      statusEl.className   = 'connection-status-detail success';
      statusEl.textContent = `✅ Sesión activa: ${user.email || 'usuario'} — proyecto: ${config.projectId}`;
    } else if (mode === 'firestore' && connected) {
      statusEl.className   = 'connection-status-detail success';
      statusEl.textContent = `✅ Firestore conectado: ${config.projectId}`;
    } else if (isConfigured) {
      statusEl.className   = 'connection-status-detail';
      statusEl.textContent = `🔌 Configuración cargada (${config.projectId}) — pulse "Iniciar sesión" para conectar`;
    } else {
      statusEl.className   = 'connection-status-detail';
      statusEl.textContent = '💾 Modo local activo en este dispositivo';
    }
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
  // CICLO DE VIDA DEL MÓDULO
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Cargar módulo — llamado desde el router al navegar a #ajustes
   */
  async function cargar() {
    _cargarConfigLocal();
    _actualizarEstadoAuth();
    _actualizarEstadoConexion();

    // Si hay conexión activa, sincronizar configuración desde Firestore
    if (AppState.get('backendMode') === 'firestore' && AppState.get('connected')) {
      try {
        await API.obtenerConfiguracion();
        _cargarConfigLocal(); // Re-poblar formulario con datos remotos actualizados
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
