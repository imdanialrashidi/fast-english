// Typography tokens for the product app.
//
// Rules:
// - All sizes are `rem` (root font size is never changed).
// - Persian body text keeps a comfortable line height (>= 1.6).
// - English reading content is explicitly LTR with a bounded measure.
// - Timers and numeric metrics use stable (tabular) numeral widths.
// - Button labels are never uppercased (see theme MuiButton overrides).

export const fontStacks = {
  // Persian-first stack; Vazirmatn is self-hosted (see styles.css).
  fa: '"Vazirmatn", "IRANSansX", "Tahoma", "Segoe UI", system-ui, -apple-system, sans-serif',
  // Latin stack for English lesson content (system fonts only).
  en: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  // Numeric/timer tokens keep the Persian stack (Vazirmatn has Latin digits)
  // with tabular numerals so time values do not jitter.
  numeric: '"Vazirmatn", "Tahoma", "Segoe UI", system-ui, sans-serif',
} as const;

export const typeScale = {
  displayLarge: { fontSize: '2.5rem', lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.02em' },
  displayMedium: {
    fontSize: '2.125rem',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: '-0.015em',
  },
  headlineLarge: { fontSize: '1.75rem', lineHeight: 1.3, fontWeight: 700 },
  headlineMedium: { fontSize: '1.5rem', lineHeight: 1.35, fontWeight: 700 },
  headlineSmall: { fontSize: '1.25rem', lineHeight: 1.4, fontWeight: 700 },
  titleLarge: { fontSize: '1.125rem', lineHeight: 1.45, fontWeight: 600 },
  titleMedium: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 600 },
  titleSmall: { fontSize: '0.875rem', lineHeight: 1.5, fontWeight: 600 },
  bodyLarge: { fontSize: '1.0625rem', lineHeight: 1.7, fontWeight: 400 },
  bodyMedium: { fontSize: '1rem', lineHeight: 1.7, fontWeight: 400 },
  bodySmall: { fontSize: '0.875rem', lineHeight: 1.7, fontWeight: 400 },
  labelLarge: { fontSize: '0.9375rem', lineHeight: 1.5, fontWeight: 600 },
  labelMedium: { fontSize: '0.8125rem', lineHeight: 1.5, fontWeight: 600 },
  labelSmall: { fontSize: '0.75rem', lineHeight: 1.5, fontWeight: 600 },
  // Stable-width numerals for metrics (progress counts, stats).
  numericMetric: {
    fontSize: '1.125rem',
    lineHeight: 1.4,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  // Audio timers ("12:34"): LTR-isolated so the colon order is stable in RTL.
  // NOTE: `direction` is deliberately NOT set here — the RTL Stylis pipeline
  // (stylis-plugin-rtl → cssjanus) flips a CSS `direction: ltr` declaration
  // to `rtl`, overriding the intended `dir="ltr"` attributes and breaking
  // LTR alignment (Slice 7 design review finding 1). LTR isolation is
  // provided by `dir="ltr"` attributes on the consuming elements and by
  // `unicodeBidi: isolate` below.
  audioTime: {
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    unicodeBidi: 'isolate',
  },
  // English reading body: Latin stack, LTR, bounded measure handled by the
  // consuming container (layout.readingMaxWidth). Same direction note as
  // audioTime: `dir="ltr"` attributes own the direction; CSS does not.
  englishReading: {
    fontSize: '1.125rem',
    lineHeight: 1.8,
    fontWeight: 400,
    unicodeBidi: 'isolate',
    maxWidth: '40rem',
  },
  // English metadata (lesson captions, level labels): small, LTR-isolated.
  englishMetadata: {
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    fontWeight: 500,
    unicodeBidi: 'isolate',
  },
} as const;

export type TypographyRole = keyof typeof typeScale;

// MUI Typography variant names map onto the scale above.
// `typography` in the theme maps: displayLarge..labelSmall to the new
// variants; numericMetric/audioTime/englishReading/englishMetadata are
// additionally exported here for components that need raw style values.
export const typographyRoles = Object.keys(typeScale) as readonly TypographyRole[];
