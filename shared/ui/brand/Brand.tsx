// Fast English Podcast — typed, reusable Brand component.
//
// The supplied logo assets are integrated ONLY through this component:
//   - fast_english_logo_black.svg   → monochrome mark (path data below,
//     byte-identical to the approved file — verified by assets.test.ts).
//     `fill="currentColor"` so the mark is theme-aware and never renders
//     as an invisible black mark on a dark surface.
//   - fastenglish_header_logo.png   → full header wordmark (black artwork
//     on transparent; documented: only rendered on Light surfaces, where
//     the artwork is legible; Dark surfaces get the monochrome treatment).
//   - fast_english_app_favicon.png  → browser metadata favicon only
//     (app/public/favicon.png), not rendered by this component.
//
// The approved geometry is never altered: no stretching, cropping,
// rotation, shadows or decorative effects.

import { Box, Typography, useColorScheme } from '@mui/material';
import headerLogoUrl from '../../assets/brand/fastenglish_header_logo.png';
import { fontStacks } from '../tokens/typography';

// Approved vector geometry (viewBox 0 0 1536 1024), kept byte-identical to
// fast_english_logo_black.svg. Only the fill changes to `currentColor`.
export const logoPaths = {
  p0: 'M6890 8804 c-377 -48 -689 -203 -966 -479 -183 -182 -303 -369 -389\n-605 -29 -82 -285 -1127 -285 -1166 0 -33 40 -71 81 -79 19 -3 511 -5 1094 -3\nl1060 3 33 23 c45 33 54 55 97 235 27 113 44 166 60 185 l23 27 2849 5 c2595\n5 2854 7 2913 22 301 76 518 233 671 485 88 145 100 184 304 948 31 116 63\n234 71 263 21 71 12 117 -26 137 -26 13 -459 15 -3757 14 -3055 -1 -3747 -4\n-3833 -15z',
  p1: 'M2509 7291 c-53 -11 -100 -42 -131 -86 -22 -32 -43 -103 -100 -338\n-78 -324 -78 -331 -25 -371 l28 -21 1212 0 c1135 0 1214 1 1244 17 67 37 78\n64 153 382 38 164 70 312 70 330 0 46 -23 72 -75 85 -50 13 -2310 14 -2376 2z',
  p2: 'M3505 5956 c-121 -39 -211 -125 -248 -241 -30 -90 -157 -634 -157\n-668 0 -51 18 -93 48 -114 26 -17 76 -18 903 -21 856 -2 877 -3 894 -22 17\n-19 16 -28 -39 -251 -31 -127 -61 -240 -67 -250 -9 -18 -55 -19 -1545 -19\n-1711 0 -1569 6 -1637 -70 -32 -35 -39 -58 -110 -342 -44 -180 -73 -315 -70\n-331 3 -15 19 -38 35 -52 l30 -25 1528 0 c1467 0 1529 -1 1550 -18 32 -26 30\n-49 -31 -300 -40 -169 -57 -221 -75 -239 l-23 -23 -589 0 c-622 0 -621 0 -694\n-47 -66 -44 -83 -81 -143 -327 -50 -200 -56 -234 -46 -265 22 -74 -11 -71 733\n-71 631 0 666 -1 681 -18 10 -10 17 -30 17 -44 0 -13 -48 -247 -106 -519 -58\n-272 -108 -515 -111 -541 -5 -41 -2 -49 21 -73 45 -45 91 -33 243 64 270 173\n558 360 1138 737 303 196 398 245 545 280 70 17 196 18 1895 24 l1820 6 97 22\nc267 61 462 167 649 352 115 114 194 224 259 363 42 90 190 626 190 689 0 22\n-7 41 -19 52 -18 16 -138 18 -2019 19 -2226 2 -2039 -4 -2029 72 7 53 124 544\n137 573 5 12 24 31 42 42 33 20 53 20 2129 20 1831 0 2108 2 2185 15 429 74\n764 372 883 786 47 165 181 689 181 709 0 32 -11 50 -41 65 -24 13 -595 15\n-4511 14 -3592 0 -4491 -3 -4523 -13z',
} as const;

// Documented minimum rendered size of the mark (px) — the logo must never
// shrink below this in any variant.
export const MIN_BRAND_MARK_PX = 24;

// Documented maximum rendered width of the header PNG (px) — never scaled up.
export const MAX_HEADER_PNG_WIDTH_PX = 240;

export type BrandVariant = 'header' | 'full' | 'compact' | 'mark';

const wordmark = {
  title: 'فست انگلیش',
  subtitle: 'پادکست یادگیری انگلیسی',
};

/** The monochrome mark (currentColor-aware). Never use outside this file. */
function MonochromeMark({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 1536 1024"
      role="img"
      aria-label="نشان فست انگلیش"
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: size,
        height: size * (1024 / 1536),
        display: 'block',
      }}
      data-testid="brand-mark-svg"
    >
      <g fill="currentColor" stroke="none">
        <path d={logoPaths.p0} />
        <path d={logoPaths.p1} />
        <path d={logoPaths.p2} />
      </g>
    </svg>
  );
}

function WordmarkText({ size }: { size: 'sm' | 'md' }) {
  return (
    <Box sx={{ direction: 'rtl', textAlign: 'start' }} data-testid="brand-wordmark">
      <Typography
        component="span"
        variant={size === 'md' ? 'titleMedium' : 'titleSmall'}
        sx={{ display: 'block', fontWeight: 700, lineHeight: 1.2 }}
      >
        {wordmark.title}
      </Typography>
      <Typography
        component="span"
        variant="labelSmall"
        sx={{ display: 'block', color: 'onSurfaceVariant', fontWeight: 500 }}
      >
        {wordmark.subtitle}
      </Typography>
    </Box>
  );
}

/**
 * Typed brand component with theme-aware display.
 *
 * - `mark`: the monochrome vector mark alone (any surface, any mode).
 * - `compact`: small mark + Persian wordmark (any surface, any mode).
 * - `full`: larger mark + Persian wordmark (any surface, any mode).
 * - `header`: the approved header PNG wordmark — Light surfaces only.
 *   On Dark surfaces the black PNG artwork is illegible, so the variant
 *   falls back to the monochrome mark + wordmark (documented treatment).
 */
export function Brand({
  variant = 'full',
  size = 'md',
  maxWidth = 240,
  'data-testid': testId,
}: {
  variant?: BrandVariant;
  /** `sm` for compact chrome, `md` for hero/entry surfaces. */
  size?: 'sm' | 'md';
  /** Upper bound for the rendered width (px). */
  maxWidth?: number;
  'data-testid'?: string;
}) {
  const { colorScheme } = useColorScheme();
  const markSize = variant === 'mark' ? 48 : size === 'md' ? 40 : 32;
  const isDark = colorScheme === 'dark';

  if (variant === 'header' && !isDark) {
    return (
      <Box
        data-testid={testId ?? 'brand-header'}
        sx={{
          direction: 'ltr',
          display: 'inline-flex',
          alignItems: 'center',
          maxWidth,
          img: { display: 'block', height: 'auto', maxWidth: '100%' },
        }}
      >
        <img src={headerLogoUrl} alt="فست انگلیش" width={697} height={197} loading="eager" />
      </Box>
    );
  }

  if (variant === 'mark') {
    return (
      <Box data-testid={testId ?? 'brand-mark'} sx={{ display: 'inline-flex' }}>
        <MonochromeMark size={markSize} />
      </Box>
    );
  }

  return (
    <Box
      data-testid={testId ?? `brand-${variant}`}
      sx={{
        direction: 'rtl',
        display: 'inline-flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1.5,
        minWidth: 0,
        maxWidth,
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <MonochromeMark size={markSize} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <WordmarkText size={variant === 'compact' ? 'sm' : size} />
      </Box>
    </Box>
  );
}

// The wordmark text stack is exposed for tests and the catalog; the Latin
// letters of the artwork stay inside the SVG/PNG.
export const brandTypography = { fontStack: fontStacks.fa };
