import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      'firebase.js': 'firebase.ts',
      'queue.js': 'queue.ts',
      'backoff.js': 'backoff.ts',
      'types.js': 'types.ts',
      'attendance.js': 'attendance.ts',
      'qr.js': 'qr.ts',
      'gps.js': 'gps.ts',
      'constants.js': 'constants.ts',
      'app-state.js': 'app-state.ts',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
