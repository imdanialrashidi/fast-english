// landing/src/components/BrandMark.tsx
//
// The landing brand lockup uses the OFFICIAL Fast English assets
// (fast_english_logo_assets/) — never an improvised mark:
//   - light surfaces: the approved header wordmark PNG
//     (fastenglish_header_logo.png, rendered within its documented
//     maximum width and never scaled up);
//   - midnight surfaces: the approved monochrome mark as inline SVG
//     with `fill="currentColor"` (the black PNG artwork is illegible on
//     dark panels) plus the Persian wordmark text — the same
//     light/dark treatment the Student App uses.
//
// The inline path data below is byte-identical to the approved
// fast_english_logo_black.svg (verified by brand.test.ts); only the
// fill becomes currentColor, exactly like shared/ui/brand/Brand.tsx.
// The header wordmark PNG is served from the public dir (stable root
// URL so the prerendered HTML references the real file in every mode).

// Approved vector geometry (viewBox 0 0 1536 1024), kept byte-identical to
// fast_english_logo_black.svg. Only the fill changes to `currentColor`.
export const landingLogoPaths = {
  p0: 'M6890 8804 c-377 -48 -689 -203 -966 -479 -183 -182 -303 -369 -389\n-605 -29 -82 -285 -1127 -285 -1166 0 -33 40 -71 81 -79 19 -3 511 -5 1094 -3\nl1060 3 33 23 c45 33 54 55 97 235 27 113 44 166 60 185 l23 27 2849 5 c2595\n5 2854 7 2913 22 301 76 518 233 671 485 88 145 100 184 304 948 31 116 63\n234 71 263 21 71 12 117 -26 137 -26 13 -459 15 -3757 14 -3055 -1 -3747 -4\n-3833 -15z',
  p1: 'M2509 7291 c-53 -11 -100 -42 -131 -86 -22 -32 -43 -103 -100 -338\n-78 -324 -78 -331 -25 -371 l28 -21 1212 0 c1135 0 1214 1 1244 17 67 37 78\n64 153 382 38 164 70 312 70 330 0 46 -23 72 -75 85 -50 13 -2310 14 -2376 2z',
  p2: 'M3505 5956 c-121 -39 -211 -125 -248 -241 -30 -90 -157 -634 -157\n-668 0 -51 18 -93 48 -114 26 -17 76 -18 903 -21 856 -2 877 -3 894 -22 17\n-19 16 -28 -39 -251 -31 -127 -61 -240 -67 -250 -9 -18 -55 -19 -1545 -19\n-1711 0 -1569 6 -1637 -70 -32 -35 -39 -58 -110 -342 -44 -180 -73 -315 -70\n-331 3 -15 19 -38 35 -52 l30 -25 1528 0 c1467 0 1529 -1 1550 -18 32 -26 30\n-49 -31 -300 -40 -169 -57 -221 -75 -239 l-23 -23 -589 0 c-622 0 -621 0 -694\n-47 -66 -44 -83 -81 -143 -327 -50 -200 -56 -234 -46 -265 22 -74 -11 -71 733\n-71 631 0 666 -1 681 -18 10 -10 17 -30 17 -44 0 -13 -48 -247 -106 -519 -58\n-272 -108 -515 -111 -541 -5 -41 -2 -49 21 -73 45 -45 91 -33 243 64 270 173\n558 360 1138 737 303 196 398 245 545 280 70 17 196 18 1895 24 l1820 6 97 22\nc267 61 462 167 649 352 115 114 194 224 259 363 42 90 190 626 190 689 0 22\n-7 41 -19 52 -18 16 -138 18 -2019 19 -2226 2 -2039 -4 -2029 72 7 53 124 544\n137 573 5 12 24 31 42 42 33 20 53 20 2129 20 1831 0 2108 2 2185 15 429 74\n764 372 883 786 47 165 181 689 181 709 0 32 -11 50 -41 65 -24 13 -595 15\n-4511 14 -3592 0 -4491 -3 -4523 -13z',
} as const;

/** The monochrome mark (currentColor-aware). Never use outside this file. */
export function MonochromeMark({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1536 1024"
      role="img"
      aria-label="نشان فست انگلیش"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ width: size, height: size * (1024 / 1536), display: 'block' }}
    >
      <g
        fill="currentColor"
        stroke="none"
        // The approved SVG stores its paths in a 10× coordinate system;
        // preserve that geometry transform when rendering the inline mark.
        transform="translate(0 1024) scale(0.1 -0.1)"
      >
        <path d={landingLogoPaths.p0} />
        <path d={landingLogoPaths.p1} />
        <path d={landingLogoPaths.p2} />
      </g>
    </svg>
  );
}

/**
 * The landing brand lockup.
 *
 * `light` (default): the approved header wordmark PNG on a light surface.
 * `midnight`: monochrome currentColor mark + Persian wordmark text on a
 * midnight panel (the black PNG artwork is not legible on dark).
 * `compact`: small mark + wordmark text in text colors (light footers).
 */
export function BrandMark({
  tone = 'light',
  compact = false,
}: {
  tone?: 'light' | 'midnight' | 'compact';
  compact?: boolean;
}) {
  if (tone === 'light') {
    // The official wordmark artwork (black on transparent). Rendered at
    // its documented maximum width; never scaled up.
    return (
      <a
        href="/"
        className="inline-flex items-center no-underline"
        aria-label="فست انگلیش پادکست — صفحهٔ اصلی"
      >
        <img
          src="/fastenglish_header_logo.png"
          alt="فست انگلیش"
          width={697}
          height={197}
          loading="eager"
          className="h-9 w-auto sm:h-10"
          style={{ maxWidth: 220 }}
        />
      </a>
    );
  }

  const isCompact = tone === 'compact' || compact;
  const isMidnight = tone === 'midnight';
  const titleClass = isMidnight ? 'text-ice' : 'text-text';
  const subClass = isMidnight ? 'text-ice-muted' : 'text-muted';
  return (
    <a
      href="/"
      className="inline-flex items-center gap-3 no-underline"
      aria-label="فست انگلیش پادکست — صفحهٔ اصلی"
    >
      <MonochromeMark
        size={isCompact ? 32 : 40}
        className={isMidnight ? 'text-ice' : 'text-text'}
      />
      <span className="leading-tight">
        <span className={`block font-bold ${titleClass} ${isCompact ? 'text-base' : 'text-lg'}`}>
          فست انگلیش
        </span>
        <span className={`block font-medium ${subClass} ${isCompact ? 'text-xs' : 'text-sm'}`}>
          پادکست یادگیری انگلیسی
        </span>
      </span>
    </a>
  );
}
