/**
 * CONTROL PERSONAL CAMPO — modules/auth.js
 * Módulo de autenticación SaaS multi-tenant.
 * Usa el SDK Firebase compat v12 (window.firebase) inicializado por
 * firebase-client.js — NO depende del SDK modular v10 ni de
 * window.firebaseAuth / window.firebaseAuthMethods que fueron eliminados.
 *
 * Todas las operaciones de auth se delegan a window.FirebaseClient para
 * mantener una única instancia de Firebase en la app.
 * @version 1.5.0
 */

const ModuloAuth = (() => {
  'use strict';

  let _eventsBound = false;
  let _currentUser = null;

  // ─────────────────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────────────────

  function init() {
    _bindEvents();
    _subscribeAuthState();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENTOS
  // ─────────────────────────────────────────────────────────────────────────────

  function _bindEvents() {
    if (_eventsBound) return;
    _eventsBound = true;

    document.getElementById('hub-btn-login-google')
      ?.addEventListener('click', _handleGoogleLogin);

    document.getElementById('hub-btn-register-email')
      ?.addEventListener('click', _showRegisterModal);

    document.getElementById('hub-btn-login-email')
      ?.addEventListener('click', _handleEmailLogin);

    document.getElementById('hub-btn-logout')
      ?.addEventListener('click', _handleLogout);

    document.getElementById('btn-submit-register')
      ?.addEventListener('click', _handleRegister);

    document.getElementById('btn-cancel-register')
      ?.addEventListener('click', _hideRegisterModal);

    // Cerrar modal con Escape o clic fuera
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _hideRegisterModal();
    });

    const modalRegister = document.getElementById('modal-register');
    if (modalRegister) {
      modalRegister.addEventListener('click', (e) => {
        if (e.target === modalRegister) _hideRegisterModal();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ESTADO DE AUTENTICACIÓN — usa SDK compat vía FirebaseClient
  // ─────────────────────────────────────────────────────────────────────────────

  function _subscribeAuthState() {
    if (!window.FirebaseClient?.onAuthStateChanged) {
      // FirebaseClient aún no está listo; reintenta en 200ms
      setTimeout(_subscribeAuthState, 200);
      return;
    }

    FirebaseClient.onAuthStateChanged((user) => {
      _currentUser = user || null;
      if (user) {
        _showAuthenticatedState(user);
        _loadUserData(user);
      } else {
        _showUnauthenticatedState();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCIONES DE AUTH — delegadas a FirebaseClient (SDK compat)
  // ─────────────────────────────────────────────────────────────────────────────

  async function _handleGoogleLogin() {
    const loader = Alerts.loading('Iniciando sesión con Google…');
    try {
      const result = await FirebaseClient.signInWithGoogle();
      loader.close();
      if (result.success) {
        Alerts.success('¡Bienvenido! Sesión iniciada con Google.');
        _loadUserData(result.user);
      } else if (!result.redirecting) {
        Alerts.error(result.error || 'Error al iniciar sesión con Google.');
      }
    } catch (err) {
      loader.close();
      Alerts.error('Error al iniciar sesión con Google: ' + err.message);
      if (window.Logger) Logger.error('ModuloAuth', 'Google login error', { error: err.message });
    }
  }

  async function _handleEmailLogin() {
    const email    = document.getElementById('hub-auth-email')?.value.trim();
    const password = document.getElementById('hub-auth-password')?.value || '';

    if (!email)    { Alerts.error('El correo es obligatorio.');      return; }
    if (!password) { Alerts.error('La contraseña es obligatoria.');  return; }

    const loader = Alerts.loading('Iniciando sesión…');
    try {
      const result = await FirebaseClient.signInWithEmail(email, password);
      loader.close();
      if (result.success) {
        Alerts.success('¡Bienvenido de nuevo!');
        _loadUserData(result.user);
      } else {
        Alerts.error(result.error || 'Correo o contraseña no válidos.');
      }
    } catch (err) {
      loader.close();
      Alerts.error('Error al iniciar sesión: ' + err.message);
      if (window.Logger) Logger.error('ModuloAuth', 'Email login error', { error: err.message });
    }
  }

  async function _handleRegister() {
    const nombre           = document.getElementById('reg-nombre')?.value.trim()          || '';
    const email            = document.getElementById('reg-email')?.value.trim()            || '';
    const password         = document.getElementById('reg-password')?.value                || '';
    const passwordConfirm  = document.getElementById('reg-password-confirm')?.value        || '';

    if (nombre.length < 2)                          { Alerts.error('El nombre debe tener al menos 2 caracteres.');       return; }
    if (!email.includes('@') || !email.includes('.')) { Alerts.error('Ingresa un correo electrónico válido.');            return; }
    if (password.length < 6)                        { Alerts.error('La contraseña debe tener al menos 6 caracteres.');   return; }
    if (password !== passwordConfirm)               { Alerts.error('Las contraseñas no coinciden.');                      return; }

    const loader = Alerts.loading('Registrando cuenta…');
    try {
      const result = await FirebaseClient.registerUser(email, password, nombre);
      loader.close();
      if (result.success) {
        Alerts.success('¡Cuenta creada! Bienvenido ' + (result.user?.displayName || nombre));
        _hideRegisterModal();
        _loadUserData(result.user);
      } else {
        Alerts.error(result.error || 'Error al crear cuenta.');
      }
    } catch (err) {
      loader.close();
      Alerts.error('Error al crear cuenta: ' + err.message);
      if (window.Logger) Logger.error('ModuloAuth', 'Register error', { error: err.message });
    }
  }

  async function _handleLogout() {
    const loader = Alerts.loading('Cerrando sesión…');
    try {
      window._teardownRealtimeSubscriptions?.();
      await FirebaseClient.signOut();
      loader.close();
      Alerts.success('Sesión cerrada. Modo local activo.');
      _showUnauthenticatedState();
      AppState.set('personal', []);
      AppState.set('asistencias', []);
      if (window.ModuloPersonal)  ModuloPersonal.cargar();
      if (window.ModuloDashboard) ModuloDashboard.cargar();
    } catch (err) {
      loader.close();
      Alerts.error('Error al cerrar sesión: ' + err.message);
      if (window.Logger) Logger.error('ModuloAuth', 'Logout error', { error: err.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODAL DE REGISTRO
  // ─────────────────────────────────────────────────────────────────────────────

  function _showRegisterModal() {
    const modal = document.getElementById('modal-register');
    if (!modal) return;
    modal.hidden = false;
    setTimeout(() => document.getElementById('reg-nombre')?.focus(), 80);
  }

  function _hideRegisterModal() {
    const modal = document.getElementById('modal-register');
    if (!modal) return;
    modal.hidden = true;
    ['reg-nombre', 'reg-email', 'reg-password', 'reg-password-confirm']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UI — estado autenticado / no autenticado
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Actualiza el badge de conexión del sidebar sin destruir su marcado.
   * @param {boolean} online
   */
  function _setSidebarBadge(online) {
    const badge = document.querySelector('.connection-badge');
    if (!badge) return;
    const dot  = badge.querySelector('.connection-dot');
    const text = badge.querySelector('#connection-text');
    if (dot) {
      dot.classList.toggle('connected',    online);
      dot.classList.toggle('disconnected', !online);
    }
    if (text) text.textContent = online ? 'Firestore' : 'Modo local';
    badge.classList.toggle('connected',  online);
    badge.classList.toggle('local-mode', !online);
  }

  function _showAuthenticatedState(user) {
    document.getElementById('auth-buttons')?.classList.add('hidden');
    document.getElementById('auth-status')?.classList.remove('hidden');

    const elEmail = document.getElementById('user-email');
    const elName  = document.getElementById('user-display-name');
    if (elEmail) elEmail.textContent = user.email || '';
    if (elName)  elName.textContent  = user.displayName || '';

    _setSidebarBadge(true);

    const chip   = document.getElementById('hub-status-chip');
    const detail = document.getElementById('hub-status-detail');
    if (chip)   { chip.textContent = 'Conectado'; chip.classList.remove('hub-chip--local'); chip.classList.add('hub-chip--cloud'); }
    if (detail) detail.textContent = 'Sincronizado con Firebase';
  }

  function _showUnauthenticatedState() {
    document.getElementById('auth-buttons')?.classList.remove('hidden');
    document.getElementById('auth-status')?.classList.add('hidden');

    _setSidebarBadge(false);

    const chip   = document.getElementById('hub-status-chip');
    const detail = document.getElementById('hub-status-detail');
    if (chip)   { chip.textContent = 'Local'; chip.classList.add('hub-chip--local'); chip.classList.remove('hub-chip--cloud'); }
    if (detail) detail.textContent = 'Modo local — datos en este dispositivo';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CARGA DE DATOS TRAS LOGIN
  // ─────────────────────────────────────────────────────────────────────────────

  async function _loadUserData(user) {
    if (!user || typeof API === 'undefined') return;
    try {
      if (window.Logger) Logger.info('ModuloAuth', 'Cargando datos del usuario', { uid: user.uid });
      const [personalRes, configRes] = await Promise.allSettled([
        API.obtenerPersonal(),
        API.obtenerConfiguracion(),
      ]);
      if (personalRes.status === 'fulfilled') AppState.set('personal', personalRes.value?.data || []);
      if (configRes.status   === 'fulfilled') AppState.set('config',   configRes.value?.data   || {});
      if (window.ModuloPersonal)  ModuloPersonal.cargar();
      if (window.ModuloDashboard) ModuloDashboard.cargar();
      API.syncOfflineQueue?.().catch(() => {});
    } catch (err) {
      Alerts.warning('Error cargando datos. Puedes trabajar en modo local.');
      if (window.Logger) Logger.warn('ModuloAuth', 'Error cargando datos del usuario', { error: err.message });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // API PÚBLICA
  // ─────────────────────────────────────────────────────────────────────────────

  return {
    init,
    getCurrentUser:           () => _currentUser,
    isAuthenticated:          () => _currentUser !== null,
    showAuthenticatedState:   _showAuthenticatedState,
    showUnauthenticatedState: _showUnauthenticatedState,
  };
})();

window.ModuloAuth = ModuloAuth;
