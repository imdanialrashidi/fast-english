import { createTheme } from '@mui/material/styles';
import { brand, cefr, radius, spacing } from './tokens';

// One central product-app theme.
// - MUI CSS theme variables enabled (cssVariables: true)
// - RTL direction
// - Vazirmatn typography (loaded locally in styles.css)
// - Semantic palette tokens; raw colors must not be scattered through components
// - Component defaults reflect the visual direction in docs/PRODUCT.md
export const appTheme = createTheme({
  direction: 'rtl',
  cssVariables: true,
  shape: {
    borderRadius: radius.md,
  },
  spacing: spacing as unknown as number[],
  breakpoints: {
    values: {
      xs: 360,
      sm: 600,
      md: 768,
      lg: 1024,
      xl: 1440,
    },
  },
  palette: {
    mode: 'light',
    primary: {
      main: brand.primary,
      dark: brand.primaryDark,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: brand.secondary,
      contrastText: '#FFFFFF',
    },
    background: {
      default: brand.backgroundDefault,
      paper: brand.backgroundPaper,
    },
    text: {
      primary: brand.textPrimary,
      secondary: brand.textSecondary,
    },
    divider: brand.divider,
    success: { main: brand.success },
    warning: { main: brand.warning },
    error: { main: brand.error },
  },
  typography: {
    fontFamily:
      '"Vazirmatn", "IRANSansX", "Tahoma", "Segoe UI", system-ui, -apple-system, sans-serif',
    h1: { fontWeight: 700, fontSize: '1.875rem', lineHeight: 1.3 },
    h2: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.35 },
    h3: { fontWeight: 700, fontSize: '1.25rem', lineHeight: 1.4 },
    h4: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.45 },
    h5: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 },
    h6: { fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.5 },
    body1: { fontSize: '1rem', lineHeight: 1.7 },
    body2: { fontSize: '0.875rem', lineHeight: 1.7 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: brand.backgroundDefault,
          color: brand.textPrimary,
        },
        // Focus ring uses theme primary; visible in all themes.
        ':focus-visible': {
          outline: `2px solid ${brand.primary}`,
          outlineOffset: 2,
        },
        // Respect user reduced-motion preference.
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 44, borderRadius: radius.md, paddingInline: 20 },
        sizeLarge: { minHeight: 48, fontSize: '1rem' },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          borderColor: brand.divider,
          borderRadius: radius.lg,
          boxShadow: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', fullWidth: true },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { minHeight: 48 },
        input: { fontSize: '1rem' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.sm, fontWeight: 500 },
      },
    },
    MuiDialog: {
      defaultProps: { dir: 'rtl' },
      styleOverrides: {
        paper: { borderRadius: radius.lg },
      },
    },
    MuiMenu: {
      defaultProps: { dir: 'rtl' },
    },
    MuiPopover: {
      defaultProps: { dir: 'rtl' },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 400 },
      styleOverrides: {
        tooltip: { fontSize: '0.8125rem', borderRadius: radius.sm },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          height: 64,
          borderTop: `1px solid ${brand.divider}`,
          backgroundColor: brand.backgroundPaper,
        },
      },
    },
    MuiAppBar: {
      defaultProps: { color: 'inherit', elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: brand.midnight,
          color: '#FFFFFF',
          borderBottom: 'none',
        },
      },
    },
    MuiDrawer: {
      defaultProps: { dir: 'rtl' },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: radius.md } },
    },
  },
});

// CEFR palette helpers are exposed via theme augmentation so components can
// read them through `theme.vars.custom.cefr` (CSS variables) and not raw hex.
export const cefrVars = cefr;
