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

export type ColorScheme = 'light' | 'dark';

/**
 * Edition-stripe color for a CEFR level on the Deck surface
 * (`surfaceContainerHigh`). Scheme-aware: the pair's dark foreground in
 * Light (clears ≥3:1 on the light Deck surface) and the pair's pale
 * background in Dark (clears ≥3:1 on the dark Deck surface). Uses only the
 * existing CEFR pair colors — no arbitrary tones. The contract requires
 * the stripe to clear 3:1 against the Deck surface in both schemes;
 * `shared/ui/palette.contrast.test.ts` enforces it durably.
 */
export function deckStripeColor(level: CefrLevel, scheme: ColorScheme): string {
  return scheme === 'light' ? cefr[level].fg : cefr[level].bg;
}
