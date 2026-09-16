const { resolve } = require('node:path');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');

// En Vercel, las variables de entorno están disponibles en process.env
// Localmente, cargamos desde .env si existe
try {
  require('dotenv').config({ path: resolve(__dirname, '..', '.env') });
} catch (e) {
  // dotenv no está disponible o no hay archivo .env, usar process.env
}

const distDir = resolve(__dirname, '..', 'dist');

// Leer variables de entorno desde process.env
const firebaseEnv = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.VITE_FIREBASE_APP_ID || '',
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

const script = `<script>window.__FIREBASE_ENV__ = ${JSON.stringify(firebaseEnv)};</script>`;

// Inyectar en index.html
const indexHtmlPath = resolve(distDir, 'index.html');
if (existsSync(indexHtmlPath)) {
  let html = readFileSync(indexHtmlPath, 'utf8');
  html = html.replace('</head>', script + '</head>');
  writeFileSync(indexHtmlPath, html);
  console.log('[post-build] Variables de entorno inyectadas en index.html');
} else {
  console.warn('[post-build] index.html no encontrado');
}