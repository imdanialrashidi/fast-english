// admin/src/theme/AdminThemeSync.tsx
// Keeps browser chrome coherent with the active color scheme: syncs
// <meta name="theme-color"> and <meta name="color-scheme">. The Admin is
// Web-only, so the Capacitor system-bar behavior of the Student app is
// intentionally absent.
import { useColorScheme } from '@mui/material/styles';
import { useEffect } from 'react';
import { semanticDark, semanticLight } from '../../../shared/ui/tokens/colors';

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

export function AdminThemeSync() {
  const { colorScheme } = useColorScheme();
  const resolved = colorScheme ?? 'light';

  useEffect(() => {
    syncMeta('theme-color', META_COLOR[resolved]);
    syncMeta('color-scheme', META_SCHEME[resolved]);
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  return null;
}
