// Brand and design tokens. Imported by the product app theme.
// These values are also reflected in the static landing via Tailwind utilities,
// but no code is shared between the two surfaces to keep the build isolated.

export const brand = {
  midnight: '#0B1220',
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  secondary: '#7C3AED',
  backgroundDefault: '#F6F8FC',
  backgroundPaper: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  divider: '#E2E8F0',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
} as const;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;
export const radius = { sm: 10, md: 14, lg: 18, xl: 24 } as const;

// CEFR levels with accessible foreground/background pairs.
// Foreground colors are chosen to meet WCAG AA contrast against their background.
export const cefr = {
  A1: { bg: '#E0F2FE', fg: '#075985', label: 'A1' },
  A2: { bg: '#DCFCE7', fg: '#166534', label: 'A2' },
  B1: { bg: '#FEF3C7', fg: '#92400E', label: 'B1' },
  B2: { bg: '#FFEDD5', fg: '#9A3412', label: 'B2' },
  C1: { bg: '#EDE9FE', fg: '#5B21B6', label: 'C1' },
  C2: { bg: '#FCE7F3', fg: '#9D174D', label: 'C2' },
} as const;

export type CefrLevel = keyof typeof cefr;
export const cefrLevels: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
