/**
 * MÓDULO DE CLEANUP - Previene memory leaks por event listeners
 * CONTROL PERSONAL CAMPO v1.5.1
 * 
 * Uso:
 * - Al iniciar un módulo: ModuleCleanup.start('dashboard')
 * - Al salir del módulo: ModuleCleanup.cleanup('dashboard')
 * - Limpia automáticamente todos los listeners agregados
 */

(() => {
  'use strict';

  const listeners = new Map(); // { moduleName: { element, event, handler }[] }

  const ModuleCleanup = {
    /**
     * Registra que un módulo está activo
     * @param {string} moduleName - Nombre único del módulo
     */
    start(moduleName) {
      if (!listeners.has(moduleName)) {
        listeners.set(moduleName, []);
      }
      console.log(`[ModuleCleanup] Iniciado: ${moduleName}`);
    },

    /**
     * Agrega un listener que será limpiado automáticamente
     * @param {string} moduleName - Nombre del módulo
     * @param {Element|Document|Window} element - Elemento a escuchar
     * @param {string} event - Nombre del evento (e.g., 'click', 'keydown')
     * @param {Function} handler - Función manejadora
     * @param {Object} options - Opciones del listener
     */
    addEventListener(moduleName, element, event, handler, options = false) {
      if (!listeners.has(moduleName)) {
        listeners.set(moduleName, []);
      }

      // Registrar el listener para limpieza posterior
      const record = { element, event, handler, options };
      listeners.get(moduleName).push(record);

      // Agregar listener real
      element.addEventListener(event, handler, options);
    },

    /**
     * Limpia todos los listeners del módulo
     * @param {string} moduleName - Nombre del módulo
     */
    cleanup(moduleName) {
      if (!listeners.has(moduleName)) {
        console.warn(`[ModuleCleanup] No existe: ${moduleName}`);
        return;
      }

      const moduleListeners = listeners.get(moduleName);
      let removed = 0;

      moduleListeners.forEach(({ element, event, handler, options }) => {
        try {
          element.removeEventListener(event, handler, options);
          removed++;
        } catch (error) {
          console.warn(`[ModuleCleanup] Error removiendo listener: ${event}`, error);
        }
      });

      listeners.delete(moduleName);
      console.log(`[ModuleCleanup] Limpiado ${moduleName}: ${removed} listeners removidos`);
    },

    /**
     * Retorna los listeners activos de un módulo (para debugging)
     */
    getListeners(moduleName) {
      return listeners.get(moduleName) || [];
    },

    /**
     * Retorna el estado de todos los módulos
     */
    getStatus() {
      const status = {};
      for (const [moduleName, moduleListeners] of listeners) {
        status[moduleName] = moduleListeners.length;
      }
      return status;
    },

    /**
     * Limpia TODOS los listeners (emergencia/logout)
     */
    cleanupAll() {
      const moduleNames = Array.from(listeners.keys());
      moduleNames.forEach((name) => this.cleanup(name));
      console.log('[ModuleCleanup] Todos los módulos limpiados');
    },
  };

  // Exportar globalmente
  window.ModuleCleanup = ModuleCleanup;

  // Limpiar automáticamente cuando el usuario cambia de página
  const router = window.ModuloDashboard || {};
  const originalNavigate = router.navigate;
  
  if (originalNavigate && typeof originalNavigate === 'function') {
    router.navigate = function (moduleName) {
      // Limpiar módulo anterior
      const currentModule = this.currentModule;
      if (currentModule && currentModule !== moduleName) {
        ModuleCleanup.cleanup(currentModule);
      }

      // Iniciar nuevo módulo
      ModuleCleanup.start(moduleName);
      this.currentModule = moduleName;

      // Llamar original
      return originalNavigate.call(this, moduleName);
    };
  }
})();
