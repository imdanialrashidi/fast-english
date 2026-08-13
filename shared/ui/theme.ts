// Fast English Podcast product-app theme (Visual Slice 1).
//
// - MUI v9 CSS theme variables with Light/Dark/System color schemes.
// - `colorSchemeSelector: 'data-color-scheme'` — REQUIRED: when both light
//   and dark schemes exist, MUI defaults the selector to `media`, which
//   disables manual `setMode`. The init script in app/index.html sets the
//   attribute before first paint (no flash).
// - Semantic palette roles (see tokens/colors.ts + palette.ts).
// - Typography, shape, elevation, motion and focus come from the tokens in
//   tokens/ so no raw values are scattered through components.
// - Default mode for new users is `system` (MUI provider default).

import { createTheme } from '@mui/material/styles';
import { buildDarkPalette, buildLightPalette } from './palette';
import {
  breakpoints,
  duration,
  easing,
  elevationDark,
  elevationLight,
  fontStacks,
  layout,
  motion,
  muiSpacing,
  radius,
  typeScale,
  zIndex,
} from './tokens';

const typographyMap = {
  ...typeScale,
  // Keep the standard MUI variants working with the same hierarchy.
  h1: typeScale.displayLarge,
  h2: typeScale.headlineMedium,
  h3: typeScale.headlineSmall,
  h4: typeScale.titleLarge,
  h5: typeScale.titleMedium,
  h6: typeScale.titleMedium,
  subtitle1: typeScale.titleMedium,
  subtitle2: typeScale.titleSmall,
  body1: typeScale.bodyLarge,
  body2: typeScale.bodySmall,
  caption: typeScale.labelSmall,
  overline: { ...typeScale.labelSmall, textTransform: 'none' },
  button: { ...typeScale.labelLarge, textTransform: 'none' },
};

export const appTheme = createTheme({
  direction: 'rtl',
  // v9: the color-scheme configuration moves under `cssVariables`.
  // `colorSchemeSelector` MUST be explicit — with both schemes present MUI
  // defaults to `media`, which disables manual `setMode`.
  cssVariables: { colorSchemeSelector: 'data-color-scheme' },
  colorSchemes: {
    light: {
      palette: buildLightPalette(),
      elevation: elevationLight,
    },
    dark: {
      palette: buildDarkPalette(),
      elevation: elevationDark,
    },
  },
  shape: { borderRadius: radius.radiusInput },
  spacing: muiSpacing,
  breakpoints: { values: breakpoints },
  zIndex: {
    appBar: zIndex.stickyHeader,
    drawer: zIndex.drawer,
    modal: zIndex.dialog,
    snackbar: zIndex.snackbar,
    tooltip: zIndex.tooltip,
  },
  typography: {
    fontFamily: fontStacks.fa,
    htmlFontSize: 16,
    ...typographyMap,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: 'var(--mui-palette-background-default)',
          color: 'var(--mui-palette-text-primary)',
        },
        // One visible focus treatment for every interactive element.
        ':focus-visible': {
          outline: '2px solid var(--mui-palette-focusRing)',
          outlineOffset: 2,
        },
        // Respect user reduced-motion preference: remove nonessential
        // movement while preserving immediate state feedback.
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

    MuiButtonBase: {
      styleOverrides: {
        root: {
          // MUI v9 removes the outline on ButtonBase roots; restore a
          // clearly visible focus ring for keyboard navigation.
          '&.Mui-focusVisible': {
            outline: '2px solid var(--mui-palette-focusRing)',
            outlineOffset: 2,
          },
        },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: radius.radiusControl,
          paddingInline: 20,
          textTransform: 'none',
          fontWeight: 600,
          '&.Mui-disabled': {
            color: 'var(--mui-palette-disabledForeground)',
            backgroundColor: 'var(--mui-palette-disabledBackground)',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
          '&.MuiButton-colorPrimary': {
            '&:hover': { backgroundColor: 'var(--mui-palette-primaryHover)' },
            '&:active': { backgroundColor: 'var(--mui-palette-primaryPressed)' },
          },
          '&.MuiButton-colorSecondary': {
            '&:hover': {
              backgroundColor: 'var(--mui-palette-secondary-main)',
              filter: 'brightness(0.92)',
            },
            '&:active': { filter: 'brightness(0.85)' },
          },
        },
        outlined: {
          borderColor: 'var(--mui-palette-outline)',
          color: 'var(--mui-palette-primary-main)',
          '&:hover': {
            borderColor: 'var(--mui-palette-primary-main)',
            backgroundColor: 'transparent',
          },
        },
        text: { color: 'var(--mui-palette-primary-main)' },
        sizeLarge: { minHeight: 48, fontSize: '1rem' },
        sizeSmall: { minHeight: 36, fontSize: '0.875rem', paddingInline: 12 },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          // Minimum practical touch target (44x44).
          minWidth: 44,
          minHeight: 44,
          color: 'var(--mui-palette-onSurfaceVariant)',
          '&:hover': {
            backgroundColor: 'color-mix(in srgb, var(--mui-palette-onSurface) 8%, transparent)',
          },
          '&.Mui-disabled': { color: 'var(--mui-palette-disabledForeground)' },
        },
      },
    },

    MuiTextField: {
      defaultProps: { variant: 'outlined', fullWidth: true },
    },

    MuiInputBase: {
      styleOverrides: {
        root: { minHeight: 48, '&.Mui-disabled': { opacity: 0.6 } },
        input: { fontSize: '1rem' },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.radiusInput,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--mui-palette-outlineVariant)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--mui-palette-outline)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--mui-palette-primary-main)',
            borderWidth: 2,
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--mui-palette-error-main)',
          },
        },
      },
    },

    MuiInputLabel: {
      styleOverrides: { root: { fontWeight: 500 } },
    },

    MuiFormHelperText: {
      styleOverrides: { root: { marginInline: 4, fontSize: '0.8125rem' } },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--mui-palette-surface)',
          color: 'var(--mui-palette-onSurface)',
        },
      },
    },

    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          borderRadius: radius.radiusCard,
          borderColor: 'var(--mui-palette-outlineVariant)',
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          color: 'var(--mui-palette-onSurface)',
          boxShadow: 'none',
        },
      },
    },

    MuiAppBar: {
      defaultProps: { color: 'inherit', elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          color: 'var(--mui-palette-onSurface)',
          borderBottom: '1px solid',
          borderColor: 'var(--mui-palette-outlineVariant)',
        },
      },
    },

    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: layout.headerHeight.xs,
          [`@media (min-width: ${breakpoints.md}px)`]: { minHeight: layout.headerHeight.md },
        },
      },
    },

    MuiDrawer: {
      defaultProps: { dir: 'rtl' },
      styleOverrides: {
        paper: {
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          color: 'var(--mui-palette-onSurface)',
        },
      },
    },

    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          height: layout.bottomNavigationHeight,
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          borderTop: '1px solid',
          borderColor: 'var(--mui-palette-outlineVariant)',
        },
      },
    },

    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 64,
          color: 'var(--mui-palette-onSurfaceVariant)',
          '&.Mui-selected': {
            color: 'var(--mui-palette-primary-main)',
            '& .MuiBottomNavigationAction-label': { fontWeight: 600 },
            // Selected state carries a shape indicator, not color alone.
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: 6,
              insetInlineStart: '50%',
              transform: 'translateX(-50%)',
              width: 20,
              height: 4,
              borderRadius: radius.radiusPill,
              backgroundColor: 'var(--mui-palette-primary-main)',
            },
          },
        },
      },
    },

    MuiDialog: {
      defaultProps: { dir: 'rtl' },
      styleOverrides: {
        paper: {
          borderRadius: radius.radiusDialog,
          backgroundColor: 'var(--mui-palette-surfaceContainerHigh)',
          color: 'var(--mui-palette-onSurface)',
          boxShadow: 'var(--mui-elevation-dialog)',
          maxWidth: 'calc(100vw - 32px)',
        },
      },
    },

    MuiMenu: {
      defaultProps: { dir: 'rtl' },
      styleOverrides: {
        paper: {
          borderRadius: radius.radiusControl,
          backgroundColor: 'var(--mui-palette-surfaceContainerLow)',
          boxShadow: 'var(--mui-elevation-interactive)',
          border: '1px solid',
          borderColor: 'var(--mui-palette-outlineVariant)',
        },
      },
    },

    MuiPopover: {
      defaultProps: { dir: 'rtl' },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: radius.radiusInput },
        standard: {
          '&.MuiAlert-colorSuccess': {
            backgroundColor: 'var(--mui-palette-successContainer)',
            color: 'var(--mui-palette-onSuccessContainer)',
            '& .MuiAlert-icon': { color: 'var(--mui-palette-onSuccessContainer)' },
          },
          '&.MuiAlert-colorError': {
            backgroundColor: 'var(--mui-palette-errorContainer)',
            color: 'var(--mui-palette-onErrorContainer)',
            '& .MuiAlert-icon': { color: 'var(--mui-palette-onErrorContainer)' },
          },
          '&.MuiAlert-colorWarning': {
            backgroundColor: 'var(--mui-palette-warningContainer)',
            color: 'var(--mui-palette-onWarningContainer)',
            '& .MuiAlert-icon': { color: 'var(--mui-palette-onWarningContainer)' },
          },
          '&.MuiAlert-colorInfo': {
            backgroundColor: 'var(--mui-palette-infoContainer)',
            color: 'var(--mui-palette-onInfoContainer)',
            '& .MuiAlert-icon': { color: 'var(--mui-palette-onInfoContainer)' },
          },
        },
        filled: {
          '&.MuiAlert-colorSuccess': {
            backgroundColor: 'var(--mui-palette-success-main)',
            color: 'var(--mui-palette-onSuccess)',
            '& .MuiAlert-icon': { color: 'var(--mui-palette-onSuccess)' },
          },
          '&.MuiAlert-colorError': {
            backgroundColor: 'var(--mui-palette-error-main)',
            color: 'var(--mui-palette-onError)',
            '& .MuiAlert-icon': { color: 'var(--mui-palette-onError)' },
          },
          '&.MuiAlert-colorWarning': {
            backgroundColor: 'var(--mui-palette-warning-main)',
            color: 'var(--mui-palette-onWarning)',
            '& .MuiAlert-icon': { color: 'var(--mui-palette-onWarning)' },
          },
          '&.MuiAlert-colorInfo': {
            backgroundColor: 'var(--mui-palette-info-main)',
            color: 'var(--mui-palette-onInfo)',
            '& .MuiAlert-icon': { color: 'var(--mui-palette-onInfo)' },
          },
        },
      },
    },

    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--mui-palette-inverseSurface)',
          color: 'var(--mui-palette-inverseOnSurface)',
          borderRadius: radius.radiusCard,
          boxShadow: 'var(--mui-elevation-dialog)',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.radiusPill, fontWeight: 500 },
        outlined: { borderColor: 'var(--mui-palette-outlineVariant)' },
      },
    },

    MuiBadge: {
      styleOverrides: {
        badge: {
          backgroundColor: 'var(--mui-palette-error-main)',
          color: 'var(--mui-palette-onError)',
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 48 },
        indicator: { backgroundColor: 'var(--mui-palette-primary-main)' },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
          textTransform: 'none',
          fontWeight: 600,
          color: 'var(--mui-palette-onSurfaceVariant)',
          '&.Mui-selected': { color: 'var(--mui-palette-primary-main)' },
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 6,
          borderRadius: radius.radiusPill,
          backgroundColor: 'color-mix(in srgb, var(--mui-palette-primary-main) 18%, transparent)',
        },
        bar: {
          borderRadius: radius.radiusPill,
          backgroundColor: 'var(--mui-palette-primary-main)',
        },
      },
    },

    MuiCircularProgress: {
      styleOverrides: { root: { color: 'var(--mui-palette-primary-main)' } },
    },

    MuiSkeleton: {
      styleOverrides: {
        root: { backgroundColor: 'var(--mui-palette-surfaceContainerHighest)' },
      },
    },

    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 400 },
      styleOverrides: {
        tooltip: {
          fontSize: '0.8125rem',
          borderRadius: radius.radiusControl,
          backgroundColor: 'var(--mui-palette-inverseSurface)',
          color: 'var(--mui-palette-inverseOnSurface)',
          boxShadow: 'var(--mui-elevation-interactive)',
        },
        arrow: { color: 'var(--mui-palette-inverseSurface)' },
      },
    },

    MuiListItemButton: {
      styleOverrides: { root: { minHeight: 44, borderRadius: radius.radiusControl } },
    },

    MuiDivider: {
      styleOverrides: { root: { borderColor: 'var(--mui-palette-outlineVariant)' } },
    },
  },
});

// Duration/easing tokens are re-exported so components share the exact
// values the theme uses for its own transitions.
export const themeMotion = { duration, easing, motion };
