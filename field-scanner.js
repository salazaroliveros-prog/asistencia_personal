/**
 * CONTROL PERSONAL CAMPO — field-scanner.js
 * Sub-aplicación independiente para escaneo de QR en campo.
 * Envía marcaciones a Firestore en tiempo real.
 *
 * Login: email + password (Firebase Auth signInWithEmailAndPassword)
 * Reemplaza el login anterior con Google OAuth que requería popup.
 *
 * Requisitos de la cuenta operadora (deben cumplirse los dos):
 *   1. El correo debe estar VERIFICADO (`emailVerified === true`), porque
 *      `firestore.rules` → `isAuthorizedOperator()` exige
 *      `request.auth.token.email_verified == true` para escribir en
 *      `asistencias`. Si falta este requisito el login parece correcto pero
 *      toda marcación falla con `permission-denied`.
 *   2. (Opcional) Si `AUTHORIZED_OPERATOR_EMAILS` está vacío (por defecto)
 *      se permite ANY usuario verificado. Para restringir a un operador
 *      concreto añade su email a la lista.
 *
 * @version 2.3.0
 */

(() => {
  'use strict';

      
  // ─── Estado ─────────────────────────────────────────────────────────────
  let _statusTimer   = null;
  let _qrController  = null;
  let _scannerActive = false;
  let _facingMode    = 'environment';
  let _currentWorker = null;
  let _marking       = false;
  let _audio         = null;
  let _db            = null;
  let _auth          = null;
  let _unsubscribe   = null;
  let _deferredInstallPrompt = null;

  // Email(es) autorizados. La lista [] = modo ABIERTO: cualquier cuenta con
  // email válido puede operar (las escrituras exigen email verificado en
  // firestore.rules). Añade emails a la lista para restringir el acceso.
  const AUTHORIZED_OPERATOR_EMAILS = [];

  // Clave de localStorage para no volver a ofrecer instalar la PWA tras el cierre.
  const FS_PWA_DISMISS_KEY = 'cpc_fs_pwa_install_dismissed';

  // Exigir correo verificado (`emailVerified`) para operar el escáner.
  //
  // false (por defecto): basta una cuenta válida de Firebase Auth. Es lo que
  //   necesitan las cuentas creadas a mano en Firebase Console, que NO llegan
  //   verificadas; con `true` el login se rechaza y parece "no me deja entrar".
  // true: modo estricto; obliga a que el operador abra el enlace de
  //   verificación antes de poder marcar.
  //
  // Si se activa, `firestore.rules → isAuthorizedOperator()` debe exigir
  // también `request.auth.token.email_verified == true`.
  //
  // Se declara con `let` para que los tests puedan alternar ambos modos con
  // `window.FieldScanner.__setRequireVerifiedEmail(true|false)`.
  let REQUIRE_VERIFIED_EMAIL = false;

  const MARK_TYPES = [
    { tipo: 'Entrada',        cls: 'campo-mark-entry',  icono: 'log-in',          horaKey: 'Hora_Entrada',        fallback: '07:00' },
    { tipo: 'Salida_Receso',  cls: 'campo-mark-break',  icono: 'coffee',           horaKey: 'Hora_Salida_Receso',  fallback: '10:00' },
    { tipo: 'Regreso_Receso', cls: 'campo-mark-resume', icono: 'arrow-left-right', horaKey: 'Hora_Regreso_Receso', fallback: '10:30' },
    { tipo: 'Salida_Obra',    cls: 'campo-mark-exit',   icono: 'log-out',          horaKey: 'Hora_Salida_Obra',    fallback: '17:00' },
  ];

  // ─── Estado de autenticación ──────────────────────────────────────────────
  // Recuerda el email del último login para autoguardarlo en el formulario.
  function _saveCredentials(email) {
    try { localStorage.setItem('cpc_scanner_email', String(email || '')); } catch (_) { /* modo privado: ignorar fallos de storage */ }
  }
  function _getSavedEmail() {
    try { return localStorage.getItem('cpc_scanner_email') || ''; } catch (_) { return ''; }
  }
  function _clearCredentials() {
    try { localStorage.removeItem('cpc_scanner_email'); } catch (_) { /* modo privado: ignorar fallos de storage */ }
  }

  // ─── Inicialización ──────────────────────────────────────────────────────
  async function init() {
    _bindEvents();
    _initAudio();
    _renderMarkButtons();
    _updateStatusPill(false);
    _updateConnBadge(navigator.onLine);
    _initPwaInstall();
    lucide?.createIcons?.();

    // Escuchar cambios de conexión para actualizar el badge
    window.addEventListener('online',  () => _updateConnBadge(true));
    window.addEventListener('offline', () => _updateConnBadge(false));

    // Pre-llenar el email del último login para acelerar el acceso
    const savedEmail = _getSavedEmail();
    const emailInput = document.getElementById('login-email');
    if (savedEmail && emailInput) emailInput.value = savedEmail;

    await _initFirebase();

    // Si Firebase cargó: observar sesión activa (cookie Auth persistida).
    // Auth usa localStorage/SameSite cookies por defecto, así que al recargar
    // la app con el mismo navegador el usuario vuelve sin repetir login.
    if (_auth) {
      _auth.onAuthStateChanged(async (user) => {
        if (!user) { _showLogin(); return; }

        const session = _validateSession(user);
        if (session.ok) { await _onLoginSuccess(user); return; }

        // Sesión no válida: se cierra siempre para no dejar una sesión a medias
        // que leería datos pero fallaría al escribir.
        await _auth.signOut();
        _showLogin();
        _showGlobalError(
          session.reason === 'unverified'
            ? VERIFY_EMAIL_MESSAGE
            : 'Esta cuenta no está autorizada para operar el escáner.',
        );
      });
    } else {
      _showLogin();
    }
  }

  // ─── Helpers de UI de login ──────────────────────────────────────────────

  function _showLogin() {
    const loginSection = document.getElementById('login-section');
    const app          = document.getElementById('app');
    if (loginSection) loginSection.hidden = false;
    if (app)          app.hidden = true;
    _clearLoginErrors();
    if (_scannerActive) _stopScanner();
    if (_unsubscribe)  { _unsubscribe(); _unsubscribe = null; }
  }

  async function _onLoginSuccess(user) {
    const loginSection = document.getElementById('login-section');
    const app          = document.getElementById('app');
    if (loginSection) loginSection.hidden = true;
    if (app)          app.hidden = false;

    // Mostrar chip de usuario en el header
    _renderUserChip(user);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.hidden = false;

    _renderFeed([]);
    _subscribeRealtime();

    setTimeout(() => { if (!_scannerActive) _startScanner(); }, 350);
  }

  /**
   * Comprueba que la cuenta pueda operar el escáner.
   *
   * `AUTHORIZED_OPERATOR_EMAILS` vacío = modo ABIERTO: cualquier cuenta con
   * email válido puede operar (las escrituras siguen exigiendo
   * `email_verified == true` en `firestore.rules`). Con la lista poblada solo
   * esos correos pueden operar.
   *
   * @param {Object} user - Usuario de Firebase Auth
   * @returns {boolean}
   */
  function _isAuthorizedUser(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    // Sin usuario o sin email no hay nada que autorizar.
    if (!email.includes('@')) return false;
    if (AUTHORIZED_OPERATOR_EMAILS.length === 0) return true;
    return AUTHORIZED_OPERATOR_EMAILS.some((e) => e.toLowerCase() === email);
  }

  /**
   * Comprueba que el correo esté verificado.
   *
   * `firestore.rules` exige `email_verified == true` en `isAuthorizedOperator()`
   * para permitir escrituras en `asistencias`. Sin este control el login daba
   * por buena la sesión y luego TODAS las marcaciones fallaban con
   * `permission-denied`, mostrando un genérico "No se pudo registrar la marca".
   *
   * @param {Object} user - Usuario de Firebase Auth
   * @returns {boolean}
   */
  function _isEmailVerified(user) {
    return user?.emailVerified === true;
  }

  /** Mensaje mostrado cuando la cuenta existe pero el correo no está verificado. */
  const VERIFY_EMAIL_MESSAGE =
    'Tu correo aún no está verificado. Abre el enlace de verificación que enviamos '
    + 'a tu bandeja de entrada (revisa también spam) y vuelve a intentarlo.';

  /**
   * Valida la sesión completa: cuenta autorizada Y (opcional) correo verificado.
   *
   * Con `REQUIRE_VERIFIED_EMAIL === false` una cuenta válida sin verificar puede
   * operar; esto evita el falso "no me deja entrar" de las cuentas creadas desde
   * la consola, que nunca llegan verificadas.
   *
   * @param {Object} user - Usuario de Firebase Auth
   * @returns {{ ok: boolean, reason?: 'unauthorized'|'unverified' }}
   */
  function _validateSession(user) {
    if (!_isAuthorizedUser(user)) return { ok: false, reason: 'unauthorized' };
    if (REQUIRE_VERIFIED_EMAIL && !_isEmailVerified(user)) {
      return { ok: false, reason: 'unverified' };
    }
    return { ok: true };
  }

  /** Muestra el chip de usuario con iniciales y email */
  function _renderUserChip(user) {
    const chip   = document.getElementById('scanner-user-chip');
    const avatar = document.getElementById('scanner-user-avatar');
    const email  = document.getElementById('scanner-user-email');
    if (!chip) return;
    const emailStr = user?.email || '';
    const initials = emailStr.split('@')[0].slice(0, 2).toUpperCase() || '??';
    if (avatar) avatar.textContent = initials;
    if (email)  email.textContent  = emailStr;
    chip.hidden = false;
  }

  /** Muestra una sección que viene oculta en el HTML con el atributo `hidden`. */
  function _mostrarSeccion(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  }

  /** Actualiza el badge de conexión en la pantalla de login */
  function _updateConnBadge(online) {
    const badge = document.getElementById('login-conn-badge');
    const text  = document.getElementById('login-conn-text');
    if (!badge) return;
    badge.classList.toggle('online', online);
    if (text) text.textContent = online ? 'En línea' : 'Sin conexión';
  }

  // ─── Gestión de errores del formulario ───────────────────────────────────

  function _clearLoginErrors() {
    ['login-email', 'login-password'].forEach((id) => {
      const errEl = document.getElementById(id + '-error');
      const inp   = document.getElementById(id);
      if (errEl) errEl.hidden = true;
      if (inp)   inp.classList.remove('input-error');
    });
    const globalErr = document.getElementById('login-global-error');
    if (globalErr) globalErr.hidden = true;
  }

  function _showFieldError(fieldId, message) {
    const errEl  = document.getElementById(fieldId + '-error');
    const msgEl  = document.getElementById(fieldId + '-error-msg');
    const inp    = document.getElementById(fieldId);
    if (errEl)  errEl.hidden = false;
    if (msgEl)  msgEl.textContent = message;
    if (inp) {
      inp.classList.add('input-error');
      inp.focus();
    }
  }

  function _showGlobalError(message) {
    const errEl = document.getElementById('login-global-error');
    const msgEl = document.getElementById('login-global-error-msg');
    if (errEl) errEl.hidden = false;
    if (msgEl) msgEl.textContent = message;
  }

  /** Traduce los errores de Firebase Auth al español */
  function _traducirErrorAuth(errorCode = '', message = '') {
    const code = String(errorCode).toLowerCase();
    const msg  = String(message).toLowerCase();
    if (code.includes('user-not-found') || msg.includes('no user record'))
      return 'No existe ninguna cuenta con ese correo electrónico.';
    if (code.includes('wrong-password') || code.includes('invalid-credential') || msg.includes('invalid credential') || msg.includes('invalid login'))
      return 'Correo o contraseña incorrectos. Verifica tus credenciales.';
    if (code.includes('too-many-requests') || msg.includes('too many'))
      return 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde.';
    if (code.includes('user-disabled'))
      return 'Esta cuenta ha sido desactivada. Contacta al administrador.';
    if (code.includes('network') || msg.includes('network') || msg.includes('unavailable'))
      return 'Sin conexión a internet. Verifica tu red e inténtalo de nuevo.';
    if (code.includes('invalid-email'))
      return 'El correo electrónico no tiene un formato válido.';
    if (code.includes('missing-password'))
      return 'La contraseña es obligatoria.';
    return 'No se pudo iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.';
  }

  /** Establece el estado "cargando" del botón de login */
  function _setLoginLoading(loading) {
    const btn = document.getElementById('btn-login');
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
    btn.setAttribute('aria-busy', String(loading));
  }

  // ─── Login con email + password ──────────────────────────────────────────
  async function _handleLogin(e) {
    if (e) e.preventDefault();
    _clearLoginErrors();

    const emailVal = document.getElementById('login-email')?.value.trim()  || '';
    const passVal  = document.getElementById('login-password')?.value       || '';

    // Validación previa al SDK (mensajes en español, sin latencia de red)
    let hasErrors = false;
    if (!emailVal) {
      _showFieldError('login-email', 'El correo electrónico es obligatorio.');
      hasErrors = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      _showFieldError('login-email', 'Escribe un correo electrónico válido.');
      hasErrors = true;
    }
    if (!passVal) {
      _showFieldError('login-password', 'La contraseña es obligatoria.');
      hasErrors = true;
    } else if (passVal.length < 6) {
      _showFieldError('login-password', 'La contraseña debe tener al menos 6 caracteres.');
      hasErrors = true;
    }
    if (hasErrors) return;

    // Verificar Firebase disponible
    if (!_auth) {
      _showGlobalError('Firebase no está configurado. Verifica la conexión e intenta de nuevo.');
      return;
    }

    _setLoginLoading(true);

    try {
      const credential = await _auth.signInWithEmailAndPassword(emailVal, passVal);
      const user = credential.user;

      // Recordar el email para el próximo login
      _saveCredentials(emailVal);

      // Verificar cuenta autorizada Y correo verificado (requisito de
      // firestore.rules → isAuthorizedOperator()).
      const session = _validateSession(user);
      if (!session.ok) {
        if (session.reason === 'unverified') {
          // Reenvío best-effort del correo de verificación.
          try { await user.sendEmailVerification(); } catch (_) { /* sin permiso o sin red */ }
        }
        await _auth.signOut();
        _showGlobalError(
          session.reason === 'unverified'
            ? VERIFY_EMAIL_MESSAGE
            : 'Esta cuenta no tiene permiso para operar el escáner de campo.',
        );
        return;
      }

      // Cuenta válida. Si el correo aún no está verificado se recuerda sin
      // bloquear la sesión (modo abierto): así una cuenta recién creada en la
      // consola puede operar desde el primer intento.
      if (!_isEmailVerified(user)) {
        console.warn(
          '[FieldScanner] La cuenta opera sin correo verificado. '
          + 'Activa REQUIRE_VERIFIED_EMAIL = true en field-scanner.js (y '
          + 'email_verified en firestore.rules) para exigirlo.',
        );
        try { await user.sendEmailVerification(); } catch (_) { /* sin red o sin permiso */ }
      } else {
        console.info('[FieldScanner] Correo verificado ✔');
      }

      // Limpiar contraseña del DOM por seguridad
      const pwdInput = document.getElementById('login-password');
      if (pwdInput) pwdInput.value = '';

      await _onLoginSuccess(user);

    } catch (err) {
      const msg = _traducirErrorAuth(err.code || '', err.message || '');
      _showGlobalError(msg);
      console.error('[FieldScanner] Login error:', err.code, err.message);
    } finally {
      _setLoginLoading(false);
    }
  }

  function _handleLogout() {
    _auth?.signOut?.().catch(() => {});
    _clearCredentials();
    if (_scannerActive) _stopScanner();
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    // Ocultar chip y botón de salir
    const chip    = document.getElementById('scanner-user-chip');
    const logout  = document.getElementById('logout-btn');
    if (chip)   chip.hidden   = true;
    if (logout) logout.hidden = true;
    _showLogin();
  }

  // ─── Bind de eventos de login ──────────────────────────────────────────────
  function _bindLoginEvents() {
    // Pre-llenar el email del último login para acelerar el acceso
    const savedEmail = _getSavedEmail();
    const emailInput = document.getElementById('login-email');
    if (savedEmail && emailInput) emailInput.value = savedEmail;
  }

  // ─── Firebase ────────────────────────────────────────────────────────────
  async function _initFirebase() {
    try {
      const stored     = JSON.parse(localStorage.getItem('cpc_firebase_config') || '{}');
      const configured = window.FIREBASE_CONFIG || {};
      const config = {
        apiKey:            stored.apiKey            || configured.apiKey            || '',
        authDomain:        stored.authDomain        || configured.authDomain        || '',
        projectId:         stored.projectId         || configured.projectId         || '',
        storageBucket:     stored.storageBucket     || configured.storageBucket     || '',
        messagingSenderId: stored.messagingSenderId || configured.messagingSenderId || '',
        appId:             stored.appId             || configured.appId             || '',
      };

      if (!config.apiKey || !config.projectId) {
        console.warn('[FieldScanner] Firebase no configurado. Verifica FIREBASE_CONFIG.');
        _updateStatusPill(false);
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      _db   = firebase.firestore();
      _auth = firebase.auth();

      // No llamamos enablePersistence: en Firebase 12.x el build compat aún
      // delega en enableMultiTabIndexedDbPersistence() y escribe un warn de
      // deprecación en consola. La API nueva (persistentLocalCache) no está
      // expuesta en compat. Offline se cubre con la cola/caché de la app.
      // TODO: migrar a initializeFirestore({ localCache: persistentLocalCache(...) })
      // cuando se pase al SDK modular.

      _updateStatusPill(true);
    } catch (error) {
      console.error('[FieldScanner] Error inicializando Firebase:', error);
      _updateStatusPill(false);
    }
  }

  function _subscribeRealtime() {
    if (!_db) return;
    // _onLoginSuccess lo invocan tanto _handleLogin como onAuthStateChanged para
    // la misma sesión; sin cancelar el listener previo se acumularía uno por
    // cada inicio de sesión y sólo el último se liberaría al salir.
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    try {
      const hoy = _today();
      _unsubscribe = _db.collection('asistencias')
        .where('Fecha', '==', hoy)
        .limit(50)
        .onSnapshot(
          (snapshot) => {
            const records = snapshot.docs.map((doc) => ({ ID_Marcacion: doc.id, ...doc.data() }));
            _renderFeed(records);
          },
          (error) => console.error('[FieldScanner] Error suscripción:', error),
        );
    } catch (error) {
      console.error('[FieldScanner] No se pudo suscribir:', error);
    }
  }

  // ─── Eventos ─────────────────────────────────────────────────────────────
  function _bindEvents() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', _handleLogin);

    // Pre-llenar email del último login
    _bindLoginEvents();

    // Limpiar error de campo al escribir
    ['login-email', 'login-password'].forEach((id) => {
      const inp = document.getElementById(id);
      if (inp) inp.addEventListener('input', () => {
        inp.classList.remove('input-error');
        const errEl = document.getElementById(id + '-error');
        if (errEl) errEl.hidden = true;
        // Ocultar error global cuando el usuario edita
        const globalErr = document.getElementById('login-global-error');
        if (globalErr) globalErr.hidden = true;
      });
    });

    // Escáner
    const btnStart  = document.getElementById('campo-btn-scan');
    const btnStop   = document.getElementById('campo-btn-stop');
    const btnSwitch = document.getElementById('campo-btn-switch-camera');
    const camSelect = document.getElementById('campo-camera-select');
    const logoutBtn = document.getElementById('logout-btn');

    if (btnStart)  btnStart.addEventListener('click',  () => _startScanner());
    if (btnStop)   btnStop.addEventListener('click',   _stopScanner);
    if (btnSwitch) btnSwitch.addEventListener('click', _switchCamera);
    if (camSelect) camSelect.addEventListener('change', () => _startScanner({ deviceId: camSelect.value }));
    if (logoutBtn) logoutBtn.addEventListener('click',  _handleLogout);

    // Marcación QR
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.campo-mark-btn');
      if (btn && btn.dataset?.tipo) _procesarMarcacion(btn.dataset.tipo);
    });
  }

  // ─── Audio ───────────────────────────────────────────────────────────────
  function _initAudio() {
    const create = window.CPC && window.CPC.FeedbackAudio && window.CPC.FeedbackAudio.create;
    _audio = typeof create === 'function' ? create() : null;
  }

  // ─── Escáner QR ──────────────────────────────────────────────────────────
  function _session()      { return window.CPC?.CameraSession; }
  function _mobileSession(){ return window.MobileQRScanner; }
  function _useMobileScanner() {
    // Solo usar el escáner optimizado móvil en dispositivos móviles REALES.
    // En PC debe usarse CameraSession (constraints suaves, fallback por
    // candidato), forzar MobileQRScanner en escritorio rompe webcams
    // (OverconstrainedError por max 640x480 y facingMode environment).
    if (!window.MobileCameraOptimizer?.isMobile()) return false;
    return !!window.MobileQRScanner;
  }

  function _setCameraStatus(msg) {
    const el = document.getElementById('campo-camera-status');
    if (el) el.textContent = msg;
  }

  async function _loadCameraChoices() {
    const session   = _useMobileScanner() ? _mobileSession() : _session();
    const select    = document.getElementById('campo-camera-select');
    const switchBtn = document.getElementById('campo-btn-switch-camera');
    if (!session || !select) return;
    try {
      const devices = await session.listCameras();
      select.innerHTML = devices.map((d) =>
        `<option value="${_esc(d.id)}">${_esc(d.label)}</option>`,
      ).join('');
      const multi = devices.length >= 2;
      select.hidden = !multi;
      if (switchBtn) switchBtn.hidden = !multi;
    } catch (_) { /* sin enumeración de cámaras */ }
  }

  async function _startScanner(options = {}) {
    const useMobile = _useMobileScanner();
    const session   = useMobile ? _mobileSession() : _session();

    // La sección del escáner llega oculta en el HTML (`hidden`) y hay que
    // mostrarla ANTES de arrancar la cámara: html5-qrcode dimensiona el <video>
    // con el tamaño del contenedor y, con la sección oculta, mide 0x0, así que
    // no puede recortar el qrbox ni decodificar frames (síntoma: "Cámara activa"
    // pero sin imagen y sin leer ningún QR).
    _mostrarSeccion('campo-scanner');

    if (useMobile && typeof Html5Qrcode === 'undefined') {
      _showStatusMessage('Escáner QR no disponible', 'error');
      return;
    }

    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop  = document.getElementById('campo-btn-stop');

    try {
      if (useMobile) {
        if (!_qrController) _qrController = session;
        _setCameraStatus('Iniciando cámara móvil optimizada…');
        const result = await session.start({
          elementId: 'campo-qr-reader',
          onSuccess: _onQRSuccess,
          onError: (err) => console.warn('[MobileQRScanner] Error:', err),
          cameraOptions: { facingMode: _facingMode, ...options },
        });
        if (!result) return;
        _scannerActive = true;
        if (btnStart) btnStart.hidden = true;
        if (btnStop)  btnStop.hidden  = false;
        _setCameraStatus('Cámara móvil activa');
        await _loadCameraChoices();
        _injectTorchButton();
      } else {
        if (!_qrController) {
          _qrController = session.createQrController({
            Scanner: Html5Qrcode,
            elementId: 'campo-qr-reader',
            onSuccess: _onQRSuccess,
          });
        }
        _setCameraStatus('Iniciando cámara…');
        const result = await _qrController.start({ facingMode: _facingMode, ...options });
        if (!result) return;
        _scannerActive = true;
        if (btnStart) btnStart.hidden = true;
        if (btnStop)  btnStop.hidden  = false;
        _setCameraStatus('Cámara activa');
        await _loadCameraChoices();
        _injectTorchButton();
      }
    } catch (err) {
      _saveErrorLog(err, 'scannerStart');
      _setCameraStatus('Cámara no disponible');
      const desc = useMobile
        ? 'Verifica permisos de cámara en la configuración del dispositivo'
        : session?.describeError?.(err);
      _showStatusMessage(desc || 'Error al iniciar cámara', 'error');
    }
  }

  async function _stopScanner() {
    if (_qrController) await _qrController.stop();
    _scannerActive = false;
    const btnStart = document.getElementById('campo-btn-scan');
    const btnStop  = document.getElementById('campo-btn-stop');
    if (btnStart) btnStart.hidden = false;
    if (btnStop)  btnStop.hidden  = true;
    _removeTorchButton();
    _setCameraStatus('');
  }

  async function _switchCamera() {
    const useMobile = _useMobileScanner();
    const session   = useMobile ? _mobileSession() : _session();
    if (useMobile && session) {
      try {
        await session.switchCamera();
        _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
      } catch (_) {
        _showStatusMessage('Error al cambiar cámara', 'error');
      }
    } else {
      _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
      await _startScanner();
    }
  }

  // ─── Torch / Flash ───────────────────────────────────────────────────────
  function _injectTorchButton() {
    const container = document.querySelector('.campo-scanner-actions');
    if (!container || document.getElementById('campo-btn-torch')) return;
    const useMobile = _useMobileScanner();
    const session   = useMobile ? _mobileSession() : _session();
    const supported = session?.supportsTorch?.();

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.id        = 'campo-btn-torch';
    btn.className = 'campo-btn ghost';
    btn.setAttribute('aria-label', 'Activar/desactivar flash');
    btn.innerHTML = '<i data-lucide="flashlight" aria-hidden="true"></i> Flash';
    btn.hidden = !supported;
    btn.addEventListener('click', async () => {
      if (!session?.supportsTorch?.()) {
        _showStatusMessage('Flash no disponible', 'error');
        return;
      }
      try {
        const on = await session.toggleTorch();
        btn.innerHTML = `<i data-lucide="${on ? 'flashlight-off' : 'flashlight'}" aria-hidden="true"></i> ${on ? 'Apagar flash' : 'Flash'}`;
        if (window.lucide) lucide.createIcons({ nodes: [btn] });
      } catch (_) {
        _showStatusMessage('Error al cambiar flash', 'error');
      }
    });
    container.appendChild(btn);
    if (window.lucide) lucide.createIcons({ nodes: [btn] });
  }

  function _removeTorchButton() {
    document.getElementById('campo-btn-torch')?.remove();
  }

  // ─── QR Success ──────────────────────────────────────────────────────────
  async function _onQRSuccess(decodedText) {
    if (navigator.vibrate) navigator.vibrate(80);
    if (_audio) _audio.beepSuccess();

    const qrData = _parseQRData(decodedText);
    if (!qrData) {
      if (_audio) _audio.beepError();
      _saveErrorLog(new Error('QR no reconocido: ' + decodedText), 'qrParse');
      _showStatusMessage('QR no reconocido', 'error');
      return;
    }

    _showStatusMessage('Buscando trabajador…', 'success');
    const trabajador = await _buscarTrabajadorPorQR(qrData);
    if (!trabajador) {
      if (_audio) _audio.beepError();
      _saveErrorLog(new Error('Trabajador no encontrado: ' + (qrData.id || '—')), 'qrWorkerLookup');
      _showStatusMessage('Trabajador no encontrado', 'error');
      return;
    }

    _stopScanner();
    _currentWorker = trabajador;
    _renderWorker(trabajador);
    _habilitaBotones(true);
    _captureGPS();
  }

  function _parseQRData(text) {
    try {
      const data = JSON.parse(text);
      if (data && data.id) return data;
    } catch (_) { /* no es JSON */ }
    if (text && /^[A-Z0-9-]+$/.test(text) && text.length >= 5) return { id: text };
    return null;
  }

  async function _buscarTrabajadorPorQR(qrData) {
    // 1. AppState (app principal en mismo tab)
    const personal = (window.AppState?.get('personal')) || [];
    if (Array.isArray(personal) && personal.length) {
      const found = _buscarEnLista(personal, qrData);
      if (found) return found;
    }
    // 2. Cache localStorage
    const cached = JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]');
    if (Array.isArray(cached) && cached.length) {
      const found = _buscarEnLista(cached, qrData);
      if (found) return found;
    }
    // 3. Firestore (dispositivo remoto sin caché)
    return _buscarTrabajadorFirestore(qrData);
  }

  function _buscarEnLista(lista, qrData) {
    if (qrData.dpi) {
      const norm = String(qrData.dpi).replace(/\D/g, '');
      const f = lista.find((p) => (p.DPI_CUI || '').replace(/\D/g, '') === norm);
      if (f) return f;
    }
    if (qrData.id) {
      return lista.find((p) => p.ID_Trabajador === qrData.id) || null;
    }
    return null;
  }

  async function _buscarTrabajadorFirestore(qrData) {
    if (!_db) return null;
    try {
      let snap;
      if (qrData.id) {
        snap = await _db.collection('personal').where('ID_Trabajador', '==', qrData.id).limit(1).get();
      } else if (qrData.dpi) {
        const dpi = String(qrData.dpi).replace(/\D/g, '');
        snap = await _db.collection('personal').where('DPI_CUI', '==', dpi).limit(1).get();
      }
      if (!snap || snap.empty) return null;
      const trabajador = snap.docs[0].data();
      // Actualizar cache local para búsquedas futuras
      try {
        const cache = JSON.parse(localStorage.getItem('cpc_personal_cache') || '[]');
        if (!cache.find((p) => p.ID_Trabajador === trabajador.ID_Trabajador)) {
          cache.push(trabajador);
          localStorage.setItem('cpc_personal_cache', JSON.stringify(cache));
        }
      } catch (_) { /* silenciar */ }
      return trabajador;
    } catch (err) {
      console.error('[FieldScanner] Error buscando trabajador en Firestore:', err);
      return null;
    }
  }

  // ─── Worker UI ───────────────────────────────────────────────────────────
  function _renderWorker(trabajador) {
    const panel  = document.getElementById('campo-worker');
    if (!panel) return;
    const name   = document.getElementById('campo-worker-name');
    const puesto = document.getElementById('campo-worker-puesto');
    const idEl   = document.getElementById('campo-worker-id');
    const photo  = document.getElementById('campo-worker-photo');
    const avatar = document.getElementById('campo-worker-avatar');

    if (name)   name.textContent   = trabajador.Nombre_Completo || '--';
    if (puesto) puesto.textContent = trabajador.Puesto          || '--';
    if (idEl)   idEl.textContent   = trabajador.ID_Trabajador   || '--';

    if (photo) {
      if (trabajador.Fotografia_URL) {
        photo.src    = trabajador.Fotografia_URL;
        photo.hidden = false;
      } else {
        photo.removeAttribute('src');
        photo.hidden = true;
      }
    }
    if (avatar) {
      const ini = String(trabajador.Nombre_Completo || '?')
        .trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
      avatar.textContent = ini || '?';
    }
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _habilitaBotones(enable) {
    document.querySelectorAll('.campo-mark-btn').forEach((btn) => { btn.disabled = !enable; });
  }

  function _renderMarkButtons() {
    const grid = document.getElementById('campo-mark-grid');
    if (!grid) return;
    const appStateConfig = window.AppState?.get('config') || {};
    const lsConfig = JSON.parse(localStorage.getItem('cpc_config') || localStorage.getItem('cpc_config_cache') || '{}');
    const config = { ...lsConfig, ...appStateConfig };
    grid.innerHTML = MARK_TYPES.map((m) => {
      const hora = config[m.horaKey] || m.fallback;
      return `<button type="button" class="campo-mark-btn ${m.cls}" data-tipo="${m.tipo}" aria-label="Marcar ${m.tipo}" disabled>
        <i data-lucide="${m.icono}" aria-hidden="true"></i>
        <span>${m.tipo.replace(/_/g, ' ')}</span>
        <span class="campo-mark-time">${hora}</span>
      </button>`;
    }).join('');
    lucide?.createIcons?.({ nodes: [grid] });
  }

  // ─── GPS ─────────────────────────────────────────────────────────────────
  async function _captureGPS() {
    const gpsEl = document.getElementById('campo-gps');
    const lbl   = document.getElementById('campo-gps-label');
    if (gpsEl) gpsEl.hidden = true;
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible'));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
        });
      });
      const { latitude, longitude } = pos.coords;
      if (lbl) lbl.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      if (gpsEl) gpsEl.hidden = false;
      return { latitude, longitude };
    } catch (_) {
      if (lbl) lbl.textContent = 'Sin GPS';
      return null;
    }
  }

  // ─── Auditoría ───────────────────────────────────────────────────────────
  function _getDeviceInfo() {
    const ua = navigator.userAgent || '';
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    const os = ua.match(/Android|iPhone|iPad|Windows|Mac|Linux/)?.[0] || 'Unknown';
    return `${isMobile ? 'Mobile' : 'Desktop'} · ${os}`;
  }

  function _getOperatorInfo() {
    return _auth?.currentUser?.email || _auth?.currentUser?.uid || 'unknown';
  }

  function _today() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  }

  function _saveAuditLog(record) {
    try {
      const key = 'field_scanner_audit_log';
      const log = JSON.parse(localStorage.getItem(key) || '[]');
      log.push({
        timestamp:  new Date().toISOString(),
        operator:   _getOperatorInfo(),
        device:     _getDeviceInfo(),
        action:     'marcacion',
        workerId:   record.ID_Trabajador,
        workerName: record.Nombre_Trabajador,
        tipo:       record.Tipo_Marcacion,
        status:     'success',
      });
      localStorage.setItem(key, JSON.stringify(log.slice(-100)));
    } catch (_) { /* silenciar */ }
  }

  function _saveErrorLog(error, context = '') {
    try {
      const key = 'field_scanner_audit_log';
      const log = JSON.parse(localStorage.getItem(key) || '[]');
      log.push({
        timestamp: new Date().toISOString(),
        operator:  _getOperatorInfo(),
        device:    _getDeviceInfo(),
        action:    'error',
        context,
        error:     String(error?.message || error || 'Unknown error'),
        status:    'error',
      });
      localStorage.setItem(key, JSON.stringify(log.slice(-100)));
    } catch (_) { /* silenciar */ }
  }

  /**
   * Traduce el error de escritura en Firestore a un mensaje accionable para el
   * operador de campo.
   * @param {Error} err - Error lanzado por Firestore
   * @returns {string}
   */
  function _mensajeErrorMarcacion(err) {
    const code = String(err?.code || '');
    if (code.includes('permission-denied')) {
      return 'Sin permiso para registrar. Verifica que tu correo esté verificado y la sesión activa.';
    }
    if (code.includes('unavailable') || code.includes('network')) {
      return 'Sin conexión: la marcación no se pudo enviar. Inténtalo de nuevo.';
    }
    if (code.includes('failed-precondition')) {
      return 'Base de datos no lista. Recarga la página e inténtalo otra vez.';
    }
    return 'No se pudo registrar la marca';
  }

  // ─── Marcación ───────────────────────────────────────────────────────────
  async function _procesarMarcacion(tipo) {
    if (!_currentWorker) { _showStatusMessage('Escanea primero el QR', 'error'); return; }
    if (_marking) return;
    _marking = true;
    _habilitaBotones(false);

    const hoy = _today();
    const gps = await _captureGPS();
    const payload = {
      ID_Trabajador:     _currentWorker.ID_Trabajador,
      Nombre_Trabajador: _currentWorker.Nombre_Completo,
      Tipo_Marcacion:    tipo,
      Fecha:             hoy,
      Metodo_Registro:   'Escaneo_QR',
      Ubicacion_Obra:    '',
    };
    if (gps) { payload.GPS_Latitud = gps.latitude; payload.GPS_Longitud = gps.longitude; }

    try {
      const id = await _enviarMarcacionFirestore(payload);
      const horaReal = new Date().toLocaleTimeString('es-GT', { hour12: false }).substring(0, 5);
      if (_audio) _audio.beepSuccess();
      _showStatusMessage('Marcación registrada', 'success');
      _renderFeed([{ ID_Marcacion: id, ...payload, Hora_Real: horaReal, Estado_Marcacion: 'A Tiempo' }]);
    } catch (err) {
      _saveErrorLog(err, 'enviarMarcacion');
      if (_audio) _audio.beepError();
      _showStatusMessage(_mensajeErrorMarcacion(err), 'error');
    } finally {
      _marking = false;
      _currentWorker = null;
      _habilitaBotones(false);
      setTimeout(() => { if (!_scannerActive) _startScanner(); }, 450);
    }
  }

  async function _enviarMarcacionFirestore(payload) {
    if (!_db) throw new Error('Firebase no disponible');
    const horaReal = new Date().toLocaleTimeString('es-GT', { hour12: false }).substring(0, 5);
    // ID determinista: idempotente ante doble lectura del mismo QR
    const id = `${payload.ID_Trabajador}_${payload.Fecha}_${payload.Tipo_Marcacion}`.replace(/[^A-Za-z0-9_-]/g, '_');
    const record = {
      ID_Marcacion:      id,
      ID_Registro:       id,
      ID_Trabajador:     payload.ID_Trabajador,
      Nombre_Trabajador: payload.Nombre_Trabajador,
      Fecha:             payload.Fecha,
      Tipo_Marcacion:    payload.Tipo_Marcacion,
      Hora_Programada:   '',
      Hora_Real:         horaReal,
      Estado_Marcacion:  'A Tiempo',
      Metodo_Registro:   payload.Metodo_Registro || 'Escaneo_QR',
      Horas_Extra:       0,
      Ubicacion_Obra:    payload.Ubicacion_Obra || '',
      Timestamp:         Date.now(),
    };
    if (payload.GPS_Latitud  !== undefined) record.GPS_Latitud  = payload.GPS_Latitud;
    if (payload.GPS_Longitud !== undefined) record.GPS_Longitud = payload.GPS_Longitud;

    const ref = _db.collection('asistencias').doc(id);
    await _db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) transaction.set(ref, record, { merge: false });
    });
    _saveAuditLog({ ...record, Nombre_Trabajador: payload.Nombre_Trabajador });
    return id;
  }

  // ─── Feed ─────────────────────────────────────────────────────────────────
  function _renderFeed(records) {
    const list = document.getElementById('campo-feed-list');
    if (!list) return;
    const hoy   = _today();
    const today = (records || []).filter((a) => a.Fecha === hoy).slice(-6).reverse();
    if (!today.length) {
      list.innerHTML = '<li class="campo-feed-empty">Aún no hay marcaciones hoy.</li>';
      return;
    }
    // La sección del feed también viene oculta en el HTML: se muestra en cuanto
    // hay marcaciones que listar.
    _mostrarSeccion('campo-feed');
    list.innerHTML = today.map((a) => {
      const hora = (a.Hora_Real || '').substring(0, 5);
      return `<li class="campo-feed-item">
        <span class="feed-dot" aria-hidden="true"></span>
        <span><b>${_esc(a.Nombre_Completo || a.Nombre_Trabajador || '—')}</b> · ${_esc(a.Tipo_Marcacion || '')}</span>
        <span class="feed-meta">${hora || 'registrada'}</span>
      </li>`;
    }).join('');
  }

  // ─── Estado de conexión / status pill ────────────────────────────────────
  function _updateStatusPill(connected) {
    const pill = document.getElementById('campo-status');
    const text = document.getElementById('campo-status-text');
    if (!pill || !text) return;
    pill.classList.toggle('connected',    connected);
    pill.classList.toggle('disconnected', !connected);
    text.textContent = connected ? 'En vivo' : 'Offline';
  }

  function _showStatusMessage(message, type = 'error') {
    const pill = document.getElementById('campo-status');
    const text = document.getElementById('campo-status-text');
    if (!pill || !text) return;
    clearTimeout(_statusTimer);
    pill.classList.toggle('disconnected', type === 'error');
    pill.classList.toggle('connected',    type !== 'error');
    text.textContent = message;
    _statusTimer = setTimeout(() => _updateStatusPill(!!_db), 4000);
  }

  // ─── Utilidades ──────────────────────────────────────────────────────────
  function _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Instalación PWA (sub-app) ─────────────────────────────────────────────
  function _fsPwaIsInstalled() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.navigator && window.navigator.standalone === true) return true;
    } catch (_) { /* noop */ }
    return false;
  }

  function _fsPwaDismissed() {
    try { return localStorage.getItem(FS_PWA_DISMISS_KEY) === '1'; } catch (_) { return false; }
  }

  function _hideFsInstallBanner(banner) {
    if (banner) banner.hidden = true;
  }

  /**
   * Banner "Agregar a pantalla de inicio" propio de la sub-app. Sin su propio
   * listener, el beforeinstallprompt de esta página se perdería (la app
   * principal lo captura en index.html, no aquí).
   */
  function _initPwaInstall() {
    const banner = document.getElementById('fs-pwa-install-banner');
    const btn    = document.getElementById('fs-install-btn');
    const close  = document.getElementById('fs-install-dismiss');

    if (!banner || _fsPwaIsInstalled()) return;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      _deferredInstallPrompt = event;
      if (_fsPwaIsInstalled() || _fsPwaDismissed()) return;
      banner.hidden = false;
    });

    window.addEventListener('appinstalled', () => {
      _deferredInstallPrompt = null;
      try { localStorage.removeItem(FS_PWA_DISMISS_KEY); } catch (_) { /* noop */ }
      _hideFsInstallBanner(banner);
    });

    if (btn) {
      btn.addEventListener('click', async () => {
        if (!_deferredInstallPrompt) return;
        _deferredInstallPrompt.prompt();
        await _deferredInstallPrompt.userChoice;
        _deferredInstallPrompt = null;
        _hideFsInstallBanner(banner);
      });
    }

    if (close) {
      close.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        try { localStorage.setItem(FS_PWA_DISMISS_KEY, '1'); } catch (_) { /* noop */ }
        _hideFsInstallBanner(banner);
      });
    }
  }

  // ─── Ciclo de vida público ────────────────────────────────────────────────
  async function cargar() {
    if (!_auth?.currentUser || !_validateSession(_auth.currentUser).ok) {
      _showLogin();
      return;
    }
    await _onLoginSuccess(_auth.currentUser);
  }

  function cleanup() {
    if (_scannerActive) _stopScanner();
    if (_unsubscribe && typeof _unsubscribe === 'function') _unsubscribe();
  }

  // API pública
  window.FieldScanner = {
    init, cargar, cleanup, showLogin: _showLogin, handleLogout: _handleLogout,
    // Ganchos de prueba/e2e (no afectan el flujo normal)
    simulateScan: (text) => _onQRSuccess(String(text ?? '')),
    __testLogin: async () => _onLoginSuccess({ email: 'sistemadecontrol090@gmail.com', emailVerified: true, uid: 'e2e-test' }),
    __testSetDb: (db) => { _db = db; },
    __validateSession: (user) => _validateSession(user),
    __mensajeErrorMarcacion: (err) => _mensajeErrorMarcacion(err),
    /** Alterna el modo estricto (correo verificado obligatorio) en los tests. */
    __setRequireVerifiedEmail: (value) => { REQUIRE_VERIFIED_EMAIL = value === true; },
  };

  // Arranque automático
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

})();
