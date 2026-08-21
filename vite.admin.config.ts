import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { apiProxyConfig, cacheDirConfig, versionDiagnostics } from './vite.base';

const { pkgVersion, buildTime } = versionDiagnostics(fileURLToPath(new URL('.', import.meta.url)));
const apiProxy = apiProxyConfig();

export default defineConfig({
  root: 'admin',
  cacheDir: cacheDirConfig('admin'),
  // Landing configuration lives in the repository-root `.env` (same
  // convention as the other surfaces).
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [
    react(),
    {
      name: 'admin-release-identity',
      // Same marker contract as the Student App (data-app-version): the
      // deployed Admin release must be identifiable from the served HTML
      // before JavaScript runs. The #root div already carries data-surface.
      transformIndexHtml(html) {
        return html.replace(
          '<div id="root"',
          `<div id="root" data-admin-version="${pkgVersion}" data-build-time="${buildTime}"`,
        );
      },
    },
  ],
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
