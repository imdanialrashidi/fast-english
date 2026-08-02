// Elevation tokens.
//
// Limited set of elevation roles. Light mode prefers subtle boundaries
// (outline + low shadow); dark mode relies on tonal surface differences
// with restrained borders and near-invisible shadows. Values are consumed
// per color scheme through the theme (see theme.ts `colorSchemes.*.elevation`)
// so `theme.elevation.sticky` and the generated `--mui-elevation-*` CSS
// variables always match the active mode.

export const elevationLight = {
  page: 'none',
  surface: '0px 1px 2px rgba(14, 23, 27, 0.06)',
  interactive: '0px 2px 6px rgba(14, 23, 27, 0.10)',
  sticky: '0px 4px 12px rgba(14, 23, 27, 0.12)',
  dialog: '0px 12px 32px rgba(14, 23, 27, 0.20)',
} as const;

// Dark surfaces are tonally separated; shadows stay subtle so surfaces do
// not float on pure black.
export const elevationDark = {
  page: 'none',
  surface: '0px 1px 2px rgba(0, 0, 0, 0.30)',
  interactive: '0px 2px 6px rgba(0, 0, 0, 0.40)',
  sticky: '0px 4px 12px rgba(0, 0, 0, 0.45)',
  dialog: '0px 12px 32px rgba(0, 0, 0, 0.55)',
} as const;

export type ElevationRole = keyof typeof elevationLight;

export const elevation = {
  light: elevationLight,
  dark: elevationDark,
} as const;
