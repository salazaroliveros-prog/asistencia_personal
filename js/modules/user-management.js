/**
 * CONTROL PERSONAL CAMPO — modules/user-management.js
 * Módulo de gestión de usuarios y roles mediante Firebase Custom Claims
 * @version 1.0.0
 */

const UserManagement = (() => {
  
  // ─── Estado del módulo ────────────────────────────────────────────────────
  let currentUserClaims = null;
  let usersList = [];
  
  // ─── Inicialización ───────────────────────────────────────────────────────
  function init() {
    _bindEvents();
    _checkCurrentUserClaims();
  }
  
  // ─── Eventos ─────────────────────────────────────────────────────────────
  function _bindEvents() {
    const btnCheckClaims = document.getElementById('btn-check-claims');
    const btnLoadUsers = document.getElementById('btn-load-users');
    const btnCreateUser = document.getElementById('btn-create-user');
    
    if (btnCheckClaims) {
      btnCheckClaims.addEventListener('click', _checkCurrentUserClaims);
    }
    
    if (btnLoadUsers) {
      btnLoadUsers.addEventListener('click', _loadUsers);
    }
    
    if (btnCreateUser) {
      btnCreateUser.addEventListener('click', _showCreateUserModal);
    }
  }
  
  // ─── Verificar claims del usuario actual ─────────────────────────────────
  async function _checkCurrentUserClaims() {
    try {
      // Para plan gratuito, cualquier usuario autenticado es considerado admin
      const auth = window.firebase.auth();
      const user = auth.currentUser;
      
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        const isAdmin = true; // Plan gratuito: todos los usuarios autenticados son admin
        
        currentUserClaims = {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          customClaims: { admin: true },
          isAdmin: isAdmin
        };
        
        _updateUserClaimsUI(currentUserClaims);
        
        // Habilitar botón de gestión de usuarios para plan gratuito
        const btnLoadUsers = document.getElementById('btn-load-users');
        if (btnLoadUsers) {
          btnLoadUsers.disabled = false;
        }
        
        Alerts.success('Permisos verificados (Plan gratuito: acceso completo)');
      } else {
        Alerts.warning('Usuario no autenticado');
      }
    } catch (error) {
      console.error('[UserManagement] Error checking claims:', error);
      Alerts.error('Error al verificar permisos: ' + error.message);
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
  
  // ─── Renderizar tabla de usuarios ─────────────────────────────────────────
  function _renderUsersTable(users) {
    const container = document.getElementById('users-table-container');
    if (!container) return;
    
    if (!users || users.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="users" aria-hidden="true"></i>
          <p>No hay usuarios registrados</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }
    
    const html = `
      <table class="users-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>UID</th>
            <th>Rol</th>
            <th>Email Verificado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${user.email || 'Anónimo'}</td>
              <td><code>${user.uid.substring(0, 8)}...</code></td>
              <td>
                <span class="badge ${user.isAdmin ? 'badge-green' : 'badge-gray'}">
                  ${user.isAdmin ? 'Admin' : 'Usuario'}
                </span>
              </td>
              <td>
                <span class="badge ${user.emailVerified ? 'badge-green' : 'badge-red'}">
                  ${user.emailVerified ? 'Sí' : 'No'}
                </span>
              </td>
              <td>
                <div class="user-actions">
                  <button type="button" class="btn btn-sm btn-secondary" 
                          onclick="UserManagement.toggleAdmin('${user.uid}', ${!user.isAdmin})">
                    ${user.isAdmin ? 'Quitar Admin' : 'Hacer Admin'}
                  </button>
                  <button type="button" class="btn btn-sm btn-danger" 
                          onclick="UserManagement.deleteUser('${user.uid}')">
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }
  
  // ─── Toggle admin role ─────────────────────────────────────────────────────
  async function toggleAdmin(uid, makeAdmin) {
    if (!currentUserClaims || !currentUserClaims.isAdmin) {
      Alerts.error('Solo administradores pueden cambiar roles');
      return;
    }
    
    try {
      const confirmMessage = makeAdmin 
        ? '¿Estás seguro de hacer administrador a este usuario?' 
        : '¿Estás seguro de quitar el rol de administrador a este usuario?';
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      Alerts.info('Cambiando rol de usuario...');
      
      const result = await window.FunctionsClient.setAdminClaim(uid, makeAdmin);
      
      if (result.success) {
        Alerts.success(result.message || 'Rol cambiado exitosamente');
        
        // Forzar refresh token para aplicar cambios
        if (window.firebase && window.firebase.auth()) {
          try {
            await window.firebase.auth().currentUser.getIdToken(true);
          } catch (e) {
            console.warn('[UserManagement] Error refreshing token:', e);
          }
        }
        
        // Recargar lista de usuarios
        await _loadUsers();
        
        // Recargar claims del usuario actual si es el mismo
        if (uid === currentUserClaims.uid) {
          await _checkCurrentUserClaims();
        }
      } else {
        Alerts.error('Error al cambiar rol: ' + (result.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('[UserManagement] Error toggling admin:', error);
      Alerts.error('Error al cambiar rol: ' + error.message);
    }
  }
  
  // ─── Eliminar usuario ───────────────────────────────────────────────────────
  async function deleteUser(uid) {
    if (!currentUserClaims || !currentUserClaims.isAdmin) {
      Alerts.error('Solo administradores pueden eliminar usuarios');
      return;
    }
    
    // Prevenir eliminación del propio usuario
    if (uid === currentUserClaims.uid) {
      Alerts.error('No puedes eliminar tu propio usuario');
      return;
    }
    
    try {
      if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
        return;
      }
      
      Alerts.info('Eliminando usuario...');
      
      const result = await window.FunctionsClient.deleteUser(uid);
      
      if (result.success) {
        Alerts.success('Usuario eliminado exitosamente');
        await _loadUsers(); // Recargar lista
      } else {
        Alerts.error('Error al eliminar usuario: ' + (result.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('[UserManagement] Error deleting user:', error);
      Alerts.error('Error al eliminar usuario: ' + error.message);
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
    toggleAdmin,
    deleteUser,
    checkClaims: _checkCurrentUserClaims
  };
})();

// Exponer para uso global
window.UserManagement = UserManagement;