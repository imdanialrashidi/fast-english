import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createSurfaceConfig } from './vite.base';

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
  orientation: 'any' as const,
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

export default createSurfaceConfig({
  rootDir: import.meta.dirname,
  surface: 'app',
  viteRoot: 'app',
  versionDefineKey: '__APP_VERSION__',
  dataAttr: 'data-app-version',
  serverPort: 5173,
  previewPort: 4173,
  outDir: '../dist-app',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      registerType: 'prompt',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      manifest: pwaManifest,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webmanifest}'],
        globIgnores: ['**/*.map'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
