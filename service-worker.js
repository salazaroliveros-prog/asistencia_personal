/**
 * CONTROL PERSONAL CAMPO — service-worker.js
 * Estrategia: Cache-First para assets locales, Network-First para API GAS.
 * @version 1.0.0
 */

const CACHE_NAME    = 'cpc-v1.2.0';
const CACHE_STATIC  = 'cpc-static-v1.2.0';
const CACHE_DYNAMIC = 'cpc-dynamic-v1.2.0';

// Assets críticos que se precargan en el install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/css/main.css',
  '/css/glassmorphism.css',
  '/css/components.css',
  '/css/print.css',
  '/js/config.js',
  '/js/app.js',
  '/js/utils/alerts.js',
  '/js/utils/qr-generator.js',
  '/js/utils/pdf-builder.js',
  '/js/modules/personal.js',
  '/js/modules/asistencia.js',
  '/js/modules/campo.js',
  '/js/modules/dashboard.js',
  '/js/modules/reportes.js',
  '/js/modules/ajustes.js',
  '/css/campo.css',
  '/vendor/jspdf.umd.min.js',
  '/vendor/jspdf.plugin.autotable.min.js',
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando v1.2.0...');
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => {
      console.log('[SW] Pre-cacheando assets estáticos...');
      return Promise.all(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] No se pudo precachear:', url, err.message);
            return null;
          })
        )
      );
    })
    // NO skipWaiting() aquí: la nueva versión espera a que el usuario
    // confirme desde la UI ("Actualizar ahora") para activarse.
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC && key !== CACHE_DYNAMIC)
          .map(key => {
            console.log('[SW] Eliminando cache antiguo:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptar requests a Google Apps Script (necesita red siempre)
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com')) {
    return; // Dejar pasar sin interceptar
  }

  // No interceptar requests de extensiones de Chrome
  if (!url.protocol.startsWith('http')) return;

  // Recursos de CDN externos — Stale-While-Revalidate
  if (url.hostname !== self.location.hostname &&
      url.hostname !== 'localhost') {
    event.respondWith(_staleWhileRevalidate(request));
    return;
  }

  // Assets locales — Cache-First
  event.respondWith(_cacheFirst(request));
});

// ─── ESTRATEGIAS ─────────────────────────────────────────────────────────────

/**
 * Cache-First: sirve desde cache; si no hay, fetch y guarda.
 */
async function _cacheFirst(request) {
  // Navegaciones (páginas): Network-First para que las actualizaciones
  // (CSP, bundles) se apliquen de inmediato; caché solo como fallback offline.
  if (request.mode === 'navigate') {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.status === 200) {
        const cache = await caches.open(CACHE_STATIC);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
      throw err;
    }
  }

  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Solo cachear respuestas válidas
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Si falla la red y es una navegación, devolver index.html (SPA offline)
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    // Para otros recursos, devolver respuesta de error controlada
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
  const cache  = await caches.open(CACHE_DYNAMIC);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached); // Si falla la red, usar cache

  return cached || fetchPromise;
}

// ─── MENSAJES DESDE EL CLIENTE ────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
