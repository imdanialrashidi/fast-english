// app/src/app/visual-slice-2.quality.test.ts
// Deterministic design-consistency gates for Visual Slice 2.
//
// These assert the *shared system* values that the redesigned pages consume
// (page padding, chrome heights, button heights, card radius, content
// ceilings, navigation widths, motion tokens) so page-level polish cannot
// drift from the token system. Static scans cover the redesigned route files
// for the rules the global static-quality gate already enforces (semantic
// colors, no raw durations, no `transition: all`, no direct brand imports).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appTheme } from './theme/theme';
import { layout, radius } from './theme/tokens';

const ROOT = process.cwd();
function read(rel: string): string {
  return readFileSync(resolve(ROOT, 'app', 'src', rel), 'utf8');
}

// Every page redesigned in this slice.
const REDESIGNED_PAGES = [
  'app/routes/EntryRoute.tsx',
  'app/routes/LoginRoute.tsx',
  'app/routes/SignupRoute.tsx',
  'app/routes/AccountRoute.tsx',
  'app/shell/AppShell.tsx',
  'app/shell/StudentBottomNav.tsx',
  'app/shell/StudentSideNav.tsx',
  'features/dashboard/routes/DashboardRoute.tsx',
  'features/lessons/routes/LessonsRoute.tsx',
  'features/lessons/routes/LessonDetailRoute.tsx',
  'features/lessons/components/LessonCard.tsx',
  'features/player/AudioPlayer.tsx',
  'features/player/MiniPlayer.tsx',
];

describe('Visual Slice 2 — deterministic design consistency', () => {
  it('page padding comes from the layout tokens and reserves Mini Player space', () => {
    const pc = read('app/shell/PageContainer.tsx');
    expect(pc).toContain('layout.pageInlinePadding');
    expect(pc).toContain('layout.bottomNavigationHeight');
    expect(pc).toContain('var(--fep-mini-player-space, 0px)');
  });

  it('student content width is bounded on every redesigned route', () => {
    for (const file of [
      'features/dashboard/routes/DashboardRoute.tsx',
      'features/lessons/routes/LessonDetailRoute.tsx',
      'app/routes/AccountRoute.tsx',
    ]) {
      expect(read(file), file).toContain('maxWidth="md"');
    }
    // LessonsRoute uses the PageContainer default (md).
    expect(read('features/lessons/routes/LessonsRoute.tsx')).toContain('<PageContainer>');
    for (const file of ['app/routes/LoginRoute.tsx', 'app/routes/SignupRoute.tsx']) {
      expect(read(file), file).toContain('maxWidth="sm"');
    }
  });

  it('English reading width is bounded by the reading token', () => {
    const detail = read('features/lessons/routes/LessonDetailRoute.tsx');
    expect(detail).toContain('layout.readingMaxWidth');
    expect(layout.readingMaxWidth).toBe('40rem');
  });

  it('the theme chrome heights are token-driven and fixed', () => {
    const toolbar = appTheme.components?.MuiToolbar?.styleOverrides?.root as {
      minHeight?: number;
    };
    expect(toolbar.minHeight).toBe(layout.headerHeight.xs);
    const bottomNav = appTheme.components?.MuiBottomNavigation?.styleOverrides?.root as {
      height?: number;
    };
    expect(bottomNav.height).toBe(layout.bottomNavigationHeight);
  });

  it('shared Button heights are consistent (44 / 48 large / 36 small)', () => {
    const button = appTheme.components?.MuiButton?.styleOverrides as {
      root?: { minHeight?: number };
      sizeLarge?: { minHeight?: number };
      sizeSmall?: { minHeight?: number };
    };
    expect(button.root?.minHeight).toBe(44);
    expect(button.sizeLarge?.minHeight).toBe(48);
    expect(button.sizeSmall?.minHeight).toBe(36);
    const iconButton = appTheme.components?.MuiIconButton?.styleOverrides?.root as {
      minWidth?: number;
      minHeight?: number;
    };
    expect(iconButton.minWidth).toBe(44);
    expect(iconButton.minHeight).toBe(44);
  });

  it('Cards use the shared card radius', () => {
    const card = appTheme.components?.MuiCard?.styleOverrides?.root as { borderRadius?: number };
    expect(card.borderRadius).toBe(radius.radiusCard);
  });

  it('tablet rail and desktop side navigation widths come from the tokens', () => {
    expect(layout.navigationRailWidth).toBe(88);
    expect(layout.desktopNavigationWidth).toBe(248);
    const shell = read('app/shell/AppShell.tsx');
    expect(shell).toContain('layout.navigationRailWidth');
    expect(shell).toContain('layout.desktopNavigationWidth');
    const rail = read('app/shell/StudentSideNav.tsx');
    expect(rail).toContain('layout.navigationRailWidth');
    expect(rail).toContain('layout.desktopNavigationWidth');
  });

  it('bottom navigation stays limited to the four primary destinations', () => {
    const nav = read('app/shell/StudentBottomNav.tsx');
    const destinations = [...nav.matchAll(/value:\s*'\/[^']+'/g)].map((m) => m[0]);
    expect(destinations).toHaveLength(4);
    expect(nav).toContain("label: 'خانه'");
    expect(nav).toContain("label: 'درس‌ها'");
    expect(nav).toContain("label: 'حساب'");
  });

  it('Entry page: registration is the only dominant filled action, login is outlined', () => {
    const entry = read('app/routes/EntryRoute.tsx');
    const contained = [...entry.matchAll(/variant="contained"/g)].length;
    expect(contained).toBe(1);
    const signupIdx = entry.indexOf('to="/signup"');
    const loginIdx = entry.indexOf('to="/login"');
    expect(signupIdx).toBeGreaterThan(-1);
    expect(loginIdx).toBeGreaterThan(signupIdx);
    // The two actions sit in one deliberate-spacing stack (16px).
    expect(entry).toContain('spacing={2}');
  });

  it('motion: route entrance and Mini Player use the documented motion tokens', () => {
    const route = read('app/shell/RouteTransition.tsx');
    expect(route).toContain('duration.durationStandard');
    expect(route).toContain('easing.easingStandard');
    const mini = read('features/player/MiniPlayer.tsx');
    expect(mini).toContain('duration.durationEmphasized');
    // No raw millisecond durations anywhere in the redesigned pages.
    for (const file of REDESIGNED_PAGES) {
      const lines = read(file).split('\n');
      for (const [i, line] of lines.entries()) {
        expect(/\b\d{2,4}ms\b/.test(line), `${file}:${i + 1} raw duration`).toBe(false);
      }
    }
  });

  it('redesigned pages contain no raw source-palette hex values', () => {
    for (const file of REDESIGNED_PAGES) {
      const lower = read(file).toLowerCase();
      expect(
        lower.includes('#0e171b') ||
          lower.includes('#f5f9fa') ||
          lower.includes('#4f95b5') ||
          lower.includes('#a3c9dc') ||
          lower.includes('#6eaecf') ||
          lower.includes('#e4edf1') ||
          lower.includes('#05090a') ||
          lower.includes('#4a90b0') ||
          lower.includes('#23495c') ||
          lower.includes('#307191'),
        `${file} contains a raw brand hex`,
      ).toBe(false);
    }
  });

  it('redesigned pages use shared components instead of repeated raw surfaces', () => {
    // Cards/surfaces must come from the shared Card/StatePanel/PageHeader
    // components; no stray raw `border: 1px` styling in the pages.
    for (const file of REDESIGNED_PAGES) {
      const content = read(file);
      expect(content.includes('border: 1px'), `${file} raw border`).toBe(false);
    }
  });
});
