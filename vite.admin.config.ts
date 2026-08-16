import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Admin release/build diagnostics: the same version identity as the
// Student App and Landing (root package.json), injected into the built
// HTML so the deployed Admin release is identifiable before any JS runs
// (deployment health checks and support sessions). No secrets.
const pkgVersion = (() => {
  try {
    return JSON.parse(readFileSync(fileURLToPath(new URL('package.json', import.meta.url)), 'utf8'))
      .version;
  } catch {
    return '0.0.0';
  }
})();
const buildTime = new Date().toISOString();

// The version marker is interpolated into an HTML attribute; only a
// strict semver may reach the served markup (a malformed package.json
// version must fail the build, never corrupt the attribute).
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pkgVersion)) {
  throw new Error(`invalid package.json version for the release marker: "${pkgVersion}"`);
}

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
