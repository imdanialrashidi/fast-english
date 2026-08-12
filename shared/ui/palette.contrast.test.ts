// Machine-readable WCAG contrast gate for the semantic color system.
//
// Every foreground/background role pair actually used by the app is listed
// below with its target ratio. The test fails when a required pair does not
// meet its target in either scheme. The same list (and calculator) powers
// the live contrast section of the component catalog.

import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { cefrLevels, deckStripeColor } from './tokens/cefr';
import { semanticColors } from './tokens/colors';

type Role = keyof typeof semanticColors.light;

interface ContrastPair {
  fg: Role;
  bg: Role;
  /** WCAG AA for normal text; 3:1 for non-text UI components (outline, focus). */
  target: 4.5 | 3 | 1.5;
  /** Where the pair is used. */
  use: string;
}

// The authoritative list of required pairs. Add a row here whenever a new
// foreground/background combination is introduced in the UI.
const REQUIRED_PAIRS: ContrastPair[] = [
  // Primary CTA
  { fg: 'onPrimary', bg: 'primary', target: 4.5, use: 'متن دکمهٔ اصلی روی پرایمری' },
  { fg: 'onPrimary', bg: 'primaryHover', target: 4.5, use: 'متن دکمه روی حالت hover' },
  { fg: 'onPrimary', bg: 'primaryPressed', target: 4.5, use: 'متن دکمه روی حالت فشرده' },
  { fg: 'primary', bg: 'surface', target: 4.5, use: 'پرایمری به‌عنوان متن روی سطح' },
  { fg: 'primary', bg: 'background', target: 4.5, use: 'پرایمری به‌عنوان متن روی پس‌زمینه' },
  { fg: 'primary', bg: 'surfaceContainerLowest', target: 4.5, use: 'پرایمری روی کارت سفید' },
  { fg: 'onPrimaryContainer', bg: 'primaryContainer', target: 4.5, use: 'متن روی کانتینر پرایمری' },

  // Secondary
  { fg: 'onSecondary', bg: 'secondary', target: 4.5, use: 'متن روی سکندری' },
  { fg: 'secondary', bg: 'surface', target: 4.5, use: 'سکندری به‌عنوان متن' },
  {
    fg: 'onSecondaryContainer',
    bg: 'secondaryContainer',
    target: 4.5,
    use: 'متن روی کانتینر سکندری',
  },

  // Accent
  { fg: 'onAccent', bg: 'accent', target: 4.5, use: 'متن روی آکسانت' },
  { fg: 'accent', bg: 'surface', target: 4.5, use: 'آکسانت به‌عنوان متن' },
  { fg: 'onAccentContainer', bg: 'accentContainer', target: 4.5, use: 'متن روی کانتینر آکسانت' },

  // Background / surface text
  { fg: 'onBackground', bg: 'background', target: 4.5, use: 'متن بدنه روی پس‌زمینه' },
  { fg: 'onSurface', bg: 'background', target: 4.5, use: 'متن بدنه' },
  { fg: 'onSurface', bg: 'surface', target: 4.5, use: 'متن روی سطح' },
  { fg: 'onSurface', bg: 'surfaceContainerLowest', target: 4.5, use: 'متن روی پایین‌ترین کانتینر' },
  { fg: 'onSurface', bg: 'surfaceContainer', target: 4.5, use: 'متن روی کانتینر' },
  { fg: 'onSurface', bg: 'surfaceContainerHigh', target: 4.5, use: 'متن روی کانتینر بلند' },
  { fg: 'onSurface', bg: 'surfaceContainerHighest', target: 4.5, use: 'متن روی بلندترین کانتینر' },
  { fg: 'onSurface', bg: 'surfaceContainerLow', target: 4.5, use: 'متن روی نوار برنامه/ناوبری' },
  { fg: 'onSurfaceVariant', bg: 'surface', target: 4.5, use: 'متن فرعی روی سطح' },
  { fg: 'onSurfaceVariant', bg: 'surfaceContainer', target: 4.5, use: 'متن فرعی روی کانتینر' },
  {
    fg: 'onSurfaceVariant',
    bg: 'surfaceContainerHigh',
    target: 4.5,
    use: 'متن فرعی روی کانتینر بلند',
  },
  { fg: 'onSurfaceVariant', bg: 'background', target: 4.5, use: 'متن فرعی روی پس‌زمینه' },
  {
    fg: 'onSurfaceVariant',
    bg: 'surfaceContainerLow',
    target: 4.5,
    use: 'متن فرعی روی نوار برنامه',
  },

  // Outline (non-text UI components)
  { fg: 'outline', bg: 'surface', target: 3, use: 'خطوط مرزی و آیکن‌های مهم' },
  { fg: 'outline', bg: 'background', target: 3, use: 'خطوط مرزی روی پس‌زمینه' },

  // Inverse (Snackbar, Tooltip, AppBar inverse)
  { fg: 'inverseOnSurface', bg: 'inverseSurface', target: 4.5, use: 'متن روی سطح معکوس' },

  // Status colors
  { fg: 'onSuccess', bg: 'success', target: 4.5, use: 'متن روی موفقیت' },
  { fg: 'onSuccessContainer', bg: 'successContainer', target: 4.5, use: 'متن روی کانتینر موفقیت' },
  { fg: 'onWarning', bg: 'warning', target: 4.5, use: 'متن روی هشدار' },
  { fg: 'onWarningContainer', bg: 'warningContainer', target: 4.5, use: 'متن روی کانتینر هشدار' },
  { fg: 'onError', bg: 'error', target: 4.5, use: 'متن روی خطا' },
  { fg: 'onErrorContainer', bg: 'errorContainer', target: 4.5, use: 'متن روی کانتینر خطا' },
  { fg: 'onInfo', bg: 'info', target: 4.5, use: 'متن روی اطلاع' },
  { fg: 'onInfoContainer', bg: 'infoContainer', target: 4.5, use: 'متن روی کانتینر اطلاع' },

  // Focus indicators
  { fg: 'focusRing', bg: 'surface', target: 3, use: 'حلقهٔ تمرکز روی سطح' },
  { fg: 'focusRing', bg: 'background', target: 3, use: 'حلقهٔ تمرکز روی پس‌زمینه' },

  // Disabled states (recognizable; WCAG-exempt, kept at >= 1.5)
  { fg: 'disabledForeground', bg: 'disabledBackground', target: 1.5, use: 'متن غیرفعال' },
];

describe('semantic color contrast (WCAG)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    describe(scheme, () => {
      const palette = semanticColors[scheme];

      it('defines every role used by the required pairs', () => {
        for (const pair of REQUIRED_PAIRS) {
          expect(palette[pair.fg], `missing fg role ${pair.fg}`).toBeTypeOf('string');
          expect(palette[pair.bg], `missing bg role ${pair.bg}`).toBeTypeOf('string');
        }
      });

      it.each(REQUIRED_PAIRS.map((p) => [p, palette] as const))('$use ($fg on $bg)', (pair) => {
        const ratio = contrastRatio(palette[pair.fg], palette[pair.bg]);
        expect(
          ratio,
          `${scheme}: ${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)}:1 — نیاز ${pair.target}:1 (${pair.use})`,
        ).toBeGreaterThanOrEqual(pair.target);
      });
    });
  }

  it('covers at least 40 required pairs per scheme', () => {
    expect(REQUIRED_PAIRS.length).toBeGreaterThanOrEqual(40);
  });
});

describe('edition stripe (Slice 7 contract)', () => {
  // DESIGN.md QA budget: "the edition stripe is non-text, checked ≥3:1
  // against the Deck surface". The Deck surface is `surfaceContainerHigh`;
  // every CEFR level stripe must clear 3:1 in BOTH schemes (the Stripe is
  // theme-aware: pair fg in Light, pair bg in Dark). This is the durable
  // regression proof for the accepted contract — a stripe color that falls
  // below 3:1 (e.g. the pale pair bg on the light Deck surface, ~1.1:1)
  // fails here.
  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: every CEFR level stripe clears 3:1 on the Deck surface`, () => {
      const deck = semanticColors[scheme].surfaceContainerHigh;
      for (const level of cefrLevels) {
        const stripe = deckStripeColor(level, scheme);
        const ratio = contrastRatio(stripe, deck);
        expect(
          ratio,
          `${scheme}/${level}: stripe ${stripe} on Deck surface ${deck} = ${ratio.toFixed(2)}:1 — نیاز ≥3:1`,
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
