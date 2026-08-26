import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createSurfaceConfig } from './vite.base';

/**
 * Same-origin release metadata for local dev/preview.
 * Production serves /releases/* from the host volume (nginx/Caddy);
 * locally we serve the file from the repository `releases/` directory
 * so `fetch('/releases/release-metadata.json')` works without a rebuild.
 */
function releaseMetadataServePlugin() {
  const repoReleasesDir = resolve(fileURLToPath(new URL('.', import.meta.url)), 'releases');
  return {
    name: 'fep-release-metadata-serve',
    configureServer(server: {
      middlewares: {
        use: (
          fn: (
            req: { url?: string },
            res: { setHeader: (k: string, v: string) => void; end: (d: string | Buffer) => void },
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const url = req.url.split('?')[0];
        if (url === '/releases/release-metadata.json' || url.startsWith('/releases/')) {
          const filePath = join(repoReleasesDir, url.replace('/releases/', ''));
          if (existsSync(filePath)) {
            try {
              const data = readFileSync(filePath);
              const isJson = filePath.endsWith('.json');
              const ct = isJson ? 'application/json; charset=utf-8' : 'application/octet-stream';
              (_res as unknown as { setHeader: (k: string, v: string) => void }).setHeader(
                'Content-Type',
                ct,
              );
              (_res as unknown as { end: (d: Buffer) => void }).end(data);
              return;
            } catch {
              return next();
            }
          }
        }
        next();
      });
    },
    // vite preview also needs the same handling (preview has no configureServer)
    configurePreviewServer(server: {
      middlewares: {
        use: (
          fn: (
            req: { url?: string },
            res: { setHeader: (k: string, v: string) => void; end: (d: string | Buffer) => void },
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const url = req.url.split('?')[0];
        if (url === '/releases/release-metadata.json' || url.startsWith('/releases/')) {
          const filePath = join(repoReleasesDir, url.replace('/releases/', ''));
          if (existsSync(filePath)) {
            try {
              const data = readFileSync(filePath);
              const isJson = filePath.endsWith('.json');
              const ct = isJson ? 'application/json; charset=utf-8' : 'application/octet-stream';
              (_res as unknown as { setHeader: (k: string, v: string) => void }).setHeader(
                'Content-Type',
                ct,
              );
              (_res as unknown as { end: (d: Buffer) => void }).end(data);
              return;
            } catch {
              return next();
            }
          }
        }
        next();
      });
    },
  };
}

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default createSurfaceConfig({
  rootDir,
  surface: 'landing',
  viteRoot: 'landing',
  versionDefineKey: '__LANDING_VERSION__',
  dataAttr: 'data-landing-version',
  serverPort: 5174,
  previewPort: 4174,
  outDir: '../dist-landing',
  envDir: rootDir,
  rollupInput: {
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
  plugins: [react(), tailwindcss(), releaseMetadataServePlugin() as never],
});
