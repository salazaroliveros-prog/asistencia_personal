import { defineConfig, devices } from '@playwright/test';

const LIVE = process.env.LIVE_URL || 'https://controlasistenciaapp.vercel.app';

export default defineConfig({
  testDir: '__e2e__',
  testMatch: '**/live-mobile-smoke.spec.ts',
  testTimeout: 180000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: '__e2e__/output-live-mobile',
  use: {
    baseURL: LIVE,
    actionTimeout: 15000,
    navigationTimeout: 60000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'pixel7-live', use: { ...devices['Pixel 7'] } },
    { name: 'iphone14-live', use: { ...devices['iPhone 14'] } },
    { name: 'ipad-live', use: { ...devices['iPad Pro'] } },
  ],
});
