/**
 * CONTROL PERSONAL CAMPO — modules/auth.js
 * Módulo de autenticación SaaS multi-tenant
 * Permite registro con Google o Email/Password para cualquier usuario
 * @version 1.0.0
 */

const ModuloAuth = (() => {
  let _eventsBound = false;
  let _currentUser = null;

  function init() {
    _bindEvents();
    _checkAuthState();
  }

  function _bindEvents() {
    if (_eventsBound) return;
    _eventsBound = true;

    // Botón Google Sign-In
    const btnGoogle = document.getElementById('hub-btn-login-google');
    if (btnGoogle) {
      btnGoogle.addEventListener('click', _handleGoogleLogin);
    }

    // Botón Email Register
    const btnRegister = document.getElementById('hub-btn-register-email');
    if (btnRegister) {
      btnRegister.addEventListener('click', _showEmailModal);
    }

    // Botón Email Login
    const btnEmailLogin = document.getElementById('hub-btn-login-email');
    if (btnEmailLogin) {
      btnEmailLogin.addEventListener('click', _handleEmailLogin);
    }

    // Botón Logout
    const btnLogout = document.getElementById('hub-btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', _handleLogout);
    }

    // Formulario de Registro
    const btnSubmitRegister = document.getElementById('btn-submit-register');
    if (btnSubmitRegister) {
      btnSubmitRegister.addEventListener('click', _handleRegister);
    }

    const btnCancelRegister = document.getElementById('btn-cancel-register');
    if (btnCancelRegister) {
      btnCancelRegister.addEventListener('click', _hideRegisterModal);
    }

    // Cerrar modal con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        _hideRegisterModal();
      }
    });

    // Cerrar modal al hacer click fuera
    const modalRegister = document.getElementById('modal-register');
    if (modalRegister) {
      modalRegister.addEventListener('click', (e) => {
        if (e.target === modalRegister) {
          _hideRegisterModal();
        }
      });
    }
  }

  function _checkAuthState() {
    // Esperar a que FirebaseAuth esté disponible
    const checkInterval = setInterval(() => {
      if (window.firebaseAuth) {
        clearInterval(checkInterval);
        
        window.firebaseAuthMethods.onAuthStateChanged(window.firebaseAuth, (user) => {
          if (user) {
            _currentUser = user;
            _showAuthenticatedState(user);
            _loadUserData(user);
          } else {
            _currentUser = null;
            _showUnauthenticatedState();
          }
        });
      }
    }, 100);
  }

  async function _handleGoogleLogin() {
    try {
      const loader = Alerts.loading('Iniciando sesión con Google...');
      
      const result = await window.FirebaseClient.signInWithGoogle();
      loader.close();

      if (result.success) {
        Alerts.success('¡Bienvenido! Has iniciado sesión con Google');
        _loadUserData(result.user);
      } else {
        Alerts.error('Error al iniciar sesión con Google');
      }
    } catch (error) {
      Alerts.error('Error al iniciar sesión con Google: ' + error.message);
      console.error('[Auth] Google login error:', error);
    }
  }

  async function _handleEmailLogin() {
    const email = document.getElementById('hub-auth-email').value.trim();
    const password = document.getElementById('hub-auth-password').value;

    if (!email || !password) {
      Alerts.error('Ingresa tu correo y contraseña');
      return;
    }

    try {
      const loader = Alerts.loading('Iniciando sesión...');
      
      const result = await window.FirebaseClient.signInWithEmail(email, password);
      loader.close();

      if (result.success) {
        Alerts.success('¡Bienvenido de nuevo!');
        _loadUserData(result.user);
      } else {
        Alerts.error('Error al iniciar sesión: ' + (result.error || 'Credenciales inválidas'));
      }
    } catch (error) {
      Alerts.error('Error al iniciar sesión: ' + error.message);
      console.error('[Auth] Email login error:', error);
    }
  }

  function _showEmailModal() {
    const modal = document.getElementById('modal-register');
    if (modal) {
      modal.classList.remove('hidden');
      document.getElementById('reg-nombre').focus();
    }
  }

  function _hideRegisterModal() {
    const modal = document.getElementById('modal-register');
    if (modal) {
      modal.classList.add('hidden');
      // Limpiar formulario
      document.getElementById('reg-nombre').value = '';
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-password').value = '';
      document.getElementById('reg-password-confirm').value = '';
    }
  }

  async function _handleRegister() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    // Validaciones
    if (!nombre || nombre.length < 2) {
      Alerts.error('El nombre debe tener al menos 2 caracteres');
      return;
    }

    if (!email || !email.includes('@') || !email.includes('.')) {
      Alerts.error('Ingresa un correo electrónico válido');
      return;
    }

    if (!password || password.length < 6) {
      Alerts.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== passwordConfirm) {
      Alerts.error('Las contraseñas no coinciden');
      return;
    }

    try {
      const loader = Alerts.loading('Registrando cuenta...');
      
      const result = await window.FirebaseClient.registerUser(email, password, nombre);
      loader.close();

      if (result.success) {
        Alerts.success('¡Cuenta creada exitosamente! Bienvenido ' + result.user.displayName);
        _hideRegisterModal();
        _loadUserData(result.user);
      } else {
        Alerts.error('Error al crear cuenta');
      }
    } catch (error) {
      Alerts.error('Error al crear cuenta: ' + error.message);
      console.error('[Auth] Register error:', error);
    }
  }

  async function _handleLogout() {
    try {
      const loader = Alerts.loading('Cerrando sesión...');
      
      await window.FirebaseClient.signOut();
      loader.close();
      
      Alerts.success('Has cerrado sesión correctamente');
      _showUnauthenticatedState();
      
      // Limpiar datos locales
      AppState.set('personal', []);
      AppState.set('asistencias', []);
      
      // Refrescar UI
      if (window.ModuloPersonal) window.ModuloPersonal.cargar();
      if (window.ModuloDashboard) window.ModuloDashboard.cargar();
    } catch (error) {
      Alerts.error('Error al cerrar sesión: ' + error.message);
      console.error('[Auth] Logout error:', error);
    }
  }

  function _showAuthenticatedState(user) {
    // Ocultar botones de login
    const authButtons = document.getElementById('auth-buttons');
    if (authButtons) authButtons.classList.add('hidden');
    
    // Mostrar info de usuario
    const authStatus = document.getElementById('auth-status');
    if (authStatus) authStatus.classList.remove('hidden');
    
    // Mostrar datos del usuario
    const userEmail = document.getElementById('user-email');
    const userDisplayName = document.getElementById('user-display-name');
    
    if (userEmail) userEmail.textContent = user.email;
    if (userDisplayName) userDisplayName.textContent = user.displayName || '';
    
    // Actualizar badge de conexión
    const badge = document.querySelector('.connection-badge');
    if (badge) {
      badge.textContent = 'Conectado';
      badge.classList.add('connected');
      badge.classList.remove('local-mode');
    }

    // Actualizar estado en connection hub
    const hubStatusChip = document.getElementById('hub-status-chip');
    if (hubStatusChip) {
      hubStatusChip.textContent = 'Conectado';
      hubStatusChip.classList.remove('hub-chip--local');
      hubStatusChip.classList.add('hub-chip--cloud');
    }

    const hubStatusDetail = document.getElementById('hub-status-detail');
    if (hubStatusDetail) {
      hubStatusDetail.textContent = 'Sincronizado con Firebase';
    }
  }

  function _showUnauthenticatedState() {
    // Mostrar botones de login
    const authButtons = document.getElementById('auth-buttons');
    if (authButtons) authButtons.classList.remove('hidden');
    
    // Ocultar info de usuario
    const authStatus = document.getElementById('auth-status');
    if (authStatus) authStatus.classList.add('hidden');
    
    // Actualizar badge de conexión
    const badge = document.querySelector('.connection-badge');
    if (badge) {
      badge.textContent = 'Modo local';
      badge.classList.remove('connected');
      badge.classList.add('local-mode');
    }

    // Actualizar estado en connection hub
    const hubStatusChip = document.getElementById('hub-status-chip');
    if (hubStatusChip) {
      hubStatusChip.textContent = 'Local';
      hubStatusChip.classList.add('hub-chip--local');
      hubStatusChip.classList.remove('hub-chip--cloud');
    }

    const hubStatusDetail = document.getElementById('hub-status-detail');
    if (hubStatusDetail) {
      hubStatusDetail.textContent = 'Modo local — datos en este dispositivo';
    }
  }

  async function _loadUserData(user) {
    try {
      console.log('[Auth] Cargando datos del usuario:', user.uid);
      
      // Cargar datos del usuario desde Firestore (ahora en espacio multi-tenant)
      const personal = await window.API.obtenerPersonal();
      AppState.set('personal', personal.data || []);
      
      const config = await window.API.obtenerConfiguracion();
      AppState.set('config', config.data || {});
      
      // Refrescar UI
      if (window.ModuloPersonal) window.ModuloPersonal.cargar();
      if (window.ModuloDashboard) window.ModuloDashboard.cargar();
      
      console.log('[Auth] Datos cargados exitosamente');
    } catch (error) {
      console.error('[Auth] Error cargando datos del usuario:', error);
      Alerts.warning('Error cargando datos. Puedes trabajar en modo local.');
    }
  }

  // Funciones públicas
  return {
    init,
    getCurrentUser: () => _currentUser,
    isAuthenticated: () => _currentUser !== null,
    checkAuthState: _checkAuthState,
    showAuthenticatedState: _showAuthenticatedState,
    showUnauthenticatedState: _showUnauthenticatedState,
  };
})();

// Exponer globalmente
window.ModuloAuth = ModuloAuth;