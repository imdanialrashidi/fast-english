// Builds MUI PaletteOptions for each color scheme from the semantic tokens.
// `semanticLight`/`semanticDark` remain the single source of truth; this
// module only maps roles onto MUI palette shape (including custom roles
// added by theme.augment.ts).

import type { PaletteOptions } from '@mui/material/styles';
import { semanticDark, semanticLight } from './tokens/colors';

type SemanticSet = { [K in keyof typeof semanticLight]: string };

function toPalette(set: SemanticSet, mode: 'light' | 'dark'): PaletteOptions {
  const c = set;
  return {
    mode,
    primary: { main: c.primary, contrastText: c.onPrimary },
    secondary: { main: c.secondary, contrastText: c.onSecondary },
    primaryHover: c.primaryHover,
    primaryPressed: c.primaryPressed,
    primaryContainer: c.primaryContainer,
    onPrimaryContainer: c.onPrimaryContainer,
    onSecondary: c.onSecondary,
    secondaryContainer: c.secondaryContainer,
    onSecondaryContainer: c.onSecondaryContainer,
    accent: c.accent,
    onAccent: c.onAccent,
    accentContainer: c.accentContainer,
    onAccentContainer: c.onAccentContainer,
    background: { default: c.background, paper: c.surface },
    onBackground: c.onBackground,
    text: { primary: c.onSurface, secondary: c.onSurfaceVariant, disabled: c.disabledForeground },
    divider: c.outlineVariant,
    surface: c.surface,
    surfaceDim: c.surfaceDim,
    surfaceBright: c.surfaceBright,
    surfaceContainerLowest: c.surfaceContainerLowest,
    surfaceContainerLow: c.surfaceContainerLow,
    surfaceContainer: c.surfaceContainer,
    surfaceContainerHigh: c.surfaceContainerHigh,
    surfaceContainerHighest: c.surfaceContainerHighest,
    onSurface: c.onSurface,
    onSurfaceVariant: c.onSurfaceVariant,
    outline: c.outline,
    outlineVariant: c.outlineVariant,
    inverseSurface: c.inverseSurface,
    inverseOnSurface: c.inverseOnSurface,
    success: { main: c.success, contrastText: c.onSuccess },
    successContainer: c.successContainer,
    onSuccessContainer: c.onSuccessContainer,
    warning: { main: c.warning, contrastText: c.onWarning },
    warningContainer: c.warningContainer,
    onWarningContainer: c.onWarningContainer,
    error: { main: c.error, contrastText: c.onError },
    errorContainer: c.errorContainer,
    onErrorContainer: c.onErrorContainer,
    info: { main: c.info, contrastText: c.onInfo },
    infoContainer: c.infoContainer,
    onInfoContainer: c.onInfoContainer,
    focusRing: c.focusRing,
    scrim: c.scrim,
    disabledBackground: c.disabledBackground,
    disabledForeground: c.disabledForeground,
  };
}

export function buildLightPalette(): PaletteOptions {
  return toPalette(semanticLight, 'light');
}

export function buildDarkPalette(): PaletteOptions {
  return toPalette(semanticDark, 'dark');
}
