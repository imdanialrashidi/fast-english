import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type PluginOption } from 'vite';

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

// ---------------------------------------------------------------------------
// Deep surface factory — hides the 6 duplicated blocks that every
// vite.*.config.ts previously repeated (version diagnostics, define,
// transformIndexHtml release marker, outDir/emptyOutDir, server port +
// proxy, preview port + proxy, cacheDir). Callers supply only what
// varies per surface (plugins, rollup input, envDir).
// ---------------------------------------------------------------------------

export interface SurfaceConfigOpts {
  /** Absolute directory of the repository root (for versionDiagnostics). */
  rootDir: string;
  /** Surface name — drives cacheDir and root. */
  surface: 'app' | 'landing' | 'admin';
  /** Vite `root` (relative, e.g. 'app'). */
  viteRoot: string;
  /** Define key for the version (e.g. '__APP_VERSION__'). */
  versionDefineKey: string;
  /** HTML data attribute for the release marker (e.g. 'data-app-version'). */
  dataAttr: string;
  serverPort: number;
  previewPort: number;
  /** Relative outDir from repo root (e.g. '../dist-app'). */
  outDir: string;
  /** Extra plugins that vary per surface (react, tailwindcss, VitePWA, …). */
  plugins?: PluginOption[];
  /** Optional envDir (landing + admin share repo-root .env). */
  envDir?: string;
  /** Optional rollup input for multi-page landing. */
  rollupInput?: Record<string, string>;
}

/**
 * Deep module factory for the three isolated Vite surfaces.
 * The interface is the test surface: one call hides versionDiagnostics +
 * apiProxyConfig + cacheDirConfig + define + transformIndexHtml +
 * build + server/preview. Adding a fourth surface is one call, not a
 * new 60-line file to keep in sync.
 */
export function createSurfaceConfig(opts: SurfaceConfigOpts) {
  const { pkgVersion, buildTime } = versionDiagnostics(opts.rootDir);
  const apiProxy = apiProxyConfig();

  const versionPlugin: PluginOption = {
    name: `${opts.surface}-release-identity`,
    transformIndexHtml(html: string) {
      return html.replace(
        '<div id="root"',
        `<div id="root" ${opts.dataAttr}="${pkgVersion}" data-build-time="${buildTime}"`,
      );
    },
  };

  return defineConfig({
    root: opts.viteRoot,
    cacheDir: cacheDirConfig(opts.surface),
    plugins: [...(opts.plugins ?? []), versionPlugin],
    define: {
      [opts.versionDefineKey]: JSON.stringify(pkgVersion),
      __BUILD_TIME__: JSON.stringify(buildTime),
    },
    ...(opts.envDir ? { envDir: opts.envDir } : {}),
    build: {
      outDir: opts.outDir,
      emptyOutDir: true,
      ...(opts.rollupInput ? { rollupOptions: { input: opts.rollupInput } } : {}),
    },
    server: {
      port: opts.serverPort,
      strictPort: true,
      proxy: apiProxy,
    },
    preview: {
      port: opts.previewPort,
      strictPort: true,
      proxy: apiProxy,
    },
  });
}
