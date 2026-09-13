import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function copyLegacyRuntime() {
  const directories = ['js', 'assets', 'css'];
  const files = ['service-worker.js', 'manifest.json', 'field-scanner.html', 'field-scanner.js', 'field-scanner-manifest.json', 'campo.css'];
  return {
    name: 'copy-legacy-runtime',
    closeBundle() {
      for (const directory of directories) {
        const source = resolve(directory);
        if (existsSync(source)) cpSync(source, resolve('dist', directory), { recursive: true });
      }
      for (const file of files) {
        const source = resolve(file);
        if (existsSync(source)) cpSync(source, resolve('dist', file));
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  appType: 'spa',
  plugins: [copyLegacyRuntime()],
  server: { host: '127.0.0.1', port: 3801 },
  preview: { host: '127.0.0.1', port: 3801 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Generar sourcemaps solo en desarrollo; en producción evitar exponer
    // los mapas del bundle (u or 'hidden' si se necesita trazabilidad interna).
    sourcemap: mode === 'development',
  },
}));
