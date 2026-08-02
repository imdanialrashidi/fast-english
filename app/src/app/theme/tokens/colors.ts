// Semantic color system for Fast English Podcast.
//
// The supplied brand palette is a set of SOURCE colors, not a usable UI
// palette. This module derives a complete Material-3-inspired semantic
// system from it with separately tuned Light and Dark values. Every
// foreground/background role pair used by the app is verified by
// `palette.contrast.test.ts` (WCAG AA) against the exact values below.
//
// Rules applied here:
// - Normal text pairs must reach WCAG AA (>= 4.5:1).
// - Primary CTA text must reach AA against primary/hover/pressed fills.
// - The supplied `#4f95b5` is NOT used as a text-bearing fill in Light mode
//   (white on it is only ~3.4:1); the brand identity is preserved through
//   containers, accents and the Dark-mode primary.
// - Outline roles are checked at >= 3:1 (non-text UI components).
// - Focus rings are checked at >= 3:1 against the surfaces they sit on.
// - Disabled pairs are checked at >= 1.5:1 (recognizable, WCAG-exempt).

export const sourceBrand = {
  light: {
    text: '#0e171b',
    background: '#f5f9fa',
    primary: '#4f95b5',
    secondary: '#a3c9dc',
    accent: '#6eaecf',
  },
  dark: {
    text: '#e4edf1',
    background: '#05090a',
    primary: '#4a90b0',
    secondary: '#23495c',
    accent: '#307191',
  },
} as const;

export const semanticLight = {
  primary: '#2a6f8c',
  onPrimary: '#ffffff',
  primaryHover: '#25607b',
  primaryPressed: '#1f526a',
  primaryContainer: '#d3e9f2',
  onPrimaryContainer: '#0c3242',

  secondary: '#4d7084',
  onSecondary: '#ffffff',
  secondaryContainer: '#a3c9dc',
  onSecondaryContainer: '#123a4d',

  accent: '#2e7092',
  onAccent: '#ffffff',
  accentContainer: '#cde8f5',
  onAccentContainer: '#0c3a52',

  background: '#f5f9fa',
  onBackground: '#0e171b',

  surface: '#edf4f7',
  surfaceDim: '#d3dee4',
  surfaceBright: '#f7fbfc',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#e9f1f4',
  surfaceContainer: '#e3edf1',
  surfaceContainerHigh: '#dde8ed',
  surfaceContainerHighest: '#d7e2e8',
  onSurface: '#0e171b',
  onSurfaceVariant: '#414e55',

  outline: '#6e7a81',
  outlineVariant: '#b8c6cc',

  inverseSurface: '#2d3a40',
  inverseOnSurface: '#edf4f7',

  success: '#1b7a56',
  onSuccess: '#ffffff',
  successContainer: '#c5ecd9',
  onSuccessContainer: '#0b3f2a',

  warning: '#8a5a1e',
  onWarning: '#ffffff',
  warningContainer: '#f5e2c0',
  onWarningContainer: '#54390c',

  error: '#b3261e',
  onError: '#ffffff',
  errorContainer: '#f9dedc',
  onErrorContainer: '#410e0b',

  info: '#2e6b93',
  onInfo: '#ffffff',
  infoContainer: '#d2e8f5',
  onInfoContainer: '#10354c',

  focusRing: '#0a7aa8',
  scrim: 'rgba(14, 23, 27, 0.55)',
  disabledBackground: '#e2eaee',
  disabledForeground: '#8d9aa1',
} as const;

export const semanticDark = {
  primary: '#4a90b0',
  onPrimary: '#04141c',
  // Dark mode pressed/hover states move LIGHTER (M3 tone-90 direction) so
  // the dark `onPrimary` text keeps AA on every fill state.
  primaryHover: '#5da0c0',
  primaryPressed: '#69aecd',
  primaryContainer: '#1b3a4a',
  onPrimaryContainer: '#c9e6f2',

  secondary: '#a9cde0',
  onSecondary: '#0b2a3a',
  secondaryContainer: '#23495c',
  onSecondaryContainer: '#c9e2ef',

  accent: '#5fb3dd',
  onAccent: '#04141c',
  accentContainer: '#307191',
  onAccentContainer: '#eaf6fc',

  background: '#05090a',
  onBackground: '#e4edf1',

  surface: '#0c1316',
  surfaceDim: '#05090a',
  surfaceBright: '#26343a',
  surfaceContainerLowest: '#070b0d',
  surfaceContainerLow: '#111a1e',
  surfaceContainer: '#151e23',
  surfaceContainerHigh: '#1a252a',
  surfaceContainerHighest: '#202c31',
  onSurface: '#e4edf1',
  onSurfaceVariant: '#b3c1c8',

  outline: '#8b9aa2',
  outlineVariant: '#37454c',

  inverseSurface: '#dfe8ec',
  inverseOnSurface: '#2d3a40',

  success: '#5db891',
  onSuccess: '#04140c',
  successContainer: '#1d4632',
  onSuccessContainer: '#b8e6cd',

  warning: '#d9a05a',
  onWarning: '#1f1403',
  warningContainer: '#54390c',
  onWarningContainer: '#f5e2c0',

  error: '#f2b8b5',
  onError: '#601410',
  errorContainer: '#601410',
  onErrorContainer: '#f9dedc',

  info: '#9cc9e4',
  onInfo: '#0c2e42',
  infoContainer: '#10354c',
  onInfoContainer: '#d2e8f5',

  focusRing: '#7fc4e6',
  scrim: 'rgba(0, 0, 0, 0.65)',
  disabledBackground: '#0f181c',
  disabledForeground: '#5c6b73',
} as const;

export type SemanticColorRole = keyof typeof semanticLight;

export const semanticColors = {
  light: semanticLight,
  dark: semanticDark,
} as const;

export type SemanticColorScheme = keyof typeof semanticColors;
