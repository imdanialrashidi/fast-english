// Type-level augmentation for the MUI theme so the Fast English semantic
// roles, typography variants and scheme-level elevation tokens are typed.
// Runtime definitions live in palette.ts / theme.ts.

import type { CSSProperties } from 'react';
import type { elevationLight } from './tokens/elevation';

export type ElevationTokens = { [K in keyof typeof elevationLight]: string };

declare module '@mui/material/styles' {
  // v9: opt into the CSS-variables theme surface (colorSchemes,
  // colorSchemeSelector, vars) — the documented augmentation from
  // createThemeNoVars.d.ts.
  interface CssThemeVariables {
    enabled: true;
  }

  interface Palette {
    primaryHover: string;
    primaryPressed: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    accent: string;
    onAccent: string;
    accentContainer: string;
    onAccentContainer: string;
    onBackground: string;
    surface: string;
    surfaceDim: string;
    surfaceBright: string;
    surfaceContainerLowest: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    onSurface: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    inverseSurface: string;
    inverseOnSurface: string;
    onSuccess: string;
    successContainer: string;
    onSuccessContainer: string;
    onWarning: string;
    warningContainer: string;
    onWarningContainer: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;
    onInfo: string;
    infoContainer: string;
    onInfoContainer: string;
    focusRing: string;
    scrim: string;
    disabledBackground: string;
    disabledForeground: string;
  }

  interface PaletteOptions {
    primaryHover?: string;
    primaryPressed?: string;
    primaryContainer?: string;
    onPrimaryContainer?: string;
    onSecondary?: string;
    secondaryContainer?: string;
    onSecondaryContainer?: string;
    accent?: string;
    onAccent?: string;
    accentContainer?: string;
    onAccentContainer?: string;
    onBackground?: string;
    surface?: string;
    surfaceDim?: string;
    surfaceBright?: string;
    surfaceContainerLowest?: string;
    surfaceContainerLow?: string;
    surfaceContainer?: string;
    surfaceContainerHigh?: string;
    surfaceContainerHighest?: string;
    onSurface?: string;
    onSurfaceVariant?: string;
    outline?: string;
    outlineVariant?: string;
    inverseSurface?: string;
    inverseOnSurface?: string;
    onSuccess?: string;
    successContainer?: string;
    onSuccessContainer?: string;
    onWarning?: string;
    warningContainer?: string;
    onWarningContainer?: string;
    onError?: string;
    errorContainer?: string;
    onErrorContainer?: string;
    onInfo?: string;
    infoContainer?: string;
    onInfoContainer?: string;
    focusRing?: string;
    scrim?: string;
    disabledBackground?: string;
    disabledForeground?: string;
  }

  interface TypographyVariants {
    displayLarge: CSSProperties;
    displayMedium: CSSProperties;
    headlineLarge: CSSProperties;
    headlineMedium: CSSProperties;
    headlineSmall: CSSProperties;
    titleLarge: CSSProperties;
    titleMedium: CSSProperties;
    titleSmall: CSSProperties;
    bodyLarge: CSSProperties;
    bodyMedium: CSSProperties;
    bodySmall: CSSProperties;
    labelLarge: CSSProperties;
    labelMedium: CSSProperties;
    labelSmall: CSSProperties;
    numericMetric: CSSProperties;
    audioTime: CSSProperties;
    englishReading: CSSProperties;
    englishMetadata: CSSProperties;
  }

  interface TypographyVariantsOptions {
    displayLarge?: CSSProperties;
    displayMedium?: CSSProperties;
    headlineLarge?: CSSProperties;
    headlineMedium?: CSSProperties;
    headlineSmall?: CSSProperties;
    titleLarge?: CSSProperties;
    titleMedium?: CSSProperties;
    titleSmall?: CSSProperties;
    bodyLarge?: CSSProperties;
    bodyMedium?: CSSProperties;
    bodySmall?: CSSProperties;
    labelLarge?: CSSProperties;
    labelMedium?: CSSProperties;
    labelSmall?: CSSProperties;
    numericMetric?: CSSProperties;
    audioTime?: CSSProperties;
    englishReading?: CSSProperties;
    englishMetadata?: CSSProperties;
  }

  interface Theme {
    /** Active color-scheme elevation tokens (see tokens/elevation.ts). */
    elevation: ElevationTokens;
  }

  interface ThemeOptions {
    elevation?: Partial<ElevationTokens>;
  }

  interface ColorSystemOptions {
    /** Per-scheme elevation tokens emitted as CSS variables. */
    elevation?: Partial<ElevationTokens>;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    displayLarge: true;
    displayMedium: true;
    headlineLarge: true;
    headlineMedium: true;
    headlineSmall: true;
    titleLarge: true;
    titleMedium: true;
    titleSmall: true;
    bodyLarge: true;
    bodyMedium: true;
    bodySmall: true;
    labelLarge: true;
    labelMedium: true;
    labelSmall: true;
    numericMetric: true;
    audioTime: true;
    englishReading: true;
    englishMetadata: true;
  }
}
