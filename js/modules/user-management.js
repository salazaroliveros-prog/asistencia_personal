/**
 * CONTROL PERSONAL CAMPO — modules/user-management.js
 * Módulo de gestión de usuarios y roles mediante Firebase Custom Claims
 * @version 1.5.0
 */

const UserManagement = (() => {
  
  // ─── Estado del módulo ────────────────────────────────────────────────────
  let currentUserClaims = null;
  
  // ─── Inicialización ───────────────────────────────────────────────────────
  let _unsubConnection = null;

  function init() {
    _bindEvents();
    // Arranque silencioso: sin sesión / modo local es estado normal, no un error.
    _checkCurrentUserClaims({ silent: true });
    _watchConnectionForClaims();
  }

  /**
   * Cuando el cliente pasa a connected, reintenta leer claims una sola vez.
   * Evita el warn falso de "no está listo" en arranque offline/local.
   */
  function _watchConnectionForClaims() {
    if (!window.FirebaseClient || typeof window.FirebaseClient.onConnectionChange !== 'function') {
      return;
    }
    if (_unsubConnection) return;
    _unsubConnection = window.FirebaseClient.onConnectionChange((state) => {
      if (state === 'connected' || state === 'degraded') {
        _checkCurrentUserClaims({ silent: true });
      }
    });
  }
  
  // ─── Eventos ─────────────────────────────────────────────────────────────
  function _bindEvents() {
    const btnCheckClaims = document.getElementById('btn-check-claims');
    const btnLoadUsers = document.getElementById('btn-load-users');
    const btnCreateUser = document.getElementById('btn-create-user');
    
    if (btnCheckClaims) {
      btnCheckClaims.addEventListener('click', () => _checkCurrentUserClaims({ silent: false }));
    }
    
    if (btnLoadUsers) {
      btnLoadUsers.addEventListener('click', _loadUsers);
    }
    
    if (btnCreateUser) {
      btnCreateUser.addEventListener('click', _showCreateUserModal);
    }
  }
  
  // ─── Verificar claims del usuario actual ─────────────────────────────────
  async function _checkCurrentUserClaims(options) {
    const silent = !!(options && options.silent);
    try {
      // Usar FirebaseClient como puerta de acceso a Auth en lugar de
      // llamar window.firebase.auth() directamente, que falla si Firebase
      // App aún no fue inicializada.
      if (!window.FirebaseClient) {
        if (!silent) {
          console.warn('[UserManagement] FirebaseClient no disponible');
          Alerts.warning('Cliente Firebase no disponible');
        }
        return;
      }

      // isReady() es false en 'disconnected' (modo local sin sesión): no es un error.
      if (!window.FirebaseClient.isReady()) {
        if (!silent) {
          Alerts.warning('Conecta e inicia sesión en Firebase para verificar permisos.');
        }
        return;
      }

      const user = window.FirebaseClient.getCurrentUser();
      
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        const isAdmin = idTokenResult.claims.admin === true;
        
        currentUserClaims = {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          customClaims: idTokenResult.claims,
          isAdmin: isAdmin,
        };
        
        _updateUserClaimsUI(currentUserClaims);
        
        // La interfaz no eleva privilegios: solo refleja el claim firmado.
        const btnLoadUsers = document.getElementById('btn-load-users');
        if (btnLoadUsers) {
          btnLoadUsers.disabled = !isAdmin;
        }
        if (!silent) {
          Alerts.info(isAdmin ? 'Permisos de administrador verificados.' : 'Sesión autenticada sin permisos de administrador.');
        }
      } else if (!silent) {
        Alerts.warning('Usuario no autenticado');
      }
    } catch (error) {
      console.error('[UserManagement] Error checking claims:', error);
      if (!silent) {
        Alerts.error('Error al verificar permisos: ' + error.message);
      }
    }
  }
  
  // ─── Actualizar UI de claims del usuario ───────────────────────────────────
  function _updateUserClaimsUI(claims) {
    const roleElement = document.getElementById('current-user-role');
    const emailElement = document.getElementById('current-user-email');
    const uidElement = document.getElementById('current-user-uid');
    
    if (roleElement) {
      roleElement.textContent = claims.isAdmin ? 'Administrador' : 'Usuario Regular';
      roleElement.className = claims.isAdmin ? 'admin' : 'user';
    }
    
    if (emailElement) {
      emailElement.textContent = claims.email || 'Anónimo';
    }
    
    if (uidElement) {
      uidElement.textContent = claims.uid || '--';
    }
  }
  
  // ─── Cargar lista de usuarios ─────────────────────────────────────────────
  async function _loadUsers() {
    // Para plan gratuito, mostramos un mensaje informativo
    Alerts.info('Función de gestión de usuarios limitada en plan gratuito. La autenticación anónima no permite listar usuarios sin Cloud Functions (plan Blaze).');
    
    const container = document.getElementById('users-table-container');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="info" aria-hidden="true"></i>
          <p><strong>Plan Gratuito Firebase</strong></p>
          <p>La gestión detallada de usuarios requiere Cloud Functions (plan Blaze).</p>
          <p>En plan gratuito, cualquier usuario autenticado tiene acceso completo a las funciones de administrador.</p>
          <p><em>Para gestión completa de usuarios, actualiza a plan Blaze y despliega las Cloud Functions.</em></p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }
    
    // Mostrar contenedor de gestión
    const managementContainer = document.getElementById('users-management-container');
    if (managementContainer) {
      managementContainer.hidden = false;
    }
  }
  
  // ─── Mostrar modal para crear usuario ───────────────────────────────────────
  function _showCreateUserModal() {
    if (!currentUserClaims || !currentUserClaims.isAdmin) {
      Alerts.error('Solo administradores pueden crear usuarios');
      return;
    }
    
    // Aquí se podría implementar un modal para crear usuarios
    // Por ahora, mostramos un mensaje informativo
    Alerts.info('Función de crear usuario disponible en próxima versión. Por ahora, usa Firebase Console para crear usuarios.');
  }

  // ─── Exportar funciones públicas ───────────────────────────────────────────
  return {
    init,
    checkClaims: _checkCurrentUserClaims,
  };
})();

// Exponer para uso global
window.UserManagement = UserManagement;
