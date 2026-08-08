// admin/src/main.tsx
// Admin Console entry. No PWA Service Worker, no Student manifest, no
// Capacitor integration — the Admin is a plain web SPA (Podcast Slice 1).

import { CacheProvider } from '@emotion/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRtlCache } from '../../shared/ui/rtl';
import { appTheme } from '../../shared/ui/theme';
import { AdminApp } from './AdminApp';
import { AdminThemeSync } from './theme/AdminThemeSync';
import './styles.css';

const rtlCache = createRtlCache();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing in admin/index.html');
}

createRoot(container).render(
  <StrictMode>
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <AdminThemeSync />
        <AdminApp />
      </ThemeProvider>
    </CacheProvider>
  </StrictMode>,
);
