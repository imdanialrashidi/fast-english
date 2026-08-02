import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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

// P4-S2 — Product App PWA (Web only; never inside the Capacitor WebView,
// see app/src/pwa/register.ts). `injectManifest` gives precise control of
// the cache: the Service Worker precaches only the public App shell and
// never intercepts /api/**, /files/** or tokenized URLs (see sw.ts).
const pwaManifest = {
  id: '/',
  name: 'Fast English Podcast',
  short_name: 'Fast English',
  description:
    'پادکست یادگیری سریع انگلیسی برای فارسی‌زبانان؛ تعیین سطح، درس‌ها، صوت و پیگیری پیشرفت در یک برنامه.',
  lang: 'fa',
  dir: 'rtl' as const,
  start_url: '/',
  scope: '/',
  display: 'standalone' as const,
  // Compatible with phones and tablets in any orientation.
  orientation: 'any' as const,
  // Theme tokens from app/src/app/theme/tokens (kept as literals so the
  // app build stays fully isolated): light-mode AppBar surface + page
  // background. The dynamic <meta name="theme-color"> follows the active
  // scheme at runtime (theme/ThemeHost.tsx); the manifest is static.
  theme_color: '#e9f1f4',
  background_color: '#f5f9fa',
  icons: [
    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    {
      src: 'pwa-maskable-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
  // Shortcuts only for real Product App routes.
  shortcuts: [
    {
      name: 'داشبورد',
      short_name: 'داشبورد',
      url: '/dashboard',
      icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
    },
    {
      name: 'درس‌ها',
      short_name: 'درس‌ها',
      url: '/lessons',
      icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
    },
  ],
};

export default defineConfig({
  root: 'app',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      // Explicit update prompt (PwaManager): never auto-update/reload.
      registerType: 'prompt',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      manifest: pwaManifest,
      injectManifest: {
        // Public App-shell assets only: versioned JS/CSS, HTML, self-hosted
        // fonts, icons and static images. Never /api/** (the Service Worker
        // also enforces this at runtime; see app/src/pwa/sw.ts).
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webmanifest}'],
        globIgnores: ['**/*.map'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
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
