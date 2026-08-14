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
export default defineConfig({
  root: 'landing',
  plugins: [react(), tailwindcss()],
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
  },
  preview: {
    // Distinct from the app preview default (4173) so both surfaces can
    // be served side by side during end-to-end tests.
    port: 4174,
    strictPort: true,
  },
});
