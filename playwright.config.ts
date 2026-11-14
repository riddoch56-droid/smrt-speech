import { defineConfig } from '@playwright/test';

// End-to-end tests run against the production build (so the service worker is real),
// in WebKit at an iPad viewport, landscape and portrait.
const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  // One retry absorbs the cold start of the preview server on the very first test.
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    browserName: 'webkit',
    viewport: { width: 1180, height: 820 },
    hasTouch: true,
    locale: 'en-GB',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'ipad-landscape', use: { viewport: { width: 1180, height: 820 } }, testIgnore: /offline.spec.ts/ },
    { name: 'ipad-portrait', use: { viewport: { width: 820, height: 1180 } }, testMatch: /activities\.spec\.ts/ },
    // Offline behaviour depends on the service worker and Cache Storage. Playwright's WebKit
    // build for Windows does not answer Cache Storage calls, so that one spec runs in Chromium.
    // Offline use in real Safari on an iPad still needs checking on the device (see HANDOVER.md).
    { name: 'offline-chromium', use: { browserName: 'chromium' }, testMatch: /offline\.spec\.ts/ },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
