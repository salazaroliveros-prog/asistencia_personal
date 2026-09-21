import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '__e2e__',
  testMatch: 'app-integral.spec.ts',
  testTimeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: '__e2e__/output/app-integral',
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 3801',
    url: 'http://127.0.0.1:3801',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3801',
    geolocation: { latitude: 14.63492, longitude: -90.50693 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-pc',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        launchOptions: { headless: false },
      },
    },
  ],
});
