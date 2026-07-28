// app/src/lib/apiOrigin.ts
// Environment-aware PocketBase API origin resolver.
//
// - Browser development: Vite proxies `/api` to the local PB. We use
//   `window.location.origin` so the SDK hits the same origin (Caddy/proxy).
// - Browser production: same-origin (`https://app.fastenglishpodcast.com`).
// - Android debug: explicit `VITE_ANDROID_API_ORIGIN` via `adb reverse`.
// - Android release: hard-coded production origin.

export type ResolvedOrigin = {
  origin: string;
  isNative: boolean;
  isProduction: boolean;
};

declare global {
  interface Window {
    __FEP_NATIVE__?: boolean;
  }
}

function isNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__FEP_NATIVE__ === true) return true;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function') {
    return cap.isNativePlatform();
  }
  return false;
}

// Read Vite-injected env at build time. The `import.meta.env` typings are
// provided by `vite/client` which is already imported by the app entry.
function readEnv(key: string): string | undefined {
  const meta = import.meta as unknown as { env?: Record<string, unknown> };
  const v = meta.env?.[key];
  return typeof v === 'string' ? v : undefined;
}

function isProductionBuild(): boolean {
  return readEnv('PROD') === 'true';
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  );
}

function isHttpScheme(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

export function resolveApiOrigin(): ResolvedOrigin {
  const isNative = isNativeRuntime();
  const isProduction = isProductionBuild();

  if (isNative && isProduction) {
    // Hard-coded production origin for native release builds.
    return { origin: 'https://app.fastenglishpodcast.com', isNative, isProduction };
  }

  if (isNative) {
    // Native debug build: explicit env override.
    const envOrigin = readEnv('VITE_ANDROID_API_ORIGIN');
    if (!envOrigin || envOrigin.length === 0) {
      throw new Error(
        'VITE_ANDROID_API_ORIGIN is required for native debug builds (e.g. http://localhost:8090 with adb reverse).',
      );
    }
    const url = new URL(envOrigin);
    if (!isHttpScheme(url)) {
      throw new Error(`VITE_ANDROID_API_ORIGIN must be http(s): ${envOrigin}`);
    }
    if (isProduction && isLoopbackHost(url.hostname)) {
      throw new Error(`VITE_ANDROID_API_ORIGIN must not be loopback in production.`);
    }
    return { origin: envOrigin.replace(/\/+$/, ''), isNative, isProduction };
  }

  // Browser: same-origin.
  if (typeof window === 'undefined') {
    // SSR or test environment — caller is responsible.
    throw new Error('Cannot resolve API origin: no window available.');
  }
  return { origin: window.location.origin, isNative, isProduction };
}
