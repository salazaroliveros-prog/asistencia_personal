/**
 * CONTROL PERSONAL CAMPO — modules/connection-hub.js
 * Hub de sesión y conexión: única UI de auth + estado de escritura.
 * No fuerza AppState.connected; lee FirebaseClient + Persist.
 * @version 2.0.0
 */
const ConnectionHub = (() => {
  'use strict';

  let _bound = false;
  let _authUnsub = null;

  function init() {
    _bindEvents();
    _loadFirebaseFields();
    _refreshUI();
    _subscribeAuth();
    _completeRedirectIfNeeded();
  }

  function cargar() {
    _loadFirebaseFields();
    _refreshUI();
  }

  function cleanup() {
    // listeners viven en la sección oculta del SPA
  }

  function _bindEvents() {
    if (_bound) return;
    _bound = true;

    const formAuth = document.getElementById('hub-form-auth');
    if (formAuth) {
      formAuth.addEventListener('submit', (e) => {
        e.preventDefault();
        _loginEmail();
      });
    }

    document.getElementById('hub-btn-login-email')?.addEventListener('click', _loginEmail);
    document.getElementById('hub-btn-login-google')?.addEventListener('click', _loginGoogle);
    document.getElementById('hub-btn-logout')?.addEventListener('click', _logout);
    document.getElementById('hub-btn-connect')?.addEventListener('click', _connectFirestore);
    document.getElementById('hub-btn-local')?.addEventListener('click', _useLocal);
    document.getElementById('hub-btn-sync')?.addEventListener('click', _syncNow);
    document.getElementById('hub-btn-gas')?.addEventListener('click', () => {
      if (window.GasAssistant) window.GasAssistant.open();
      else Alerts.error('Asistente GAS no disponible');
    });

    const advToggle = document.getElementById('hub-advanced-toggle');
    const advPanel = document.getElementById('hub-advanced-panel');
    if (advToggle && advPanel) {
      advToggle.addEventListener('click', () => {
        const open = advPanel.hidden;
        advPanel.hidden = !open;
        advToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        advToggle.querySelector('.hub-advanced-label')?.replaceChildren(
          document.createTextNode(open ? 'Ocultar configuración avanzada' : 'Configuración avanzada de Firebase'),
        );
      });
    }
  }

  function _subscribeAuth() {
    if (_authUnsub || !window.FirebaseClient?.onAuthStateChanged) return;
    _authUnsub = FirebaseClient.onAuthStateChanged(() => {
      _refreshUI();
      if (FirebaseClient.getCurrentUser() && typeof API !== 'undefined' && API.syncOfflineQueue) {
        API.syncOfflineQueue().catch(() => {});
      }
    });
  }

  async function _completeRedirectIfNeeded() {
    if (!FirebaseClient.completeGoogleRedirect) return;
    const result = await FirebaseClient.completeGoogleRedirect();
    if (result.handled && result.success && result.user) {
      Alerts.success('Sesión de Google iniciada.');
      await _afterLoginSuccess();
    } else if (result.handled && !result.success) {
      Alerts.error(_translateAuthError(result.code || result.error || ''), 'Google Sign-In');
      _setStatus('error', _translateAuthError(result.code || result.error || ''));
    }
    _refreshUI();
  }

  function _loadFirebaseFields() {
    const cfg = FirebaseClient.getConfig?.() || {};
    _setVal('hub-firebase-project-id', cfg.projectId);
    _setVal('hub-firebase-api-key', cfg.apiKey);
    _setVal('hub-firebase-auth-domain', cfg.authDomain);
    _setVal('hub-firebase-app-id', cfg.appId);
  }

  function _setVal(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
  }

  function _capability() {
    return window.CPC?.Persist?.getWriteCapability?.() || {
      ok: false,
      code: 'offline',
      reason: 'Sin capacidad de escritura',
    };
  }

  function _refreshUI() {
    const user = FirebaseClient.getCurrentUser?.();
    const state = FirebaseClient.getConnectionState?.() || 'idle';
    const cap = _capability();
    const queueLen = (typeof API !== 'undefined' && API.getOfflineQueue)
      ? API.getOfflineQueue().length
      : 0;

    const chip = document.getElementById('hub-status-chip');
    const detail = document.getElementById('hub-status-detail');
    const emailInput = document.getElementById('hub-auth-email');
    const loginEmail = document.getElementById('hub-btn-login-email');
    const loginGoogle = document.getElementById('hub-btn-login-google');
    const logout = document.getElementById('hub-btn-logout');
    const syncBtn = document.getElementById('hub-btn-sync');
    const userLine = document.getElementById('hub-user-line');

    let mode = 'local';
    let label = 'Modo local — datos en este dispositivo';
    let chipClass = 'hub-chip hub-chip--local';

    if (user && cap.ok) {
      mode = 'session-ok';
      label = `Conectado como ${user.email || 'operador'} · escritura en nube activa`;
      chipClass = 'hub-chip hub-chip--ok';
    } else if (user && !cap.ok) {
      mode = 'session-limited';
      label = `Sesión: ${user.email || 'operador'} · ${cap.reason || 'sin escritura en nube'}`;
      chipClass = 'hub-chip hub-chip--warn';
    } else if (state === 'connected' || state === 'degraded') {
      mode = 'configured-no-session';
      label = 'Firebase listo — inicia sesión para sincronizar';
      chipClass = 'hub-chip hub-chip--warn';
    } else if (cap.code === 'auth-required') {
      mode = 'auth-required';
      label = 'Sin sesión — inicia sesión para subir marcaciones y personal';
      chipClass = 'hub-chip hub-chip--warn';
    }

    if (chip) {
      chip.className = chipClass;
      chip.dataset.mode = mode;
      chip.textContent = mode === 'session-ok' ? 'Nube' : mode === 'local' ? 'Local' : 'Atención';
    }
    if (detail) {
      // El texto se reescribe en cada refresco de estado: hay que limpiar los
      // modificadores que puso `_setStatus` (is-error / is-ok) para no arrastrar
      // el estilo de error de un intento de login anterior.
      detail.textContent = label;
      detail.className = 'hub-status-detail';
    }
    if (userLine) {
      userLine.hidden = !user;
      userLine.textContent = user ? (user.email || user.uid) : '';
    }
    if (emailInput && user?.email) emailInput.value = user.email;

    const signedIn = Boolean(user);
    if (loginEmail) loginEmail.hidden = signedIn;
    if (loginGoogle) loginGoogle.hidden = signedIn;
    if (logout) logout.hidden = !signedIn;
    if (syncBtn) {
      syncBtn.hidden = !(signedIn && queueLen > 0);
      const countEl = document.getElementById('hub-sync-count');
      if (countEl) countEl.textContent = String(queueLen);
    }

    if (window.lucide) lucide.createIcons({ nodes: [document.getElementById('connection-hub-card')].filter(Boolean) });
  }

  function _setStatus(kind, text) {
    const detail = document.getElementById('hub-status-detail');
    if (!detail) return;
    detail.textContent = text;
    detail.className = 'hub-status-detail' + (kind === 'error' ? ' is-error' : kind === 'ok' ? ' is-ok' : '');
  }

  function _translateAuthError(msg) {
    const lower = String(msg || '').toLowerCase();
    if (lower.includes('unauthorized-domain')) {
      return 'Este dominio no está autorizado en Firebase Auth. Añádelo en Consola → Authentication → Authorized domains.';
    }
    if (lower.includes('popup-closed') || lower.includes('cancelled-popup') || lower.includes('popup closed')) {
      return 'Autenticación cancelada.';
    }
    if (lower.includes('popup-blocked')) {
      return 'El navegador bloqueó la ventana. Se intentará redirección; permite ventanas emergentes si falla.';
    }
    if (lower.includes('account-exists-with-different')) {
      return 'Ese correo ya tiene cuenta con contraseña. Usa inicio de sesión con correo o vincula Google en Firebase.';
    }
    if (lower.includes('operation-not-allowed') || lower.includes('provider')) {
      return 'El proveedor Google no está habilitado. Actívalo en Firebase Console → Authentication → Sign-in method.';
    }
    if (lower.includes('user-not-found') || lower.includes('wrong-password') || lower.includes('invalid-credential')) {
      return 'Correo o contraseña no válidos.';
    }
    if (lower.includes('too-many-requests')) return 'Demasiados intentos. Espera unos minutos.';
    if (lower.includes('network') || lower.includes('unavailable')) return 'Sin conexión. Verifica tu red.';
    if (lower.includes('iframe') || lower.includes('csp') || lower.includes('content security')) {
      return 'El navegador bloqueó el marco de autenticación (CSP). Actualiza la app o revisa la política de seguridad.';
    }
    return msg || 'No se pudo iniciar sesión.';
  }

  async function _afterLoginSuccess() {
    _refreshUI();
    try {
      if (typeof API !== 'undefined') {
        await API.ping();
        await Promise.allSettled([
          API.obtenerPersonal?.(),
          API.obtenerConfiguracion?.(),
          API.syncOfflineQueue?.(),
        ]);
      }
    } catch (_e) { /* noop */ }
    _refreshUI();
    if (typeof window._initRealtimeSubscriptions === 'function') {
      window._teardownRealtimeSubscriptions?.();
      window._initRealtimeSubscriptions();
    }
  }

  async function _loginEmail() {
    const email = document.getElementById('hub-auth-email')?.value.trim();
    const password = document.getElementById('hub-auth-password')?.value || '';
    const btn = document.getElementById('hub-btn-login-email');

    if (!email) {
      Alerts.error('El correo es obligatorio.');
      return;
    }
    if (!password) {
      Alerts.error('La contraseña es obligatoria.');
      return;
    }

    if (btn) btn.disabled = true;
    _setStatus('', 'Autenticando…');
    try {
      const result = await FirebaseClient.signInWithEmail(email, password);
      if (!result.success) throw new Error(result.error || result.code || 'Credenciales rechazadas');
      const pwd = document.getElementById('hub-auth-password');
      if (pwd) pwd.value = '';
      Alerts.success('Sesión iniciada.');
      await _afterLoginSuccess();
    } catch (err) {
      const msg = _translateAuthError(err.message || err.code || '');
      _setStatus('error', msg);
      Alerts.error(msg, 'Autenticación');
    } finally {
      if (btn) btn.disabled = false;
      _refreshUI();
    }
  }

  async function _loginGoogle() {
    const btn = document.getElementById('hub-btn-login-google');
    if (btn) btn.disabled = true;
    _setStatus('', 'Esperando Google…');
    try {
      const result = await FirebaseClient.signInWithGoogle();
      if (result.redirecting) {
        _setStatus('', 'Redirigiendo a Google…');
        return;
      }
      if (!result.success) {
        const code = String(result.code || '').toLowerCase();
        if (code.includes('popup-closed') || code.includes('cancelled')) {
          _setStatus('', 'Autenticación cancelada.');
          return;
        }
        const msg = _translateAuthError(result.code || result.error || '');
        _setStatus('error', msg);
        Alerts.error(msg, 'Google');
        return;
      }
      Alerts.success('Sesión de Google iniciada.');
      await _afterLoginSuccess();
    } catch (err) {
      const msg = _translateAuthError(err.message || err.code || '');
      _setStatus('error', msg);
      Alerts.error(msg, 'Google');
    } finally {
      if (btn) btn.disabled = false;
      _refreshUI();
    }
  }

  async function _logout() {
    const btn = document.getElementById('hub-btn-logout');
    if (btn) btn.disabled = true;
    try {
      window._teardownRealtimeSubscriptions?.();
      await FirebaseClient.signOut();
      Alerts.success('Sesión cerrada. Modo local activo.');
    } finally {
      if (btn) btn.disabled = false;
      _refreshUI();
    }
  }

  async function _connectFirestore() {
    const btn = document.getElementById('hub-btn-connect');
    if (btn) btn.disabled = true;
    const config = {
      ...FirebaseClient.getConfig(),
      projectId: document.getElementById('hub-firebase-project-id')?.value.trim(),
      apiKey: document.getElementById('hub-firebase-api-key')?.value.trim(),
      authDomain: document.getElementById('hub-firebase-auth-domain')?.value.trim(),
      appId: document.getElementById('hub-firebase-app-id')?.value.trim(),
    };
    const validation = window.validateFirebaseConfig
      ? window.validateFirebaseConfig(config)
      : { valid: true };
    if (!validation.valid || !FirebaseClient.isConfigured(config)) {
      Alerts.error(validation.error || 'Completa Project ID, API Key, Auth Domain y App ID.');
      if (btn) btn.disabled = false;
      return;
    }
    _setStatus('', 'Conectando con Firestore…');
    try {
      const result = await FirebaseClient.configure(config);
      if (!result.success) {
        _setStatus('error', result.error || 'No se pudo conectar');
        Alerts.error(result.error || 'No se pudo conectar con Firestore.');
        return;
      }
      if (FirebaseClient.getCurrentUser()) {
        Alerts.success('Firestore configurado. Sesión activa.');
        await _afterLoginSuccess();
      } else {
        Alerts.info('Configuración guardada. Inicia sesión para escribir en la nube.');
      }
    } catch (err) {
      _setStatus('error', err.message);
      Alerts.error(err.message);
    } finally {
      if (btn) btn.disabled = false;
      _refreshUI();
    }
  }

  function _useLocal() {
    window._teardownRealtimeSubscriptions?.();
    FirebaseClient.stop();
    Alerts.success('Modo local: datos solo en este dispositivo.');
    _refreshUI();
    _setStatus('', 'Modo local activo en este dispositivo.');
  }

  async function _syncNow() {
    const btn = document.getElementById('hub-btn-sync');
    if (btn) btn.disabled = true;
    try {
      const result = await API.syncOfflineQueue();
      if (result.enviadas > 0) {
        Alerts.success(`${result.enviadas} operación(es) sincronizada(s).`);
      } else if (result.needsAuth) {
        Alerts.warning('Inicia sesión para sincronizar la cola pendiente.');
      } else if (result.errores > 0) {
        Alerts.warning(`${result.errores} ítem(s) no pudieron sincronizarse.`);
      } else {
        Alerts.info('No hay pendientes.');
      }
    } catch (err) {
      Alerts.error(err.message, 'Sync');
    } finally {
      if (btn) btn.disabled = false;
      _refreshUI();
    }
  }

  // Escuchar cambios de cola / conexión para badge sync
  if (typeof window !== 'undefined' && window.AppState) {
    AppState.on?.('offlineQueue', () => _refreshUI());
    AppState.on?.('connected', () => _refreshUI());
    AppState.on?.('backendMode', () => _refreshUI());
  }

  return { init, cargar, cleanup, refresh: _refreshUI };
})();

window.ConnectionHub = ConnectionHub;
