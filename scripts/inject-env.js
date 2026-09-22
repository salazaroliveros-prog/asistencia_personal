/**
 * Post-build: inyecta window.__FIREBASE_ENV__ en dist/index.html.
 * Se ejecuta como último paso de `npm run build` (después de `vite build`).
 *
 * En Vercel las variables VITE_FIREBASE_* se leen desde process.env.
 * Localmente se intentan cargar desde .env.local y luego .env como fallback.
 */
const { resolve } = require('node:path');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { execSync } = require('node:child_process');

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

// Construir el marcador de versión del deploy.
// En Vercel se usa el commit SHA del deploy; si no existe (fallback) se intenta
// el git local; si tampoco hay git, no se inyecta marcador (detección omitida).
let appVersion = process.env.VERCEL_GIT_COMMIT_SHA;
if (!appVersion) {
  try {
    appVersion = String(execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })).trim();
  } catch (e) {
    appVersion = '';
  }
}
const versionScript = appVersion
  ? `<script>window.__APP_VERSION__ = "${String(appVersion).replace(/"/g, '')}";</script>\n`
  : '\n';

/**
 * Inyecta __FIREBASE_ENV__ (y opcionalmente __APP_VERSION__) al inicio de <head>.
 * @param {string} relativePath — ruta relativa a dist/
 * @param {{ withVersion?: boolean }} options
 */
function injectIntoHtmlFile(relativePath, options = {}) {
  const htmlPath = resolve(distDir, relativePath);
  if (!existsSync(htmlPath)) {
    console.warn(`[post-build] ${relativePath} no encontrado — omitiendo`);
    return;
  }

  let html = readFileSync(htmlPath, 'utf8');
  let changed = false;

  // Debe ir al inicio de <head> para que firebase-config.js lo lea a tiempo.
  if (!html.includes('window.__FIREBASE_ENV__')) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>\n    ${script}`);
    changed = true;
    console.log(`[post-build] Variables de entorno inyectadas en ${relativePath}`);
  } else {
    console.log(`[post-build] window.__FIREBASE_ENV__ ya presente en ${relativePath} — omitiendo duplicado`);
  }

  if (options.withVersion && versionScript && !html.includes('window.__APP_VERSION__')) {
    html = html.replace('</head>', `${versionScript}</head>`);
    changed = true;
    console.log(`[post-build] Marcador de versión inyectado en ${relativePath}: ${appVersion || '(sin marcador)'}`);
  }

  if (changed) {
    writeFileSync(htmlPath, html);
  }
}

// Páginas que cargan firebase-config.js y necesitan __FIREBASE_ENV__ antes.
injectIntoHtmlFile('index.html', { withVersion: true });
injectIntoHtmlFile('field-scanner.html');
