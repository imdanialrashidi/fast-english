import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Build/version diagnostics for the landing telemetry contract: injected
// at build time (define) with a safe fallback for dev/test builds.
const pkgVersion = JSON.parse(
  readFileSync(new URL('package.json', import.meta.url), 'utf8'),
).version;
const buildTime = new Date().toISOString();

// The version marker is interpolated into an HTML attribute; only a
// strict semver may reach the served markup.
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pkgVersion)) {
  throw new Error(`invalid package.json version for the release marker: "${pkgVersion}"`);
}

// Static marketing landing surface: builds `landing/` into `dist-landing/`.
// Tailwind is configured ONLY in this Vite root and is NOT present in the
// product application build, so MUI styling remains the only CSS system
// inside `app/`.
//
// Multi-page output: every `landing/*.html` file is its own crawlable
// public route with unique static metadata. Essential page body content
// is injected into the built HTML after the build by
// `scripts/prerender-landing.mjs` (SSR `renderToString`), so pages remain
// readable and indexable without JavaScript.
// The landing fetches the public business-settings endpoint same-origin
// (`/api/fast-english/public/settings`). In production a scoped Caddy
// handle proxies exactly that path; in dev/e2e the Vite server and
// preview proxies forward it to the local PocketBase.
const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8090';

const apiProxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
  },
};

export default defineConfig({
  root: 'landing',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'landing-release-identity',
      // Same marker contract as the Student App (data-app-version): the
      // deployed Landing release must be identifiable from the served HTML
      // before JavaScript runs. The prerender script preserves attributes
      // on the #root div when it injects the SSR body.
      transformIndexHtml(html) {
        return html.replace(
          '<div id="root"',
          `<div id="root" data-landing-version="${pkgVersion}" data-build-time="${buildTime}"`,
        );
      },
    },
  ],
  define: {
    __LANDING_VERSION__: JSON.stringify(pkgVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  // Landing configuration lives in the repository-root `.env` (see
  // `.env.example`), so build-time values like the APK URL are shared
  // with the rest of the repository.
  envDir: rootDir,
  build: {
    outDir: '../dist-landing',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('landing/index.html', import.meta.url)),
        about: fileURLToPath(new URL('landing/about.html', import.meta.url)),
        'how-it-works': fileURLToPath(new URL('landing/how-it-works.html', import.meta.url)),
        install: fileURLToPath(new URL('landing/install.html', import.meta.url)),
        collaboration: fileURLToPath(new URL('landing/collaboration.html', import.meta.url)),
        contact: fileURLToPath(new URL('landing/contact.html', import.meta.url)),
        privacy: fileURLToPath(new URL('landing/privacy.html', import.meta.url)),
        terms: fileURLToPath(new URL('landing/terms.html', import.meta.url)),
        sample: fileURLToPath(new URL('landing/sample.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    // Distinct from the app preview default (4173) so both surfaces can
    // be served side by side during end-to-end tests.
    port: 4174,
    strictPort: true,
    proxy: apiProxy,
  },
});
