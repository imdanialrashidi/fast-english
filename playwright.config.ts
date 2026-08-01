// playwright.config.ts
// Playwright config for end-to-end tests. A global setup starts a
// disposable PocketBase on a free port and writes the data dir to a
// well-known file; test specs read that file. Two web servers are
// started: the built product app (Vite preview + API proxy) and the
// built landing site (multi-page static output). The landing preview
// serves the pre-rendered `dist-landing` produced by
// `pnpm build:landing` (vite build + scripts/prerender-landing.mjs).

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PB_E2E_PORT ?? 18101);
const APP_PORT = Number(process.env.APP_E2E_PORT ?? 18102);
const LANDING_PORT = Number(process.env.LANDING_E2E_PORT ?? 18103);
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const LANDING_URL = `http://127.0.0.1:${LANDING_PORT}`;
const PB_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // One worker keeps the disposable PB + Vite preview happy.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: './test-results/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fa-IR',
    extraHTTPHeaders: {
      'x-client-source': 'playwright-p1-s1',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // The Vite preview server serves the built SPA. The PB
      // instance is managed by global-setup / global-teardown. We
      // set VITE_API_TARGET so the preview proxy forwards /api to
      // the disposable PB started in the global setup. `--host
      // 127.0.0.1` makes the preview server bind explicitly to
      // the IPv4 loopback so the playwright webServer probe can
      // hit it from the same host.
      command: `vite build --config vite.app.config.ts && VITE_API_TARGET=${PB_URL} node_modules/.bin/vite preview --config vite.app.config.ts --port ${APP_PORT} --host 127.0.0.1 --strictPort`,
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // The landing is a fully static multi-page site; the build
      // includes the SSR pre-render step so tests exercise the same
      // crawlable HTML that production serves.
      command: `vite build --config vite.landing.config.ts && node scripts/prerender-landing.mjs && node_modules/.bin/vite preview --config vite.landing.config.ts --port ${LANDING_PORT} --host 127.0.0.1 --strictPort`,
      url: LANDING_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});

export const PB_URL_E2E = PB_URL;
export const PB_PORT_E2E = PORT;
export const APP_URL_E2E = APP_URL;
export const LANDING_URL_E2E = LANDING_URL;
