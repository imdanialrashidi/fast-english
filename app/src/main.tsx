import { CacheProvider } from '@emotion/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { createRtlCache } from './app/theme/rtl';
import { appTheme } from './app/theme/theme';
import './styles.css';

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
        </BrowserRouter>
      </ThemeProvider>
    </CacheProvider>
  </StrictMode>,
);
