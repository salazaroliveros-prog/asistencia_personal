/**
 * UPDATE MANAGER — js/utils/update-manager.js
 * Notifica SOLO cuando hay una versión más nueva que la que está corriendo.
 *
 * Reglas:
 *  1. Al cargar: si __APP_VERSION__ ya está en la página, el usuario YA tiene
 *     ese deploy → grabar como visto, NUNCA mostrar banner.
 *  2. Banner solo si el HTML remoto tiene un SHA distinto al que corre ahora
 *     (app abierta durante un deploy) O si hay un SW waiting listo para activar.
 *  3. Dismiss respeta 1 h sin bloquear el registro del SW ni los botones.
 *
 * @version 1.6.0
 */

const UpdateManager = (() => {
  'use strict';

  let _registration = null;
  let _updateAvailable = false;
  let _dismissedUntil = null;
  let _eventsBound = false;

  /** Última versión que el usuario ya aceptó / está corriendo. */
  const VERSION_SEEN_KEY = 'cpc_app_version_seen';
  const DISMISS_KEY = 'updateDismissedUntil';

  function _getRunningVersion() {
    return (typeof window !== 'undefined' && window.__APP_VERSION__) || '';
  }

  /**
   * Al arrancar: sincroniza "visto" con la versión que YA corre.
   * No muestra banner — si el HTML trae un SHA nuevo, el usuario ya lo tiene.
   */
  function _seedRunningVersion() {
    const running = _getRunningVersion();
    if (!running) return;
    try {
      const seen = localStorage.getItem(VERSION_SEEN_KEY);
      if (seen !== running) {
        localStorage.setItem(VERSION_SEEN_KEY, running);
      }
    } catch (_e) { /* quota */ }
  }

  /**
   * ¿Hay una versión remota distinta a la que corre ahora?
   * @param {string} remoteVersion
   */
  function _notifyIfRemoteNewer(remoteVersion) {
    if (!remoteVersion) return;
    const running = _getRunningVersion();
    // Sin marcador local (dev): no molestar
    if (!running) return;
    // Misma versión que corre → no hay nada que actualizar
    if (remoteVersion === running) {
      try { localStorage.setItem(VERSION_SEEN_KEY, running); } catch (_e) { /* */ }
      return;
    }
    // Remoto ≠ running → deploy nuevo mientras la pestaña sigue abierta
    _updateAvailable = true;
    showUpdateBanner();
  }

  async function _checkRemoteVersion() {
    try {
      const url = `${location.pathname || '/'}?__update_check=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      const match = text.match(/window\.__APP_VERSION__\s*=\s*"([^"]+)"/);
      if (!match || !match[1]) return;
      _notifyIfRemoteNewer(match[1]);
    } catch (_err) {
      // Offline: no se puede saber; no mostrar banner
    }
  }

  function _loadDismissState() {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return;
      _dismissedUntil = new Date(raw);
      if (Number.isNaN(_dismissedUntil.getTime()) || new Date() >= _dismissedUntil) {
        _dismissedUntil = null;
        localStorage.removeItem(DISMISS_KEY);
      }
    } catch (_e) {
      _dismissedUntil = null;
    }
  }

  function init() {
    _loadDismissState();
    // Primero: aceptar la versión que ya corre (sin banner falso)
    _seedRunningVersion();
    _bindEvents();

    if (!('serviceWorker' in navigator)) {
      // Sin SW aún podemos detectar deploys por fetch remoto (pestaña abierta)
      if (typeof setInterval === 'function') {
        setInterval(() => { _checkRemoteVersion(); }, 15 * 60 * 1000);
      }
      return;
    }

    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        _registration = registration;

        setInterval(() => {
          checkForUpdates();
          _checkRemoteVersion();
        }, 15 * 60 * 1000);

        registration.addEventListener('updatefound', handleUpdateFound);
        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

        // Si ya hay un worker en waiting al iniciar (update previo), avisar
        if (registration.waiting && navigator.serviceWorker.controller) {
          _updateAvailable = true;
          showUpdateBanner();
        }

        // Chequeo remoto: solo avisa si el servidor tiene otro SHA
        _checkRemoteVersion();
      })
      .catch((error) => {
        console.warn('[UpdateManager] Service Worker no registrado:', error && error.message);
      });
  }

  function handleUpdateFound() {
    if (!_registration) return;
    const newWorker = _registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      // Solo si hay controller: no es la primera instalación del SW
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        _updateAvailable = true;
        showUpdateBanner();
      }
    });
  }

  function handleServiceWorkerMessage(event) {
    if (event.data && event.data.type === 'NEW_VERSION_AVAILABLE') {
      // Confirmar contra versión remota para no avisar en vano
      _checkRemoteVersion();
    }
  }

  function checkForUpdates() {
    if (_registration) {
      _registration.update().catch(() => { /* silencioso */ });
    }
  }

  function showUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (!banner || !banner.hidden) return;
    if (_dismissedUntil && new Date() < _dismissedUntil) return;

    banner.hidden = false;
    if (window.lucide && typeof lucide.createIcons === 'function') {
      try { lucide.createIcons({ nodes: [banner] }); } catch (_e) { /* */ }
    }
    if (window.Logger) {
      window.Logger.info('UpdateManager', 'Actualización real disponible', {
        running: _getRunningVersion(),
      });
    }
  }

  function hideUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) banner.hidden = true;
  }

  function applyUpdate() {
    _updateAvailable = false;
    hideUpdateBanner();

    // Al aplicar, la próxima carga será la nueva versión → ya no hace falta banner
    const running = _getRunningVersion();
    try {
      if (running) localStorage.setItem(VERSION_SEEN_KEY, running);
      localStorage.removeItem(DISMISS_KEY);
    } catch (_e) { /* */ }

    if (_registration && _registration.waiting) {
      _registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      try {
        const active = (_registration && _registration.active)
          || (navigator.serviceWorker && navigator.serviceWorker.controller);
        if (active) active.postMessage({ type: 'CLEAR_CACHE' });
      } catch (_err) { /* */ }
    }

    setTimeout(() => { window.location.reload(); }, 400);
  }

  function dismissUpdate() {
    hideUpdateBanner();
    const until = new Date(Date.now() + 60 * 60 * 1000);
    try {
      localStorage.setItem(DISMISS_KEY, until.toISOString());
    } catch (_e) { /* */ }
    _dismissedUntil = until;
  }

  function _bindEvents() {
    if (_eventsBound) return;
    _eventsBound = true;
    const updateBtn = document.getElementById('update-btn');
    const updateDismiss = document.getElementById('update-dismiss');
    if (updateBtn) updateBtn.addEventListener('click', applyUpdate);
    if (updateDismiss) updateDismiss.addEventListener('click', dismissUpdate);
  }

  return {
    init,
    checkForUpdates,
    showUpdateBanner,
    hideUpdateBanner,
    applyUpdate,
    dismissUpdate,
    /** @internal tests */
    _notifyIfRemoteNewer,
    _seedRunningVersion,
    _getRunningVersion,
  };
})();

if (typeof window !== 'undefined') {
  window.UpdateManager = UpdateManager;
}
