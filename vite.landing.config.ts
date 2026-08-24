import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createSurfaceConfig } from './vite.base';

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
  plugins: [react(), tailwindcss()],
});
