import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Product application surface: builds `app/` into `dist-app/`.
// Used for the Web App, PWA, and the Capacitor `webDir`.
//
// The API target is parameterised so the same config works for
// the dev server, the preview server, and end-to-end tests
// against a disposable PocketBase. The target port is read from
// `VITE_API_TARGET` at build time, with a sensible default for
// the local dev workflow.
const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8090';

const apiProxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
    // Do not rewrite the path; the SDK builds `/api/...` already.
  },
};

export default defineConfig({
  root: 'app',
  plugins: [react()],
  build: {
    outDir: '../dist-app',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    // Browser dev: proxy `/api/*` to the local PocketBase so the SDK
    // can use same-origin (window.location.origin) requests. Caddy
    // does the same in production.
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    strictPort: true,
    // The preview server mirrors the dev server's API proxy so
    // Playwright (and ad-hoc manual review of a built bundle) can
    // drive the app against a real backend without CORS gymnastics.
    proxy: apiProxy,
  },
});
