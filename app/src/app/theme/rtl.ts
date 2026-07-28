import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';

// Emotion cache that processes RTL rules through the official MUI RTL Stylis plugin.
// This is the layer that makes MUI portal components (Dialog, Menu, Popover, Tooltip, Drawer)
// render correctly in an RTL document.

export function createRtlCache() {
  return createCache({
    key: 'mui-rtl',
    stylisPlugins: [prefixer, rtlPlugin],
  });
}
