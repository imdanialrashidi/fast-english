import { CacheProvider } from '@emotion/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { createRtlCache } from './app/theme/rtl';
import { appTheme } from './app/theme/theme';
import { PwaManager } from './pwa/PwaManager';
import { isNativeRuntime, unregisterStaleServiceWorkers } from './pwa/register';
import './styles.css';

// P4-S2 — The PWA Service Worker must not run inside the Capacitor Native
// WebView. In Native mode no registration is created and stale registrations
// are removed; on the Web the PwaManager registers the App-shell worker and
// drives the explicit update prompt.
const nativeRuntime = isNativeRuntime();
if (nativeRuntime) {
  void unregisterStaleServiceWorkers();
}

// RTL cache is created once and shared across the app so MUI portal
// components (Dialog, Menu, Popover, Tooltip, Drawer) inherit the correct
// logical-property transforms and text alignment.
const rtlCache = createRtlCache();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing in app/index.html');
}

createRoot(container).render(
  <StrictMode>
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
          {!nativeRuntime && <PwaManager />}
        </BrowserRouter>
      </ThemeProvider>
    </CacheProvider>
  </StrictMode>,
);
