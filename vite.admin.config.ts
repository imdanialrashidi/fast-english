import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Unified Staff Admin Console surface: builds `admin/` into `dist-admin/`.
//
// This is a separate application from the Student App by design
// (Podcast Slice 1):
//   - no VitePWA plugin: no Service Worker, no Student manifest, and the
//     Admin is never cached as part of the Student App shell;
//   - its own PocketBase client instance + AuthStore storage key
//     (admin/src/auth/pocketbase.ts);
//   - the same /api proxy contract so dev/preview can reach the backend.
const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8090';

const apiProxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
  },
};

export default defineConfig({
  root: 'admin',
  // Isolated dep-optimizer cache (see vite.app.config.ts — the two dev
  // servers must never share a cache).
  cacheDir: '../node_modules/.vite-admin',
  // Landing configuration lives in the repository-root `.env` (same
  // convention as the other surfaces).
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: '../dist-admin',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4175,
    strictPort: true,
    proxy: apiProxy,
  },
});
