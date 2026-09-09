/**
 * CONTROL PERSONAL CAMPO — app.js
 * Router SPA, inicialización de módulos, reloj en tiempo real y gestión de modales.
 * Punto de entrada principal de la aplicación.
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 0. Limpiar datos demo si quedaron de una sesión anterior
    _limpiarDatosDemo();

    // 1. Renderizar íconos Lucide
    if (window.lucide) {
      lucide.createIcons();
    }

    // 2. Inicializar todos los módulos
    _initModules();

    // 2.1 Verificar cuota de localStorage
    if (typeof CacheManager !== 'undefined' && CacheManager.checkQuota) {
      CacheManager.checkQuota();
    }

    // 3. Iniciar reloj en tiempo real
    _startClock();

    // 4. Configurar router de navegación
    _initRouter();

    // 5. Configurar modales globales
    _initModals();

    // 6. Sidebar y menú
    _initSidebar();

    // 7. Botón de refrescar global
    _initRefreshButton();

    // 8. Botón de alertas en topbar
    _initAlertsButton();

    // 9. Indicador de sincronización offline
    _initSyncIndicator();

    // 10. Banner de modo demo
    _initDemoBanner();

    // 10.1 Instalación PWA cuando el navegador la ofrece
    _initPwaInstall();

    // 9. Navegar a la página según el hash actual o dashboard
    _navigateToHash();

    // 10. Si hay URL configurada, intentar conexión inicial
    await _initialConnection();

    // 11. Ocultar splash screen con animación
    _hideSplash();

  } catch (err) {
    console.error('[App] Error crítico en inicialización:', err);
    _hideSplash();
    Alerts.error('Error al iniciar la aplicación: ' + err.message, 'Error Crítico');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAR MÓDULOS
// ─────────────────────────────────────────────────────────────────────────────
function _initModules() {
  ModuloPersonal.init();
  ModuloAsistencia.init();
  ModuloDashboard.init();
  ModuloReportes.init();
  ModuloAjustes.init();
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTALACIÓN PWA
// ─────────────────────────────────────────────────────────────────────────────
let _deferredInstallPrompt = null;

function _initPwaInstall() {
  const installButton = document.getElementById('btn-install-app');
  if (!installButton) return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    _deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    installButton.hidden = true;
    Alerts.success('La aplicación quedó instalada en este dispositivo.', 'Instalación completada');
  });

  installButton.addEventListener('click', async () => {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    const choice = await _deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') installButton.hidden = true;
    _deferredInstallPrompt = null;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTER SPA
// ─────────────────────────────────────────────────────────────────────────────

const PAGES = {
  dashboard:  { title: 'Dashboard',           module: ModuloDashboard  },
  personal:   { title: 'Gestión de Personal', module: ModuloPersonal   },
  asistencia: { title: 'Control Asistencia',  module: ModuloAsistencia },
  reportes:   { title: 'Reportes',            module: ModuloReportes   },
  ajustes:    { title: 'Ajustes',             module: ModuloAjustes    },
};

let _currentPage = null;

function _initRouter() {
  // Click en links de navegación del sidebar
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      _navigate(page, true);
    });
  });

  // Escuchar cambios de hash en la URL
  window.addEventListener('hashchange', _navigateToHash);
}

function _navigateToHash() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  const page = Object.keys(PAGES).includes(hash) ? hash : 'dashboard';
  _navigate(page, false);
}

async function _navigate(page, updateHash = true) {
  if (!PAGES[page]) {
    console.warn('[Router] Página desconocida:', page);
    page = 'dashboard';
  }

  // Cleanup de la página anterior si aplica
  if (_currentPage === 'asistencia' && page !== 'asistencia') {
    ModuloAsistencia.cleanup?.();
  }

  // Determinar dirección de la animación
  const pageOrder = Object.keys(PAGES);
  const prevIndex = pageOrder.indexOf(_currentPage || 'dashboard');
  const nextIndex = pageOrder.indexOf(page);
  const dir       = nextIndex >= prevIndex ? 'slide-left' : 'slide-right';

  const prevPage = _currentPage;
  _currentPage = page;
  AppState.set('currentPage', page);

  // Actualizar hash de URL
  if (updateHash) {
    history.pushState(null, '', '#' + page);
  }

  // Actualizar título de la topbar Y del h2 interno de la sección
  const titleEl      = document.getElementById('page-title');
  const breadcrumbEl = document.getElementById('page-breadcrumb');
  if (titleEl)      titleEl.textContent = PAGES[page].title;
  if (breadcrumbEl) {
    breadcrumbEl.innerHTML = `<span id="current-date-display">${_getFormattedDate()}</span>`;
  }

  // Sincronizar el h2 interno de cada sección con el título correcto
  // Esto evita que el h2 del dashboard se vea debajo durante animaciones de página
  const sectionTitles = {
    dashboard:  'Panel de Control',
    personal:   'Gestión de Personal',
    asistencia: 'Control de Asistencia',
    reportes:   'Reportes e Impresión',
    ajustes:    'Ajustes del Sistema',
  };
  const nextSection = document.querySelector(`.page[data-page="${page}"] .section-header h2`);
  if (nextSection && sectionTitles[page]) {
    nextSection.textContent = sectionTitles[page];
  }

  // Actualizar links del sidebar
  document.querySelectorAll('.nav-link').forEach(link => {
    const isActive = link.dataset.page === page;
    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Animar salida de la página anterior y entrada de la nueva
  const prevEl = prevPage ? document.querySelector(`.page[data-page="${prevPage}"]`) : null;
  const nextEl = document.querySelector(`.page[data-page="${page}"]`);

  // Respetar prefers-reduced-motion
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReduced && prevEl && nextEl && prevPage !== page) {
    // 1. Ocultar todas las demás páginas (que no son prev ni next)
    document.querySelectorAll('.page').forEach(pageEl => {
      if (pageEl !== prevEl && pageEl !== nextEl) {
        pageEl.classList.remove('active');
        pageEl.hidden = true;
      }
    });

    // 2. La NUEVA página es la activa (para el DOM/tests), prev pierde .active
    prevEl.classList.remove('active');
    nextEl.hidden = false;
    nextEl.classList.add('active');

    // 3. Preparar animación de entrada: posición inicial fuera de pantalla
    nextEl.classList.add(dir === 'slide-left' ? 'from-right' : 'from-left');

    // 4. Preparar salida de la anterior (sin .active, solo posición)
    prevEl.style.position = 'absolute';
    prevEl.style.top      = '0';
    prevEl.style.left     = '0';
    prevEl.style.right    = '0';
    prevEl.hidden         = false; // Visible para la animación de salida

    // 5. Forzar reflow
    nextEl.offsetHeight; // eslint-disable-line no-unused-expressions

    // 6. Quitar clase de posición inicial para iniciar animación CSS
    nextEl.classList.remove('from-right', 'from-left');
    nextEl.classList.add('page-entering');

    // 7. Animar salida de la anterior
    prevEl.classList.add(dir === 'slide-left' ? 'to-left' : 'to-right');

    // 8. Al terminar la animación, limpiar
    setTimeout(() => {
      prevEl.classList.remove('to-left', 'to-right');
      prevEl.style.position = '';
      prevEl.style.top      = '';
      prevEl.style.left     = '';
      prevEl.style.right    = '';
      prevEl.hidden         = true;
      nextEl.classList.remove('page-entering');
      if (window.lucide) lucide.createIcons();
    }, 300);

  } else {
    // Sin animación (reduced motion o primer render)
    document.querySelectorAll('.page').forEach(pageEl => {
      const isActive = pageEl.dataset.page === page;
      pageEl.classList.toggle('active', isActive);
      pageEl.hidden = !isActive;
      if (isActive) pageEl.removeAttribute('hidden');
    });
    if (window.lucide) lucide.createIcons();
  }

  document.body.classList.remove('sidebar-open');
  document.getElementById('menu-toggle')?.setAttribute('aria-expanded', 'false');
  document.getElementById('sidebar-toggle')?.setAttribute('aria-expanded', 'false');

  // Cargar datos del módulo activo
  const pageConfig = PAGES[page];
  if (pageConfig.module && typeof pageConfig.module.cargar === 'function') {
    try {
      await pageConfig.module.cargar();
    } catch (err) {
      console.error(`[Router] Error cargando módulo "${page}":`, err.message);
    }
  }

  // Scroll al inicio
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────────────────────────────────────
// MODALES GLOBALES
// ─────────────────────────────────────────────────────────────────────────────
function _initModals() {
  let lastFocusedElement = null;
  const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const focusModal = (modal) => {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstFocusable = modal.querySelector(focusableSelector);
    (firstFocusable || modal).focus?.();
  };

  const closeModal = (modal) => {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
    lastFocusedElement = null;
  };

  // Los módulos abren modales directamente cambiando [hidden]. Centralizamos
  // foco inicial y retorno para que todos respeten teclado y lectores de pantalla.
  const modalObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'hidden') return;
      const modal = mutation.target;
      if (!(modal instanceof HTMLElement) || !modal.classList.contains('modal-overlay')) return;
      if (!modal.hidden) {
        modal.setAttribute('aria-hidden', 'false');
        focusModal(modal);
      } else {
        modal.setAttribute('aria-hidden', 'true');
      }
    });
  });
  document.querySelectorAll('.modal-overlay').forEach((modal) => modalObserver.observe(modal, { attributes: true }));

  // Cerrar modales al hacer click en botones con data-modal="id"
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-modal]');
    if (closeBtn) {
      const modalId = closeBtn.dataset.modal;
      const modal   = document.getElementById(modalId);
      closeModal(modal);
    }
  });

  // Cerrar modales al hacer click en el overlay
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal(e.target);
    }
  });

  // Cerrar modales con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-overlay:not([hidden])');
      if (openModal) {
        closeModal(openModal);
      }
      return;
    }
    const openModal = document.querySelector('.modal-overlay:not([hidden])');
    if (openModal && e.key === 'Tab') {
      const focusable = [...openModal.querySelectorAll(focusableSelector)].filter((element) => element instanceof HTMLElement);
      if (!focusable.length) { e.preventDefault(); openModal.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Botón de alertas en topbar abre modal de día o va a dashboard
  document.getElementById('alerts-btn')?.addEventListener('click', () => {
    if (_currentPage !== 'dashboard') {
      _navigate('dashboard');
    } else {
      // Scroll a la sección de alertas
      document.getElementById('alerts-list')?.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
function _initSidebar() {
  const menuToggle    = document.getElementById('menu-toggle');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const overlay       = document.getElementById('sidebar-overlay');

  const toggleSidebar = () => {
    const isOpen = document.body.classList.toggle('sidebar-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  if (menuToggle)    menuToggle.addEventListener('click', toggleSidebar);
  if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
  if (overlay)       overlay.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTÓN GLOBAL DE REFRESH
// ─────────────────────────────────────────────────────────────────────────────
function _initRefreshButton() {
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      const page = AppState.get('currentPage') || 'dashboard';
      const icon = refreshBtn.querySelector('svg');
      if (icon) icon.style.animation = 'spin 0.7s linear infinite';

      const module = PAGES[page]?.module;
      if (module && typeof module.cargar === 'function') {
        try {
          await module.cargar();
          Alerts.info('Datos actualizados');
        } catch (err) {
          Alerts.error(err.message, 'Error al actualizar');
        }
      }

      if (icon) icon.style.animation = '';
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BOTÓN DE ALERTAS
// ─────────────────────────────────────────────────────────────────────────────
function _initAlertsButton() {
  // Observar cambios en alertas para actualizar badge
  AppState.on('alertas', (alertas) => {
    const badge = document.getElementById('alerts-badge');
    if (badge) {
      const count = alertas ? alertas.length : 0;
      badge.textContent = count;
      badge.hidden      = count === 0;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RELOJ EN TIEMPO REAL
// ─────────────────────────────────────────────────────────────────────────────
function _startClock() {
  const clockEl = document.getElementById('live-clock');
  const dateEl  = document.getElementById('current-date-display');

  function update() {
    const now = new Date();
    const time = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const date = _getFormattedDate(now);

    if (clockEl) clockEl.textContent = time;
    if (dateEl)  dateEl.textContent  = date;
  }

  update();
  setInterval(update, 1000);
}

function _getFormattedDate(date) {
  const d = date || new Date();
  return d.toLocaleDateString('es-GT', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONEXIÓN INICIAL
// ─────────────────────────────────────────────────────────────────────────────
async function _initialConnection() {
  try {
    const connection = await API.ping();
    if (connection.success) {
      API.obtenerPersonal().catch(() => {});
      API.obtenerConfiguracion().catch(() => {});
    }
  } catch (err) {
    console.warn('[App] Firestore no disponible; se mantiene el modo local:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function _hideSplash() {
  const splash = document.getElementById('splash-screen');
  const app    = document.getElementById('app');

  setTimeout(() => {
    if (splash) {
      splash.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      splash.style.opacity    = '0';
      splash.style.transform  = 'scale(1.05)';

      setTimeout(() => {
        splash.style.display = 'none';
        if (app) app.hidden = false;

        // Re-renderizar íconos después de mostrar la app
        if (window.lucide) lucide.createIcons();

      }, 500);
    } else {
      if (app) app.hidden = false;
    }
  }, 1800); // Mínimo de splash para feedback visual
}

// ─────────────────────────────────────────────────────────────────────────────
// LIMPIEZA DE DATOS DEMO
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Si el usuario tenía la app con datos demo (cpc_demo_loaded=1) y ya se quitó
 * el script demo-data.js, limpiamos todas las claves demo del localStorage para
 * que la app arranque en estado completamente vacío.
 * También limpia la URL ficticia de demo para que el indicador muestre
 * "Sin configurar" en lugar de un estado de conexión falso.
 */
function _limpiarDatosDemo() {
  const CLAVES_DEMO = [
    'cpc_demo_loaded',
    'cpc_personal_cache',
    'cpc_last_sync',
    'cpc_config',
  ];

  // Si había datos demo, limpiar todo
  if (localStorage.getItem('cpc_demo_loaded') === '1') {
    console.info('[App] Limpiando datos demo del localStorage…');
    CLAVES_DEMO.forEach(k => localStorage.removeItem(k));

  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BANNER MODO DEMO
// ─────────────────────────────────────────────────────────────────────────────
function _initDemoBanner() {
  const banner = document.getElementById('demo-banner');
  if (!banner) return;

  // Mostrar solo si hay datos demo cargados
  const isDemo = localStorage.getItem('cpc_demo_loaded') === '1';
  banner.hidden = !isDemo;

  // Botón cerrar
  document.getElementById('btn-close-demo-banner')?.addEventListener('click', () => {
    banner.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
    banner.style.opacity    = '0';
    banner.style.maxHeight  = '0';
    banner.style.overflow   = 'hidden';
    banner.style.padding    = '0';
    setTimeout(() => { banner.hidden = true; }, 300);
  });

  // Link "Ajustes" dentro del banner
  banner.querySelector('.demo-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    _navigate('ajustes');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INDICADOR DE SINCRONIZACIÓN OFFLINE
// ─────────────────────────────────────────────────────────────────────────────
function _initSyncIndicator() {
  const indicator    = document.getElementById('sync-indicator');
  const offlineBadge = document.getElementById('sync-offline-badge');
  const queueCount   = document.getElementById('sync-queue-count');
  const syncLastEl   = document.getElementById('sync-last-time');
  const btnSyncNow   = document.getElementById('btn-sync-now');

  if (indicator) indicator.hidden = false;

  // Actualizar UI cuando cambia el estado de conexión
  AppState.on('connected', (connected) => {
    if (!indicator) return;
    indicator.hidden = false;

    if (connected) {
      // Reconexión — sincronizar automáticamente si hay pendientes
      const queue = API.getOfflineQueue();
      if (queue.length > 0) {
        _autoSync();
      }
    }
    _updateSyncUI();
  });

  // Actualizar UI cuando cambia la queue
  AppState.on('offlineQueue', () => _updateSyncUI());

  // Actualizar cuando hay nueva sync
  AppState.on('lastSync', () => _updateSyncUI());

  // Botón sincronizar ahora
  if (btnSyncNow) {
    btnSyncNow.addEventListener('click', async () => {
      btnSyncNow.disabled = true;
      const icon = btnSyncNow.querySelector('svg');
      if (icon) icon.style.animation = 'spin 0.7s linear infinite';

      try {
        const { enviadas, errores } = await API.syncOfflineQueue();
        if (enviadas > 0) {
          Alerts.success(`${enviadas} marcación(es) sincronizada(s) correctamente`);
        }
        if (errores > 0) {
          Alerts.warning(`${errores} marcación(es) no pudieron enviarse. Reintentando después.`);
        }
      } catch (err) {
        Alerts.error(err.message, 'Error al sincronizar');
      } finally {
        btnSyncNow.disabled = false;
        if (icon) icon.style.animation = '';
        _updateSyncUI();
      }
    });
  }

  // Estado inicial
  _updateSyncUI();

  function _updateSyncUI() {
    const queue   = API.getOfflineQueue ? API.getOfflineQueue() : [];
    const count   = queue.length;
    const hasPend = count > 0;
    const isConn  = AppState.get('connected');

    // Badge de pendientes
    if (offlineBadge) {
      offlineBadge.hidden = !hasPend;
      if (queueCount) queueCount.textContent = count;
    }

    // Botón sync — mostrar si hay pendientes y hay conexión
    if (btnSyncNow) {
      btnSyncNow.hidden = !(hasPend && isConn);
    }

    // Última sincronización
    const lastSync = AppState.get('lastSync') ||
      (typeof LS_KEYS !== 'undefined' ? localStorage.getItem(LS_KEYS.LAST_SYNC) : null);

    if (syncLastEl) {
      if (lastSync && !hasPend) {
        const d = new Date(lastSync);
        syncLastEl.textContent = `Sync: ${d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
        syncLastEl.hidden = false;
      } else {
        syncLastEl.hidden = true;
      }
    }
  }
}

async function _autoSync() {
  try {
    const { enviadas } = await API.syncOfflineQueue();
    if (enviadas > 0) {
      Alerts.success(`${enviadas} operación(es) offline sincronizada(s) automáticamente`, 'Sync completada');
    }
  } catch (err) {
    console.warn('[Sync] Error en autosync:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANEJO DE ERRORES GLOBALES
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('unhandledrejection', (event) => {
  console.error('[App] Promesa rechazada no manejada:', event.reason);
  // Solo mostrar toast para errores significativos
  if (event.reason && event.reason.message && !event.reason.message.includes('fetch')) {
    Alerts.error(event.reason.message || 'Error inesperado', 'Error');
  }
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('[App] Error global:', event.message, event.filename, event.lineno);
});
