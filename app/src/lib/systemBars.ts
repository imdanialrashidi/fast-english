// Capacitor Android system-bar integration (Visual Slice 1).
//
// Uses the Capacitor 8 core `SystemBars` plugin (verified in the installed
// @capacitor/core 8.4.2): `SystemBars.setStyle({ style, bar })` with
// `SystemBarsStyle.Light` (dark icons on a light background) for Light mode
// and `SystemBarsStyle.Dark` (light icons on a dark background) for Dark
// mode, applied to both the StatusBar and the NavigationBar.
//
// - Only called in Native mode (same `window.__FEP_NATIVE__` seam and
//   Capacitor API check used by apiOrigin.ts / register.ts).
// - Never throws in Web mode or when the plugin is unavailable.

import { isNativeRuntime } from '../pwa/register';

export type ThemeMode = 'light' | 'dark';

declare global {
  interface Window {
    __FEP_NATIVE__?: boolean;
  }
}

interface SystemBarsLike {
  setStyle?: (options: { style: 'LIGHT' | 'DARK'; bar?: string }) => Promise<unknown>;
}

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  SystemBars?: SystemBarsLike;
}

function systemBarsPlugin(): SystemBarsLike | undefined {
  const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
  return cap?.SystemBars;
}

/**
 * Apply the active theme to the Android system bars. Web mode is a no-op;
 * if the plugin is unavailable (or the call fails) the app keeps working.
 */
export async function applySystemBarTheme(mode: ThemeMode): Promise<void> {
  if (!isNativeRuntime()) return;
  const plugin = systemBarsPlugin();
  if (!plugin?.setStyle) return;
  const style = mode === 'dark' ? 'DARK' : 'LIGHT';
  try {
    // Both bars in one call per type (Android: StatusBar + NavigationBar).
    await Promise.all([
      plugin.setStyle({ style, bar: 'StatusBar' }),
      plugin.setStyle({ style, bar: 'NavigationBar' }),
    ]);
  } catch {
    // Non-fatal: the WebView still renders; system bars keep their prior style.
  }
}

/** Pure mapping used by tests: theme mode -> SystemBarsStyle value. */
export function systemBarStyleForMode(mode: ThemeMode): 'LIGHT' | 'DARK' {
  return mode === 'dark' ? 'DARK' : 'LIGHT';
}
