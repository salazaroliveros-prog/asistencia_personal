import { defineConfig } from '@playwright/test';

const LIVE = process.env.LIVE_URL || 'https://controlasistenciaapp.vercel.app';

export default defineConfig({
  testDir: '__e2e__',
  testMatch: '**/live-production-audit.spec.ts',
  testTimeout: 300000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: '__e2e__/output-live',
  use: {
    baseURL: LIVE,
    viewport: { width: 1280, height: 900 },
    isMobile: false,
    hasTouch: false,
    actionTimeout: 15000,
    navigationTimeout: 60000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'desktop-live', use: { browserName: 'chromium' } }],
});
