/**
 * Post-build: inyecta window.__FIREBASE_ENV__ en dist/index.html.
 * Se ejecuta como último paso de `npm run build` (después de `vite build`).
 *
 * En Vercel las variables VITE_FIREBASE_* se leen desde process.env.
 * Localmente se intentan cargar desde .env.local y luego .env como fallback.
 */
const { resolve } = require('node:path');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');

// Intentar cargar dotenv si está disponible.
// Se busca .env.local primero (prioridad en Vite), luego .env como fallback.
try {
  const dotenv = require('dotenv');
  const envLocalPath = resolve(__dirname, '..', '.env.local');
  const envPath = resolve(__dirname, '..', '.env');
  if (existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
    console.log('[post-build] Variables cargadas desde .env.local');
  } else if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('[post-build] Variables cargadas desde .env');
  }
} catch (e) {
  // dotenv no disponible — usar process.env directamente (Vercel / CI)
}

const distDir = resolve(__dirname, '..', 'dist');

// Construir el objeto de configuración de Firebase desde process.env
const firebaseEnv = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID         || '',
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             process.env.VITE_FIREBASE_APP_ID             || '',
  measurementId:     process.env.VITE_FIREBASE_MEASUREMENT_ID     || '',
};

const hasValues = Object.values(firebaseEnv).some((v) => v.length > 0);
if (!hasValues) {
  console.warn('[post-build] ADVERTENCIA: No se encontraron variables VITE_FIREBASE_* — index.html usará la config bundled.');
}

const script = `<script>window.__FIREBASE_ENV__ = ${JSON.stringify(firebaseEnv)};</script>`;

// Inyectar en dist/index.html
const indexHtmlPath = resolve(distDir, 'index.html');
if (existsSync(indexHtmlPath)) {
  let html = readFileSync(indexHtmlPath, 'utf8');
  // Evitar doble inyección si ya existe el bloque (por vite transformIndexHtml)
  if (!html.includes('window.__FIREBASE_ENV__')) {
    html = html.replace('</head>', `${script}\n</head>`);
    writeFileSync(indexHtmlPath, html);
    console.log('[post-build] Variables de entorno inyectadas en index.html');
  } else {
    console.log('[post-build] window.__FIREBASE_ENV__ ya presente en index.html — omitiendo inyección duplicada');
  }
} else {
  console.warn('[post-build] dist/index.html no encontrado — ejecutar "vite build" primero');
}
