/**
 * CONTROL PERSONAL CAMPO — service-worker.js
 * Estrategia: Cache-First para assets locales, Network-First para navegación.
 * @version 1.5.0
 */

const CACHE_STATIC  = 'cpc-static-v1.5.0';
const CACHE_DYNAMIC = 'cpc-dynamic-v1.5.0';

// Assets críticos que se precargan en el install.
// ⚠️ Solo rutas locales — CDN externos se manejan con Stale-While-Revalidate en fetch.
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  // Iconos PWA
  '/pwa/icons/icon-72.png',
  '/pwa/icons/icon-96.png',
  '/pwa/icons/icon-128.png',
  '/pwa/icons/icon-144.png',
  '/pwa/icons/icon-192.png',
  '/pwa/icons/icon-384.png',
  '/pwa/icons/icon-512.png',
  // CSS
  '/css/main.css',
  '/css/glassmorphism.css',
  '/css/components.css',
  '/css/print.css',
  '/css/accessibility.css',
  '/css/campo.css',
  // JS principal
  '/js/config.js',
  '/js/firebase-client.js',
  '/js/firebase-config.js',
  '/js/api.js',
  '/js/app.js',
  // JS utils
  '/js/utils/alerts.js',
  '/js/utils/qr-generator.js',
  '/js/utils/pdf-builder.js',
  '/js/utils/logger.js',
  '/js/utils/error-handler.js',
  '/js/utils/realtime-validation.js',
  '/js/utils/data-export.js',
  '/js/utils/bulk-operations.js',
  '/js/utils/theme-manager.js',
  '/js/utils/keyboard-shortcuts.js',
  '/js/utils/performance-optimizer.js',
  '/js/utils/dashboard-enhancer.js',
  '/js/utils/update-manager.js',
  '/js/utils/gps.js',
  '/js/utils/date-helpers.js',
  '/js/utils/validators.js',
  '/js/utils/cache-manager.js',
  // JS modules
  '/js/modules/personal.js',
  '/js/modules/asistencia.js',
  '/js/modules/campo.js',
  '/js/modules/dashboard.js',
  '/js/modules/reportes.js',
  '/js/modules/ajustes.js',
  '/js/modules/user-management.js',
  '/js/modules/backup-manager.js',
  '/js/modules/gas-assistant.js',
  // Vendor local (copiados al dist por vite.config)
  '/vendor/firebase/firebase-app-compat.js',
  '/vendor/firebase/firebase-auth-compat.js',
  '/vendor/firebase/firebase-firestore-compat.js',
  '/vendor/firebase/firebase-functions-compat.js',
  '/vendor/jspdf.umd.min.js',
  '/vendor/jspdf.plugin.autotable.min.js',
  '/vendor/lucide.min.js',
  '/vendor/qrcode.min.js',
  '/vendor/html5-qrcode.min.js',
  '/vendor/html2canvas.min.js',
  '/vendor/chart.umd.min.js',
  // Subaplicaciones PWA
  '/field-scanner.html',
  '/field-scanner.js',
  '/field-scanner-manifest.json',
  '/pwa/scanner.html',
  '/pwa/scanner.js',
  '/pwa/manifest.json',
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando v1.5.0...');
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log('[SW] Pre-cacheando assets estáticos...');
      return Promise.all(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] No se pudo precachear:', url, err.message);
            return null; // Fallo no-fatal: continúa con los demás assets
          })
        )
      );
    })
    // NO skipWaiting(): la nueva versión espera confirmación del usuario
    // desde la UI ("Actualizar ahora") para activarse.
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando v1.5.0...');
  const VALID_CACHES = [CACHE_STATIC, CACHE_DYNAMIC];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !VALID_CACHES.includes(key))
          .map((key) => {
            console.log('[SW] Eliminando cache antiguo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  // No interceptar extensiones de Chrome ni protocolos no-http
  if (!url.protocol.startsWith('http')) return;

  // CDN externos y Firebase APIs → siempre red, nunca interceptar
  if (
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    return; // Deja pasar sin interceptar
  }

  // Recursos CDN externos → Stale-While-Revalidate
  if (url.hostname !== self.location.hostname && url.hostname !== 'localhost') {
    event.respondWith(_staleWhileRevalidate(request));
    return;
  }

  // Assets locales y navegación → Cache-First (con Network-First para navigate)
  event.respondWith(_cacheFirst(request));
});

// ─── ESTRATEGIAS ─────────────────────────────────────────────────────────────

/**
 * Cache-First: sirve desde cache; si no hay, fetch y guarda.
 * Para navegaciones (mode === 'navigate') usa Network-First
 * para garantizar que siempre se sirva la versión más reciente del shell.
 */
async function _cacheFirst(request) {
  if (request.mode === 'navigate') {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.status === 200) {
        const cache = await caches.open(CACHE_STATIC);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (_err) {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
      return new Response('<h1>Sin conexión</h1>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Sin conexión' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Stale-While-Revalidate: sirve desde cache inmediatamente
 * y actualiza en background.
 */
async function _staleWhileRevalidate(request) {
  const cache   = await caches.open(CACHE_DYNAMIC);
  const cached  = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// ─── MENSAJES DESDE EL CLIENTE ────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CLEAR_CACHE':
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      break;
    default:
      break;
  }
});
