import { defineConfig, createLogger, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Logger personalizado: silencia las advertencias de scripts UMD sin type="module".
 * Estas son librerías legacy (Lucide, Chart.js, jsPDF, etc.) que no necesitan
 * type="module" porque se cargan como UMD global.
 */
const logger = createLogger();
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
  if (msg.includes("can't be bundled without type=\"module\"")) return;
  originalWarn(msg, options);
};

/**
 * Construye el objeto de configuración de Firebase a partir de las variables
 * de entorno de Vite (VITE_FIREBASE_*).
 * @param {Record<string,string>} env  — resultado de loadEnv()
 * @returns {Object} firebaseEnv
 */
function _buildFirebaseEnv(env) {
  return {
    apiKey:            env.VITE_FIREBASE_API_KEY            || '',
    authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN        || '',
    projectId:         env.VITE_FIREBASE_PROJECT_ID         || '',
    storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET     || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId:             env.VITE_FIREBASE_APP_ID             || '',
    measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID     || '',
  };
}

/**
 * Plugin: inyecta window.__FIREBASE_ENV__ en index.html.
 * - En modo dev: mediante transformIndexHtml (sirve en tiempo real por Vite).
 * - En modo build: también mediante transformIndexHtml (antes de emitir).
 * Así, firebase-config.js puede leer las credenciales del .env en AMBOS modos.
 */
function injectFirebaseEnv(mode) {
  return {
    name: 'inject-firebase-env',
    // transformIndexHtml se ejecuta tanto en dev como en build.
    transformIndexHtml(html) {
      const env = loadEnv(mode, process.cwd(), '');
      const firebaseEnv = _buildFirebaseEnv(env);
      const hasAnyValue = Object.values(firebaseEnv).some((v) => v.length > 0);
      if (!hasAnyValue) {
        console.warn('[inject-firebase-env] No se encontraron variables VITE_FIREBASE_* en .env');
      }
      const script = `<script>window.__FIREBASE_ENV__ = ${JSON.stringify(firebaseEnv)};</script>`;
      // Insertar justo antes de </head>
      return html.replace('</head>', `${script}\n</head>`);
    },
  };
}

/**
 * Plugin: copia el runtime legado (JS vanilla, CSS, service workers,
 * manifests, vendor) al directorio dist después del build.
 */
function copyLegacyRuntime(mode) {
  return {
    name: 'copy-legacy-runtime',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // Directorios completos a copiar
      const directories = [
        'js',
        'css',
        'public/vendor',   // → dist/vendor
        'public/pwa',      // → dist/pwa  (icons + manifest + scanner)
      ];

      for (const dir of directories) {
        const src  = resolve(__dirname, dir);
        // Destino: quitar el prefijo "public/" para que quede en raíz del dist
        const dest = resolve(distDir, dir.replace(/^public\//, ''));
        if (existsSync(src)) {
          mkdirSync(dirname(dest), { recursive: true });
          cpSync(src, dest, { recursive: true });
        }
      }

      // Archivos sueltos en la raíz del dist
      const rootFiles = [
        'manifest.json',
        'favicon.svg',
        'field-scanner-favicon.svg',
        'field-scanner-manifest.json',
        'field-scanner-sw.js',
        'service-worker.js',
        'field-scanner.html',
        'field-scanner.js',
      ];

      for (const file of rootFiles) {
        const src = resolve(__dirname, file);
        if (existsSync(src)) {
          cpSync(src, resolve(distDir, file));
        }
      }

      console.log('[vite] Runtime legado copiado a dist/');
    },
  };
}

export default defineConfig(({ mode }) => ({
  appType: 'spa',
  customLogger: logger,

  publicDir: 'public',

  plugins: [
    injectFirebaseEnv(mode),
    copyLegacyRuntime(mode),
    // PWA Plugin para service worker mejorado
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'manifest.json'],
      manifest: {
        name: 'Control Personal Campo',
        short_name: 'Control Campo',
        description: 'Sistema de Control de Asistencia Personal con GPS y QR',
        theme_color: '#003459',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/unpkg\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unpkg-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdnjs-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          }
        ]
      }
    })
  ],

  server: {
    host: '127.0.0.1',
    port: 3801,
  },

  preview: {
    host: '127.0.0.1',
    port: 3801,
  },

  build: {
    outDir:      'dist',
    emptyOutDir: true,
    sourcemap:   mode === 'development',
    modulePreload: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      external: [/\.ts$/],
    },
  },
}));
