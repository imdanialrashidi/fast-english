// CEFR level palette with accessible foreground/background pairs.
// Foreground colors are chosen to meet WCAG AA against their background.

export const cefr = {
  A1: { bg: '#e0f2fe', fg: '#075985', label: 'A1' },
  A2: { bg: '#dcfce7', fg: '#166534', label: 'A2' },
  B1: { bg: '#fef3c7', fg: '#92400e', label: 'B1' },
  B2: { bg: '#ffedd5', fg: '#9a3412', label: 'B2' },
  C1: { bg: '#ede9fe', fg: '#5b21b6', label: 'C1' },
  C2: { bg: '#fce7f3', fg: '#9d174d', label: 'C2' },
} as const;

export type CefrLevel = keyof typeof cefr;
export const cefrLevels: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
