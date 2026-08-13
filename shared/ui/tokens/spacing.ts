// Spacing and layout tokens.
//
// The spacing scale is 4px-based (MUI's 8dp lineage, halved for finer
// control). Every spacing value in the app must come from this scale or
// from the MUI theme `spacing` function. Layout tokens below carry the
// semantic meaning (page gutters, chrome heights, safe areas, widths).

export const spacingScale = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

// Reference values for token tests and documentation. MUI's spacing prop is
// backed by `muiSpacing` below because Student components intentionally pass
// both scale factors (`2` = 8px) and semantic pixel tokens (`16` = 16px).
export const spacingSteps = [2, 4, 8, 12, 16, 24, 32, 48, 64] as const;

/**
 * A tolerant 4px spacing function for MUI's sx system.
 *
 * Most MUI spacing values are scale factors, while the shared layout roles
 * are already expressed in pixels. Supporting both at the theme boundary
 * keeps components readable and, importantly, prevents MUI v9 from silently
 * dropping larger semantic values or emitting console errors for fractional
 * factors such as 1.5.
 */
export function muiSpacing(factor: number): string {
  if (factor === 0) return '0px';
  const absolute = Math.abs(factor);
  return `${absolute <= 8 ? factor * 4 : factor}px`;
}

export const layout = {
  // Responsive page frame. The top role is deliberately larger than the
  // inline gutter: content should begin as a composed page, not under chrome.
  pageInlinePadding: { xs: spacingScale.lg, sm: spacingScale.xl, md: spacingScale.xxl },
  pageTopPadding: { xs: spacingScale.xxl, sm: spacingScale.xxxl, md: spacingScale.huge },
  pageBottomPadding: { xs: spacingScale.xxl, sm: spacingScale.xxxl, md: spacingScale.xxxl },
  // Kept as a named compatibility role for non-shell surfaces and tests.
  pageBlockPadding: { xs: spacingScale.lg, sm: spacingScale.xl, md: spacingScale.xl },
  // Vertical rhythm between page sections.
  sectionGap: { xs: spacingScale.xxl, sm: spacingScale.xxxl },
  // Card paddings.
  cardPaddingCompact: spacingScale.lg,
  cardPaddingComfortable: spacingScale.xl,
  // Form/control spacing.
  controlGap: spacingScale.sm,
  formGap: spacingScale.lg,
  // Chrome heights.
  headerHeight: { xs: 56, md: 64 },
  bottomNavigationHeight: 64,
  // Tablet rail (md–lg) is icon-only; desktop (lg+) uses the full side nav.
  navigationRailWidth: 88,
  desktopNavigationWidth: 248,
  // Content width ceilings.
  contentMaxWidth: 1200,
  readingMaxWidth: '40rem',
  dialogMaxWidth: 600,
  // Mobile safe areas (consumed via env() by the shell chrome).
  safeAreaTop: 'env(safe-area-inset-top, 0px)',
  safeAreaBottom: 'env(safe-area-inset-bottom, 0px)',
} as const;

export const breakpoints = {
  xs: 360,
  sm: 600,
  md: 768,
  lg: 1024,
  xl: 1440,
} as const;

// Z-index scale. Values must come from here, not ad-hoc numbers.
export const zIndex = {
  base: 0,
  stickyHeader: 1100,
  bottomNavigation: 1100,
  drawer: 1200,
  dialog: 1300,
  snackbar: 1400,
  tooltip: 1500,
  skipLink: 1600,
} as const;
