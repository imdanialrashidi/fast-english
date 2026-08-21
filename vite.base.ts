import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function versionDiagnostics(root: string) {
  const pkgVersion = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    .version as string;
  if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(pkgVersion)) {
    throw new Error(`invalid package.json version for the release marker: "${pkgVersion}"`);
  }
  return { pkgVersion, buildTime: new Date().toISOString() };
}

export function apiProxyConfig() {
  const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8090';
  return {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
    },
  };
}

export function cacheDirConfig(name: 'app' | 'admin' | 'landing') {
  return `../node_modules/.vite-${name}`;
}
