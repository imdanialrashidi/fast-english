import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Product application surface: builds `app/` into `dist-app/`.
// Used for the Web App, PWA, and the Capacitor `webDir`.
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
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        // Do not rewrite the path; the SDK builds `/api/...` already.
      },
    },
  },
});
