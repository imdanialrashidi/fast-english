// shared/theme-settings.test.ts
// Podcast Slice 1 — the display-preference control exists ONLY inside
// Settings (Student Account Settings and Admin Settings). No always-visible
// theme button remains in any shell, entry or auth surface.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

// Files that may reference the ThemeSwitch component (the two Settings
// surfaces plus the dev-only catalog used by quality gates).
const ALLOWED_THEME_SWITCH_REF = new Set([
  'app/src/app/routes/AccountRoute.tsx', // Student: حساب ← تنظیمات نمایش
  'admin/src/routes/AdminSettingsRoute.tsx', // Admin: تنظیمات ← ظاهر
  'app/src/app/routes/CatalogRoute.tsx', // dev-only component catalog (VITE_CATALOG=1)
]);

describe('theme preference placement', () => {
  it('no ThemeSwitch import outside the Settings surfaces', () => {
    const surfaces = [
      'app/src/app/shell/AppHeader.tsx',
      'app/src/app/shell/AppShell.tsx',
      'app/src/app/routes/EntryRoute.tsx',
      'app/src/app/routes/LoginRoute.tsx',
      'app/src/app/routes/SignupRoute.tsx',
      'app/src/app/routes/NotFoundRoute.tsx',
      'admin/src/shell/AdminShell.tsx',
      'admin/src/routes/AdminLoginRoute.tsx',
      'admin/src/routes/AdminDashboardRoute.tsx',
      'admin/src/routes/AdminNotFoundRoute.tsx',
      'admin/src/AdminApp.tsx',
    ];
    for (const rel of surfaces) {
      const src = read(rel);
      expect(src, `${rel} must not import ThemeSwitch`).not.toMatch(/ThemeSwitch/);
    }
  });

  it('every ThemeSwitch usage sits in an allowed surface', () => {
    const candidates = [
      'app/src/app/routes/AccountRoute.tsx',
      'admin/src/routes/AdminSettingsRoute.tsx',
      'app/src/app/routes/CatalogRoute.tsx',
      'app/src/app/shell/AppHeader.tsx',
      'app/src/app/shell/AppShell.tsx',
      'app/src/app/routes/EntryRoute.tsx',
      'app/src/app/routes/LoginRoute.tsx',
      'app/src/app/routes/SignupRoute.tsx',
      'admin/src/shell/AdminShell.tsx',
      'admin/src/routes/AdminLoginRoute.tsx',
      'shared/ui/ThemeSwitch.tsx',
    ];
    for (const rel of candidates) {
      const src = read(rel);
      if (rel === 'shared/ui/ThemeSwitch.tsx') continue; // the implementation itself
      if (src.includes('ThemeSwitch')) {
        expect(
          ALLOWED_THEME_SWITCH_REF.has(rel),
          `${rel} uses ThemeSwitch but is not an allowed Settings surface`,
        ).toBe(true);
      }
    }
  });

  it('no floating theme button in persistent UI', () => {
    // The old always-visible entry-corner control is gone.
    expect(read('app/src/app/routes/EntryRoute.tsx')).not.toMatch(/entry-theme-switch/);
    expect(read('app/src/app/shell/AppHeader.tsx')).not.toMatch(/theme-switch/);
  });

  it('student theme control lives inside Account settings', () => {
    const account = read('app/src/app/routes/AccountRoute.tsx');
    expect(account).toContain('account-theme-switch');
    expect(account).toContain('تنظیمات نمایش');
  });

  it('admin theme control lives inside Admin settings', () => {
    const settings = read('admin/src/routes/AdminSettingsRoute.tsx');
    expect(settings).toContain('admin-theme-switch');
    expect(settings).toContain('ظاهر');
  });

  it('one shared ThemeSwitch implementation, no second copy', () => {
    const shared = read('shared/ui/ThemeSwitch.tsx');
    expect(shared).toContain('export function ThemeSwitch');
    // The old app-level copy is gone (the theme folder keeps only the
    // Student-specific ThemeHost + quality scanner).
    const themeDir = [
      'app/src/app/theme/ThemeHost.tsx',
      'app/src/app/theme/static-quality.test.ts',
    ];
    for (const rel of themeDir) {
      expect(read(rel), `${rel} must not re-implement the theme control`).not.toMatch(
        /export function ThemeSwitch/,
      );
    }
  });
});
