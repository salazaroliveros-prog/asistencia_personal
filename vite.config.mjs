import { defineConfig, createLogger, loadEnv } from 'vite';
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
        'field-scanner.html',
        'field-scanner.js',
        'field-scanner-manifest.json',
        'field-scanner-sw.js',
        'service-worker.js',
      ];

      for (const file of rootFiles) {
        const src = resolve(__dirname, file);
        if (existsSync(src)) {
          cpSync(src, resolve(distDir, file));
        }
      }

      // Inyectar variables de entorno de Firebase en index.html para que
      // firebase-config.js las pueda leer como window.__FIREBASE_ENV__.
      const indexPath = resolve(distDir, 'index.html');
      if (existsSync(indexPath)) {
        const env = loadEnv(mode, process.cwd(), '');
        const firebaseEnv = {
          apiKey: env.VITE_FIREBASE_API_KEY || '',
          authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
          projectId: env.VITE_FIREBASE_PROJECT_ID || '',
          storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: env.VITE_FIREBASE_APP_ID || '',
          measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
        };
        const script = `<script>window.__FIREBASE_ENV__ = ${JSON.stringify(firebaseEnv)};</script>`;
        let html = readFileSync(indexPath, 'utf8');
        html = html.replace('</head>', script + '</head>');
        writeFileSync(indexPath, html);
      }

      console.log('[vite] Runtime legado copiado a dist/');
    },
  };
}

export default defineConfig(({ mode }) => ({
  appType: 'spa',
  customLogger: logger,

  publicDir: 'public',

  plugins: [copyLegacyRuntime(mode)],

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
    rollupOptions: {
      input:    resolve(__dirname, 'index.html'),
      external: [/\.ts$/],
    },
  },
}));
