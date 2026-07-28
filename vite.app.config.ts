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
  },
});
