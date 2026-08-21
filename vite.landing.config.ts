import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { apiProxyConfig, cacheDirConfig, versionDiagnostics } from './vite.base';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const { pkgVersion, buildTime } = versionDiagnostics(rootDir);
const apiProxy = apiProxyConfig();

export default defineConfig({
  root: 'landing',
  cacheDir: cacheDirConfig('landing'),
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
