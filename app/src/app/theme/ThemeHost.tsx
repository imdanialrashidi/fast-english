// ThemeHost: keeps browser/OS chrome coherent with the active color scheme.
//
// - Syncs `<meta name="theme-color">` (browser/PWA chrome) and
//   `<meta name="color-scheme">` to the resolved scheme. The values are the
//   documented browser-metadata exception for raw hex in index.html; here
//   they come from the semantic tokens.
// - Applies the Capacitor Android StatusBar/NavigationBar style in Native
//   mode only (see lib/systemBars.ts).

import { useColorScheme } from '@mui/material/styles';
import { useEffect } from 'react';
import { applySystemBarTheme } from '../../lib/systemBars';
import { semanticDark, semanticLight } from './tokens/colors';

const META_COLOR = {
  light: semanticLight.surfaceContainerLow,
  dark: semanticDark.surfaceContainerLow,
};
const META_SCHEME = { light: 'light', dark: 'dark' } as const;

function syncMeta(name: string, content: string): void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

export function ThemeHost() {
  const { colorScheme } = useColorScheme();
  const resolved = colorScheme ?? 'light';

  useEffect(() => {
    syncMeta('theme-color', META_COLOR[resolved]);
    syncMeta('color-scheme', META_SCHEME[resolved]);
    // Keep the pre-paint inline color-scheme (set by the init script in
    // index.html) in sync with runtime scheme changes; it takes precedence
    // over the generated stylesheet so native controls always match.
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  useEffect(() => {
    void applySystemBarTheme(resolved);
  }, [resolved]);

  return null;
}
