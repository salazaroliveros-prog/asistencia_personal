/**
 * UPDATE MANAGER - js/utils/update-manager.js
 * Gestiona la detección y notificación de actualizaciones del service worker
 * Notifica al usuario cuando hay una nueva versión disponible y permite actualizar
 * @version 1.5.0
 */

const UpdateManager = (() => {
  let _registration = null;
  const _deferredPrompt = null;
  let _updateAvailable = false;
  let _dismissedUntil = null;

  // Clave localStorage donde se guarda la última versión ya vista por el usuario.
  const VERSION_SEEN_KEY = 'cpc_app_version_seen';

  /**
   * Obtiene la versión del deploy actual servido por Vercel.
   * En producción se inyecta como window.__APP_VERSION__ durante el build
   * (scripts/inject-env.js) con el commit SHA del deploy. En desarrollo el
   * marcador no existe → devuelve '' y el chequeo por versión se ignora.
   * @returns {string}
   */
  function _getDeployedVersion() {
    return (typeof window !== 'undefined' && window.__APP_VERSION__) || '';
  }

  /**
   * Compara una versión remota contra la última vista por el usuario.
   * Si cambió → hay una nueva versión desplegada → muestra el banner.
   * Se graba la versión vista para no repetir la alerta en cada recarga.
   * @param {string} version
   */
  function _compareVersion(version) {
    if (!version) return;
    const seen = localStorage.getItem(VERSION_SEEN_KEY);
    if (seen && seen !== version) {
      _updateAvailable = true;
      showUpdateBanner();
    }
    try {
      localStorage.setItem(VERSION_SEEN_KEY, version);
    } catch (e) { /* ignorar quota/quota errors */ }
  }

  /**
   * Chequeo por marcador de versión del index.html ya cargado.
   * Detecta un deploy nuevo apenas se abre la app (el shell se sirve
   * Network-First por el service worker, así que index.html siempre trae
   * el marcador del deploy más reciente de Vercel).
   */
  function _checkVersionDeploy() {
    _compareVersion(_getDeployedVersion());
  }

  /**
   * Verifica en el servidor (sin cache) si ya hay un deploy más nuevo,
   * útil cuando el usuario deja la app abierta durante un deploy.
   */
  async function _checkRemoteVersion() {
    try {
      const res = await fetch(`${location.pathname || '/'}?__update_check=${Date.now()}`);
      const text = await res.text();
      const match = text.match(/window\.__APP_VERSION__\s*=\s*"([^"]+)"/);
      if (!match || !match[1]) return;
      _compareVersion(match[1]);
    } catch (_err) {
      // Sin conexión: no hay forma de saber si hay update; ignorar.
    }
  }

  /**
   * Inicializar el gestor de actualizaciones
   */
  function init() {
    // Detección por versión de deploy: corre siempre, incluso sin service worker.
    _checkVersionDeploy();

    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Verificar si el usuario cerró la notificación recientemente
    const dismissedUntil = localStorage.getItem('updateDismissedUntil');
    if (dismissedUntil) {
      _dismissedUntil = new Date(dismissedUntil);
      if (new Date() < _dismissedUntil) {
        return;
      }
    }

    // Registrar service worker
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        _registration = registration;

        // Verificar actualizaciones periódicamente (reducido de 5 a 15 minutos)
        setInterval(() => {
          checkForUpdates();
          _checkRemoteVersion();
        }, 15 * 60 * 1000); // Cada 15 minutos en lugar de 5

        // Escuchar cambios de servicio worker
        registration.addEventListener('updatefound', handleUpdateFound);
        
        // Escuchar mensajes del service worker
        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

        // Primer chequeo contra el servidor (detecta deploys mientras la app está abierta)
        _checkRemoteVersion();
      })
      .catch((error) => {
        console.error('[UpdateManager] Error registrando Service Worker:', error);
      });

    // Bind eventos de UI
    _bindEvents();
  }

  /**
   * Manejar el evento de actualización encontrada
   */
  function handleUpdateFound() {
    const newWorker = _registration.installing;
    
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // El nuevo service worker está instalado pero esperando
        // Solo mostrar si no se ha mostrado antes o se ha actualizado el dismissed
        if (!_updateAvailable) {
          _updateAvailable = true;
          showUpdateBanner();
        }
      }
    });
  }

  /**
   * Manejar mensajes del service worker
   */
  function handleServiceWorkerMessage(event) {
    if (event.data && event.data.type === 'NEW_VERSION_AVAILABLE') {
      _updateAvailable = true;
      showUpdateBanner();
    }
  }

  /**
   * Verificar manualmente si hay actualizaciones
   */
  function checkForUpdates() {
    if (_registration) {
      _registration.update().catch((error) => {
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
    // Resetear estado para evitar mostrar banner nuevamente después de recargar
    _updateAvailable = false;
    hideUpdateBanner();

    // Si el service worker ya descargó una nueva versión esperando, activarla.
    if (_registration && _registration.waiting) {
      _registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Detección por versión (deploy nuevo sin cambios en el SW): limpiar la
      // cache para que al recargar se sirvan los assets del deploy nuevo.
      const activeWorker = _registration && _registration.active;
      try {
        (activeWorker || (navigator.serviceWorker && navigator.serviceWorker.controller))
          .postMessage({ type: 'CLEAR_CACHE' });
      } catch (_err) { /* sin SW disponible: recargar de todos modos */ }
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
    dismissUpdate,
  };
})();

// Exponer globalmente
if (typeof window !== 'undefined') {
  window.UpdateManager = UpdateManager;
}