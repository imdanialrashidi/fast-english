import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Static marketing landing surface: builds `landing/` into `dist-landing/`.
// Tailwind is configured ONLY in this Vite root and is NOT present in the
// product application build, so MUI styling remains the only CSS system
// inside `app/`.
export default defineConfig({
  root: 'landing',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist-landing',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
