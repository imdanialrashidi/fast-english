// app/src/pwa/register.test.ts
// P4-S2 — Service Worker registration policy.
// The PWA Service Worker must never run inside the Capacitor Native
// WebView; stale registrations are unregistered instead.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isNativeRuntime,
  serviceWorkerAvailable,
  shouldRegisterPwa,
  unregisterStaleServiceWorkers,
} from './register';

const nativeApi = (value: boolean) => ({ isNativePlatform: () => value });

describe('shouldRegisterPwa', () => {
  it('registers on the Web', () => {
    expect(shouldRegisterPwa(false)).toBe(true);
  });

  it('never registers in the Native Capacitor environment', () => {
    expect(shouldRegisterPwa(true)).toBe(false);
  });
});

describe('isNativeRuntime', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects Native via the supported Capacitor.isNativePlatform API', () => {
    vi.stubGlobal('window', { __FEP_NATIVE__: undefined, Capacitor: nativeApi(true) });
    expect(isNativeRuntime()).toBe(true);
  });

  it('returns false on the Web platform', () => {
    vi.stubGlobal('window', { __FEP_NATIVE__: undefined, Capacitor: nativeApi(false) });
    expect(isNativeRuntime()).toBe(false);
  });

  it('returns false when Capacitor is absent (plain browser)', () => {
    vi.stubGlobal('window', { __FEP_NATIVE__: undefined });
    expect(isNativeRuntime()).toBe(false);
  });

  it('returns false without a window (SSR/tests)', () => {
    vi.stubGlobal('window', undefined);
    expect(isNativeRuntime()).toBe(false);
    void originalWindow;
  });
});

describe('unregisterStaleServiceWorkers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('unregisters stale registrations in Native mode', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: async () => [{ unregister }] },
    });
    await unregisterStaleServiceWorkers();
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('is a safe no-op when serviceWorker is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    await expect(unregisterStaleServiceWorkers()).resolves.toBeUndefined();
    expect(serviceWorkerAvailable()).toBe(false);
  });
});
