import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function copyLegacyRuntime() {
  const directories = ['js', 'assets', 'css'];
  const files = ['service-worker.js', 'manifest.json', 'firestore.rules', 'vercel.json'];
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

export default defineConfig({
  appType: 'spa',
  plugins: [copyLegacyRuntime()],
  server: { host: '127.0.0.1', port: 3800 },
  preview: { host: '127.0.0.1', port: 3800 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
