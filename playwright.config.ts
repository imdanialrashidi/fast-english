// playwright.config.ts
// Playwright config for end-to-end tests. A global setup starts a
// disposable PocketBase on a free port and writes the data dir to a
// well-known file; test specs read that file. Two modes exist:
//
//   * PW_FAST=1 (the low-resource local lane, e.g. `pnpm test:e2e:fast`):
//     one Chromium project, one worker, zero retries, stop at the first
//     failure, line reporter only, no video/trace/screenshots, no HTML
//     report, shorter timeouts. The app is served by the Vite dev server
//     in production mode (no `vite build`, on-demand transforms) — an
//     already-running app server is reused. The landing site is never
//     started, built, prerendered or previewed. The disposable
//     PocketBase setup is preserved.
//
//   * default (the full lane, e.g. `pnpm test:e2e:full` which sets
//     CI=1): production-like app build (Vite preview + API proxy) and
//     the built landing site (multi-page static output). The landing
//     preview serves the pre-rendered `dist-landing` produced by
//     `pnpm build:landing` (vite build + scripts/prerender-landing.mjs).
//     Video is off; in CI at most one retry, trace on first retry and
//     screenshots on failure only.

import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const isFast = process.env.PW_FAST === '1';

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
  // In CI at most one retry; locally (fast or full) zero retries.
  retries: isFast ? 0 : isCI ? 1 : 0,
  // Fast lane stops after the first failure.
  maxFailures: isFast ? 1 : 0,
  reporter: isFast ? [['list']] : [['list'], ['html', { open: 'never' }]],
  outputDir: './test-results/e2e',
  timeout: isFast ? 60_000 : 120_000,
  expect: { timeout: isFast ? 10_000 : 15_000 },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: APP_URL,
    trace: isFast ? 'off' : isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: isFast ? 'off' : 'only-on-failure',
    video: 'off',
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
  webServer: isFast
    ? [
        {
          // Fast lane: Vite dev server only (no build). Reuses an
          // already-running app server when one responds on APP_URL.
          // VITE_API_TARGET keeps the /api proxy pointed at the
          // disposable PB started in global-setup; VITE_CATALOG=1
          // enables the dev-only component catalog route (/dev/catalog).
          // NODE_ENV=production + --mode production make the dev server
          // serve the production React build: React StrictMode is then a
          // no-op, avoiding the dev-only double auth-refresh race that
          // otherwise redirects freshly authenticated tests off the
          // target route (see app/src/lib/auth.tsx init()).
          command: `NODE_ENV=production VITE_CATALOG=1 VITE_API_TARGET=${PB_URL} node_modules/.bin/vite --config vite.app.config.ts --port ${APP_PORT} --host 127.0.0.1 --strictPort --mode production`,
          url: APP_URL,
          reuseExistingServer: true,
          timeout: 60_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ]
    : [
        {
          // The Vite preview server serves the built SPA. The PB
          // instance is managed by global-setup / global-teardown. We
          // set VITE_API_TARGET so the preview proxy forwards /api to
          // the disposable PB started in the global setup. `--host
          // 127.0.0.1` makes the preview server bind explicitly to
          // the IPv4 loopback so the playwright webServer probe can
          // hit it from the same host. VITE_CATALOG=1 enables the
          // dev-only component catalog route (/dev/catalog) used by
          // the Visual Slice 1 quality gates.
          command: `VITE_CATALOG=1 vite build --config vite.app.config.ts && VITE_API_TARGET=${PB_URL} node_modules/.bin/vite preview --config vite.app.config.ts --port ${APP_PORT} --host 127.0.0.1 --strictPort`,
          url: APP_URL,
          reuseExistingServer: !isCI,
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
          reuseExistingServer: !isCI,
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
