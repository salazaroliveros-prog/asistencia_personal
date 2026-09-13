/**
 * ESCÁNER DE CAMPO — field-scanner-sw.js
 * Service Worker para la sub-app de escaneo QR en campo.
 * @version 2.1.0
 */

const CACHE_NAME    = 'field-scanner-v2.1.0';
const CACHE_DYNAMIC = 'field-scanner-dynamic-v2.1.0';

// Assets locales del escáner de campo
const STATIC_ASSETS = [
  '/',
  '/field-scanner.html',
  '/field-scanner.js',
  '/field-scanner-manifest.json',
  '/css/campo.css',
  '/css/main.css',
  // Vendor local (html5-qrcode se sirve desde /vendor/)
  '/vendor/html5-qrcode.min.js',
  '/vendor/lucide.min.js',
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[FieldSW] Instalando v2.1.0...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[FieldSW] No se pudo precachear:', url, err.message);
            return null; // Fallo no-fatal
          })
        )
      )
    )
    // NO skipWaiting(): espera confirmación del usuario para activarse.
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[FieldSW] Activando v2.1.0...');
  const VALID = [CACHE_NAME, CACHE_DYNAMIC];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !VALID.includes(key))
          .map((key) => {
            console.log('[FieldSW] Eliminando cache antiguo:', key);
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

  // No interceptar protocolos no-http
  if (!url.protocol.startsWith('http')) return;

  // Firebase / Google APIs → siempre red
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com')
  ) {
    return;
  }

  // CDN externos → Stale-While-Revalidate
  if (url.hostname !== self.location.hostname && url.hostname !== 'localhost') {
    event.respondWith(_staleWhileRevalidate(request));
    return;
  }

  // Assets locales → Cache-First (Network-First para navegación)
  event.respondWith(_cacheFirst(request));
});

// ─── ESTRATEGIAS ─────────────────────────────────────────────────────────────

async function _cacheFirst(request) {
  if (request.mode === 'navigate') {
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (_err) {
      const fallback = await caches.match('/field-scanner.html');
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
      const cache = await caches.open(CACHE_NAME);
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

async function _staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_DYNAMIC);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// ─── MENSAJES DESDE EL CLIENTE ─────────────────────────────────────────────
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
