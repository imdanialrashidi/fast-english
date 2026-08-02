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

// MUI spacing multiplier array (px). Keep in sync with spacingScale.
export const spacingSteps = [2, 4, 8, 12, 16, 24, 32, 48, 64] as const;

export const layout = {
  // Page gutters (inline) and block padding.
  pageInlinePadding: { xs: spacingScale.lg, sm: spacingScale.xl, md: spacingScale.xl },
  pageBlockPadding: { xs: spacingScale.lg, sm: spacingScale.xl, md: spacingScale.xl },
  // Vertical rhythm between page sections.
  sectionGap: { xs: spacingScale.xl, sm: spacingScale.xxl },
  // Card paddings.
  cardPaddingCompact: spacingScale.lg,
  cardPaddingComfortable: spacingScale.xl,
  // Form/control spacing.
  controlGap: spacingScale.sm,
  formGap: spacingScale.lg,
  // Chrome heights.
  headerHeight: { xs: 56, md: 64 },
  bottomNavigationHeight: 64,
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
