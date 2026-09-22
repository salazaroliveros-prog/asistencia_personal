/**
 * CONTROL PERSONAL CAMPO — utils/keyboard-shortcuts.js
 * Sistema de atajos de teclado para mejorar productividad
 * @version 1.5.0
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
    'Ctrl+Shift+R': { action: 'refresh', description: 'Refrescar dashboard' },
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
      
      if (!shortcut) return;

      // Escape: si no hay nada que cerrar, no se intercepta la tecla para no
      // bloquear el comportamiento nativo del navegador (salir de pantalla
      // completa, cerrar diálogos nativos, etc.).
      if (shortcut.action === 'close-modal'
          && !document.querySelector('.modal-overlay:not([hidden]), .keyboard-help:not([hidden])')) {
        return;
      }

      // No interceptar atajos mientras se escribe en un campo (salvo Escape)
      const tag = (e.target && e.target.tagName) || '';
      const isTextField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
        || (e.target && e.target.isContentEditable);
      if (isTextField && shortcut.action !== 'close-modal') return;

      e.preventDefault();
      _executeShortcut(shortcut);
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
        action: shortcut.action, 
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
    // Prioridad: la ayuda de atajos (se apila por encima de los modales)
    const help = document.querySelector('.keyboard-help:not([hidden])');
    if (help) { help.hidden = true; return; }

    const activeModal = document.querySelector('.modal-overlay:not([hidden])');
    if (activeModal) {
      const closeBtn = activeModal.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.click();
      }
    }
  }
  
  /**
   * Crea el panel de ayuda de atajos.
   *
   * Corrección: antes se ocultaba con `style.display = 'none'` y se mostraba con
   * `style.display = 'block'`. Ese estilo en línea anulaba el layout flex del
   * componente (el diálogo aparecía desalineado) y además el panel no declaraba
   * rol de diálogo. Ahora se controla con el atributo `hidden`, se cierra con
   * Escape o clic en el fondo, y anuncia su propósito a lectores de pantalla.
   */
  function _showHelp() {
    if (document.getElementById('keyboard-help')) return; // evita duplicados

    const helpHTML = `
      <div id="keyboard-help" class="keyboard-help" role="dialog" aria-modal="true"
           aria-labelledby="keyboard-help-title" hidden>
        <div class="keyboard-help-content">
          <h3 id="keyboard-help-title">Atajos de teclado</h3>
          <ul>
            ${Object.entries(shortcuts).map(([key, shortcut]) => `
              <li><kbd>${key}</kbd> <span>${shortcut.description}</span></li>
            `).join('')}
          </ul>
          <button id="close-help" type="button" class="btn btn-secondary">Cerrar</button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', helpHTML);
    
    const helpEl = document.getElementById('keyboard-help');
    const closeBtn = document.getElementById('close-help');
    
    const setVisible = (visible) => {
      helpEl.hidden = !visible;
      if (visible) {
        closeBtn?.focus();
      } else {
        document.getElementById('menu-toggle')?.focus?.();
      }
    };

    closeBtn?.addEventListener('click', () => setVisible(false));

    // Clic en el fondo cierra el panel (no en el contenido)
    helpEl?.addEventListener('click', (e) => {
      if (e.target === helpEl) setVisible(false);
    });
    
    // Alt+? abre/cierra la ayuda (se acepta "/" para teclados donde "?" requiere Shift)
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        setVisible(helpEl.hidden);
      }
    });
  }
  
  return {
    init,
  };
})();

if (typeof window !== 'undefined') {
  window.KeyboardShortcuts = KeyboardShortcuts;
}