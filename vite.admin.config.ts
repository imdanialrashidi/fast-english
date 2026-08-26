import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { createSurfaceConfig } from './vite.base';

export default createSurfaceConfig({
  rootDir: fileURLToPath(new URL('.', import.meta.url)),
  surface: 'admin',
  viteRoot: 'admin',
  versionDefineKey: '__ADMIN_VERSION__',
  dataAttr: 'data-admin-version',
  serverPort: 5175,
  previewPort: 4175,
  outDir: '../dist-admin',
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
});
