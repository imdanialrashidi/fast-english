// System-bars (Capacitor Android) behavior tests.
//
// Verifies the theme-to-system-bar mapping is pure, that the plugin is
// called ONLY in Native mode, and that Web mode never fails when the
// Capacitor plugins are unavailable.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySystemBarTheme, systemBarStyleForMode } from './systemBars';

// The module reads window at call time; each test builds its own fake.
function installWindow(fake: { native?: boolean; systemBars?: unknown }) {
  const calls: Array<{ style: string; bar: string }> = [];
  const win = {
    __FEP_NATIVE__: fake.native === true ? true : undefined,
    Capacitor: {
      isNativePlatform: () => fake.native === true,
      getPlatform: () => 'android',
      SystemBars: fake.systemBars ?? {
        setStyle: async (o: { style: string; bar?: string }) => {
          calls.push({ style: o.style, bar: o.bar ?? '' });
        },
      },
    },
  } as unknown as Window & typeof globalThis;
  (globalThis as { window?: unknown }).window = win;
  return { calls, win };
}

describe('system bars (Capacitor Android)', () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = undefined;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as { window?: unknown }).window = undefined;
  });

  it('maps theme modes to the correct SystemBarsStyle values', () => {
    expect(systemBarStyleForMode('dark')).toBe('DARK');
    expect(systemBarStyleForMode('light')).toBe('LIGHT');
  });

  it('calls setStyle for StatusBar and NavigationBar only in Native mode', async () => {
    const { calls } = installWindow({ native: true });
    await applySystemBarTheme('dark');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ style: 'DARK', bar: 'StatusBar' });
    expect(calls[1]).toEqual({ style: 'DARK', bar: 'NavigationBar' });
  });

  it('uses the LIGHT style for Light mode in Native mode', async () => {
    const { calls } = installWindow({ native: true });
    await applySystemBarTheme('light');
    expect(calls.every((c) => c.style === 'LIGHT')).toBe(true);
  });

  it('never calls the plugin on the Web', async () => {
    const { calls } = installWindow({ native: false });
    await applySystemBarTheme('dark');
    expect(calls).toHaveLength(0);
  });

  it('does not fail on the Web when Capacitor is unavailable', async () => {
    installWindow({ native: false, systemBars: undefined });
    (globalThis as { window?: unknown }).window = {
      __FEP_NATIVE__: undefined,
    } as Window;
    await expect(applySystemBarTheme('dark')).resolves.toBeUndefined();
  });

  it('does not fail in Native mode when the plugin is missing', async () => {
    const { win } = installWindow({ native: true, systemBars: undefined });
    (win as unknown as { Capacitor: { SystemBars?: unknown } }).Capacitor.SystemBars = undefined;
    await expect(applySystemBarTheme('light')).resolves.toBeUndefined();
  });

  it('swallows plugin failures without throwing', async () => {
    installWindow({
      native: true,
      systemBars: {
        setStyle: async () => {
          throw new Error('plugin crashed');
        },
      },
    });
    await expect(applySystemBarTheme('dark')).resolves.toBeUndefined();
  });

  it('uses the same native-detection seam as the PWA register policy', async () => {
    // The `__FEP_NATIVE__` seam forces native behavior in browser tests.
    const { calls } = installWindow({ native: true });
    await applySystemBarTheme('dark');
    expect(calls.length).toBe(2);
  });
});
