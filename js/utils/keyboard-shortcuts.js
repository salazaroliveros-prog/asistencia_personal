/**
 * CONTROL PERSONAL CAMPO — utils/keyboard-shortcuts.js
 * Sistema de atajos de teclado para mejorar productividad
 * @version 1.0.0
 */

const KeyboardShortcuts = (() => {
  
  const shortcuts = {
    'Alt+d': { action: 'navigate', page: 'dashboard', description: 'Ir a Dashboard' },
    'Alt+p': { action: 'navigate', page: 'personal', description: 'Ir a Personal' },
    'Alt+a': { action: 'navigate', page: 'asistencia', description: 'Ir a Asistencia' },
    'Alt+c': { action: 'navigate', page: 'campo', description: 'Ir a Campo' },
    'Alt+r': { action: 'navigate', page: 'reportes', description: 'Ir a Reportes' },
    'Alt+s': { action: 'navigate', page: 'ajustes', description: 'Ir a Ajustes' },
    'Alt+n': { action: 'new-worker', description: 'Nuevo trabajador' },
    'Alt+b': { action: 'backup', description: 'Crear backup' },
    'Alt+t': { action: 'theme', description: 'Cambiar tema' },
    'Escape': { action: 'close-modal', description: 'Cerrar modal actual' },
    'Ctrl+Shift+R': { action: 'refresh', description: 'Refrescar dashboard' }
  };
  
  function init() {
    if (window.Logger) {
      window.Logger.info('KeyboardShortcuts', 'Inicializando atajos de teclado');
    }
    _bindEvents();
    _showHelp();
  }
  
  function _bindEvents() {
    document.addEventListener('keydown', (e) => {
      const key = _getKeyCombo(e);
      const shortcut = shortcuts[key];
      
      if (shortcut) {
        e.preventDefault();
        _executeShortcut(shortcut);
      }
    });
  }
  
  function _getKeyCombo(event) {
    const keys = [];
    
    if (event.ctrlKey) keys.push('Ctrl');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');
    
    keys.push(event.key);
    
    return keys.join('+');
  }
  
  function _executeShortcut(shortcut) {
    if (window.Logger) {
      window.Logger.info('KeyboardShortcuts', 'Atajo ejecutado', { 
        action: shortcut.action 
      });
    }
    
    switch (shortcut.action) {
      case 'navigate':
        _navigateTo(shortcut.page);
        break;
      case 'new-worker':
        _openNewWorkerModal();
        break;
      case 'backup':
        if (window.BackupManager) {
          window.BackupManager._handleExportBackup();
        }
        break;
      case 'theme':
        if (window.ThemeManager) {
          window.ThemeManager.toggleTheme();
        }
        break;
      case 'close-modal':
        _closeCurrentModal();
        break;
      case 'refresh':
        if (window.ModuloDashboard) {
          window.ModuloDashboard.cargar();
        }
        break;
    }
  }
  
  function _navigateTo(page) {
    const navLink = document.querySelector(`[data-page="${page}"]`);
    if (navLink) {
      navLink.click();
    }
  }
  
  function _openNewWorkerModal() {
    const btnNuevo = document.getElementById('btn-nuevo-personal');
    if (btnNuevo) {
      btnNuevo.click();
    }
  }
  
  function _closeCurrentModal() {
    const activeModal = document.querySelector('.modal-overlay:not([hidden])');
    if (activeModal) {
      const closeBtn = activeModal.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.click();
      }
    }
  }
  
  function _showHelp() {
    const helpHTML = `
      <div id="keyboard-help" class="keyboard-help" style="display:none;">
        <div class="keyboard-help-content">
          <h3>Atajos de Teclado</h3>
          <ul>
            ${Object.entries(shortcuts).map(([key, shortcut]) => `
              <li><kbd>${key}</kbd> - ${shortcut.description}</li>
            `).join('')}
          </ul>
          <button id="close-help" class="btn btn-secondary">Cerrar</button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', helpHTML);
    
    const helpEl = document.getElementById('keyboard-help');
    const closeBtn = document.getElementById('close-help');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        helpEl.style.display = 'none';
      });
    }
    
    // Mostrar ayuda con Alt+?
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === '?') {
        e.preventDefault();
        helpEl.style.display = helpEl.style.display === 'none' ? 'block' : 'none';
      }
    });
  }
  
  function getShortcuts() {
    return shortcuts;
  }
  
  return {
    init,
    getShortcuts
  };
})();

if (typeof window !== 'undefined') {
  window.KeyboardShortcuts = KeyboardShortcuts;
}