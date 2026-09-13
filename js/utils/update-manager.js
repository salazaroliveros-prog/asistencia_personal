/**
 * UPDATE MANAGER - js/utils/update-manager.js
 * Gestiona la detección y notificación de actualizaciones del service worker
 * Notifica al usuario cuando hay una nueva versión disponible y permite actualizar
 * @version 1.0.0
 */

const UpdateManager = (() => {
  let _registration = null;
  let _deferredPrompt = null;
  let _updateAvailable = false;
  let _dismissedUntil = null;

  /**
   * Inicializar el gestor de actualizaciones
   */
  function init() {
    if (!('serviceWorker' in navigator)) {
      console.log('[UpdateManager] Service Worker no soportado');
      return;
    }

    // Verificar si el usuario cerró la notificación recientemente
    const dismissedUntil = localStorage.getItem('updateDismissedUntil');
    if (dismissedUntil) {
      _dismissedUntil = new Date(dismissedUntil);
      if (new Date() < _dismissedUntil) {
        console.log('[UpdateManager] Notificación descartada temporalmente');
        return;
      }
    }

    // Registrar service worker
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        _registration = registration;
        console.log('[UpdateManager] Service Worker registrado:', registration.scope);

        // Verificar actualizaciones periódicamente
        setInterval(() => {
          checkForUpdates();
        }, 5 * 60 * 1000); // Cada 5 minutos

        // Escuchar cambios de servicio worker
        registration.addEventListener('updatefound', handleUpdateFound);
        
        // Escuchar mensajes del service worker
        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      })
      .catch(error => {
        console.error('[UpdateManager] Error registrando Service Worker:', error);
      });

    // Bind eventos de UI
    _bindEvents();
  }

  /**
   * Manejar el evento de actualización encontrada
   */
  function handleUpdateFound() {
    console.log('[UpdateManager] Nueva versión del Service Worker encontrada');
    
    const newWorker = _registration.installing;
    
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // El nuevo service worker está instalado pero esperando
        console.log('[UpdateManager] Nueva versión disponible, esperando activación');
        _updateAvailable = true;
        showUpdateBanner();
      }
    });
  }

  /**
   * Manejar mensajes del service worker
   */
  function handleServiceWorkerMessage(event) {
    if (event.data && event.data.type === 'NEW_VERSION_AVAILABLE') {
      console.log('[UpdateManager] Service Worker indica nueva versión disponible');
      _updateAvailable = true;
      showUpdateBanner();
    }
  }

  /**
   * Verificar manualmente si hay actualizaciones
   */
  function checkForUpdates() {
    if (_registration) {
      _registration.update()
        .then(() => {
          console.log('[UpdateManager] Verificación de actualización completada');
        })
        .catch(error => {
          console.error('[UpdateManager] Error verificando actualización:', error);
        });
    }
  }

  /**
   * Mostrar el banner de actualización
   */
  function showUpdateBanner() {
    // No mostrar si ya está visible
    const banner = document.getElementById('update-banner');
    if (!banner || !banner.hidden) return;

    // No mostrar si el usuario cerró recientemente
    if (_dismissedUntil && new Date() < _dismissedUntil) return;

    // Mostrar banner
    banner.hidden = false;
    
    // Actualizar iconos
    if (window.lucide) {
      lucide.createIcons({ nodes: [banner] });
    }

    // Log
    if (window.Logger) {
      window.Logger.info('UpdateManager', 'Nueva versión disponible, mostrando notificación');
    }
  }

  /**
   * Ocultar el banner de actualización
   */
  function hideUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) {
      banner.hidden = true;
    }
  }

  /**
   * Aplicar la actualización (recargar página)
   */
  function applyUpdate() {
    console.log('[UpdateManager] Aplicando actualización...');
    
    // Enviar mensaje al service worker para que active la nueva versión
    if (_registration && _registration.waiting) {
      _registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Recargar la página después de un breve delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  /**
   * Descartar la notificación temporalmente
   */
  function dismissUpdate() {
    console.log('[UpdateManager] Descartando notificación temporalmente');
    
    // Ocultar banner
    hideUpdateBanner();
    
    // Guardar timestamp para no mostrar por 1 hora
    const dismissedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    localStorage.setItem('updateDismissedUntil', dismissedUntil.toISOString());
    _dismissedUntil = dismissedUntil;
  }

  /**
   * Bind eventos de UI
   */
  function _bindEvents() {
    const updateBtn = document.getElementById('update-btn');
    const updateDismiss = document.getElementById('update-dismiss');

    if (updateBtn) {
      updateBtn.addEventListener('click', applyUpdate);
    }

    if (updateDismiss) {
      updateDismiss.addEventListener('click', dismissUpdate);
    }
  }

  /**
   * API pública
   */
  return {
    init,
    checkForUpdates,
    showUpdateBanner,
    hideUpdateBanner,
    applyUpdate,
    dismissUpdate
  };
})();

// Exponer globalmente
if (typeof window !== 'undefined') {
  window.UpdateManager = UpdateManager;
}