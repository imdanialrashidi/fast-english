// Token architecture invariants.
//
// The design system is only as good as its enforcement: these tests pin the
// structure of the token modules so the approved spacing increments, layout
// roles, breakpoints and typography rules cannot drift.

import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../contrast';
import { semanticColors, sourceBrand } from './colors';
import { elevation } from './elevation';
import { duration, easing } from './motion';
import { radius } from './shape';
import { breakpoints, layout, spacingScale, spacingSteps, zIndex } from './spacing';
import { fontStacks, typeScale } from './typography';

describe('design tokens', () => {
  it('uses the approved 4px-based spacing scale', () => {
    const values = Object.values(spacingScale);
    expect(values).toEqual([2, 4, 8, 12, 16, 24, 32, 48, 64]);
    // All values are multiples of 2 (4px base lineage).
    for (const v of values) {
      expect(v % 2).toBe(0);
    }
  });

  it('keeps the MUI spacing multiplier in sync with the scale', () => {
    expect([...spacingSteps]).toEqual([2, 4, 8, 12, 16, 24, 32, 48, 64]);
  });

  it('defines the documented layout roles', () => {
    expect(layout.pageInlinePadding).toBeTypeOf('object');
    expect(layout.pageBlockPadding).toBeTypeOf('object');
    expect(layout.sectionGap).toBeTypeOf('object');
    expect(layout.cardPaddingCompact).toBe(16);
    expect(layout.cardPaddingComfortable).toBe(24);
    expect(layout.headerHeight).toEqual({ xs: 56, md: 64 });
    expect(layout.bottomNavigationHeight).toBe(64);
    expect(layout.desktopNavigationWidth).toBe(248);
    expect(layout.contentMaxWidth).toBeGreaterThanOrEqual(1100);
    expect(layout.dialogMaxWidth).toBe(600);
    expect(layout.safeAreaTop).toContain('env(');
    expect(layout.safeAreaBottom).toContain('env(');
  });

  it('covers every required supported width via breakpoints', () => {
    for (const width of [360, 390, 430, 768, 1024, 1440]) {
      // Each width falls inside the documented breakpoint ladder.
      expect(width).toBeGreaterThanOrEqual(breakpoints.xs);
      expect(width).toBeLessThanOrEqual(breakpoints.xl);
    }
  });

  it('defines exactly the approved shape roles', () => {
    expect(radius).toEqual({
      radiusControl: 10,
      radiusInput: 12,
      radiusCard: 16,
      radiusDialog: 20,
      radiusHero: 24,
      radiusPill: 999,
    });
  });

  it('defines the approved elevation roles for both schemes', () => {
    const roles = Object.keys(elevation.light);
    expect(roles).toEqual(['page', 'surface', 'interactive', 'sticky', 'dialog']);
    expect(Object.keys(elevation.dark)).toEqual(roles);
    for (const role of roles as Array<keyof typeof elevation.light>) {
      // `page` is a documented no-elevation role; the rest carry shadows.
      if (role === 'page') {
        expect(elevation.light[role]).toBe('none');
        continue;
      }
      expect(elevation.light[role]).toContain('rgba');
      expect(elevation.dark[role]).toContain('rgba');
    }
  });

  it('defines approved motion durations and easings', () => {
    expect(Object.values(duration)).toEqual([80, 150, 240, 420]);
    expect(Object.keys(easing).sort()).toEqual([
      'easingAccelerate',
      'easingDecelerate',
      'easingEmphasized',
      'easingStandard',
    ]);
  });

  it('keeps the typography hierarchy rem-based with comfortable Persian line heights', () => {
    for (const style of Object.values(typeScale)) {
      expect(style.fontSize).toMatch(/rem$/);
      const lh = Number(style.lineHeight);
      expect(lh).toBeGreaterThanOrEqual(1.2);
    }
    // Persian body line heights are comfortable.
    expect(typeScale.bodyMedium.lineHeight).toBeGreaterThanOrEqual(1.6);
  });

  it('keeps audio/numeric tokens on stable numeral widths', () => {
    expect(typeScale.audioTime.fontVariantNumeric).toBe('tabular-nums');
    expect(typeScale.numericMetric.fontVariantNumeric).toBe('tabular-nums');
    // Audio time is LTR-isolated so "12:34" keeps its order in RTL.
    // The isolation is provided by `unicodeBidi` + `dir="ltr"` attributes
    // on the consuming elements, NOT by a CSS `direction` declaration: the
    // RTL Stylis pipeline (cssjanus) flips `direction: ltr` to `rtl` and
    // would override the attributes (Slice 7 review finding 1). If a
    // future change re-adds direction here, the rendered LTR surface
    // regresses to right-aligned English — the assertion below is the
    // token-level regression proof.
    expect('direction' in typeScale.audioTime).toBe(false);
    expect('direction' in typeScale.englishReading).toBe(false);
    expect('direction' in typeScale.englishMetadata).toBe(false);
    expect(typeScale.audioTime.unicodeBidi).toBe('isolate');
    expect(typeScale.englishReading.unicodeBidi).toBe('isolate');
  });

  it('uses only the self-hosted font stacks (no remote families)', () => {
    expect(fontStacks.fa).toContain('Vazirmatn');
    expect(fontStacks.fa).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(fontStacks.en).not.toMatch(/https?:/);
  });

  it('defines the documented z-index scale', () => {
    expect(zIndex.stickyHeader).toBe(1100);
    expect(zIndex.bottomNavigation).toBe(1100);
    expect(zIndex.dialog).toBe(1300);
    expect(zIndex.snackbar).toBe(1400);
  });

  it('keeps the source palette identical to the supplied brand colors', () => {
    expect(sourceBrand.light).toEqual({
      text: '#0e171b',
      background: '#f5f9fa',
      primary: '#4f95b5',
      secondary: '#a3c9dc',
      accent: '#6eaecf',
    });
    expect(sourceBrand.dark).toEqual({
      text: '#e4edf1',
      background: '#05090a',
      primary: '#4a90b0',
      secondary: '#23495c',
      accent: '#307191',
    });
  });

  it('keeps both schemes complete with identical role sets', () => {
    const lightRoles = Object.keys(semanticColors.light);
    expect(Object.keys(semanticColors.dark)).toEqual(lightRoles);
    expect(lightRoles.length).toBeGreaterThanOrEqual(45);
  });

  it('keeps Light primary accessible as text (not the raw brand #4f95b5)', () => {
    const light = semanticColors.light;
    expect(contrastRatio(light.onPrimary, light.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(light.primary, light.surface)).toBeGreaterThanOrEqual(4.5);
    expect(light.primary.toLowerCase()).not.toBe('#4f95b5');
  });
});
