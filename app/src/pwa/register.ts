// app/src/pwa/register.ts
// PWA registration policy (P4-S2).
//
// - Web: the Service Worker registers (safe App-shell caching only).
// - Capacitor Native: the Service Worker must NOT run inside the Android
//   WebView; stale registrations are removed instead and the bundled
//   Capacitor web assets are used as-is.

declare global {
  interface Window {
    __FEP_NATIVE__?: boolean;
  }
}

// Detect the Native Capacitor environment with the supported Capacitor API
// (Capacitor.isNativePlatform). `window.__FEP_NATIVE__` is the same test/ops
// seam already used by apiOrigin.ts for simulated-native scenarios (e.g.
// Android WebView assertions).
export function isNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__FEP_NATIVE__ === true) return true;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
}

// Pure policy decision: the PWA Service Worker only registers on the Web.
export function shouldRegisterPwa(native: boolean): boolean {
  return !native;
}

export function serviceWorkerAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

// Native mode: remove stale Service Worker registrations where safe so the
// WebView never runs a PWA Service Worker. Web mode: no-op.
export async function unregisterStaleServiceWorkers(): Promise<void> {
  if (!serviceWorkerAvailable()) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}
