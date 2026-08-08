import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const bottomNav = readFileSync(
  resolve(repoRoot, 'app', 'src', 'app', 'shell', 'StudentBottomNav.tsx'),
  'utf8',
);
const sideNav = readFileSync(
  resolve(repoRoot, 'app', 'src', 'app', 'shell', 'StudentSideNav.tsx'),
  'utf8',
);

// Final Student destinations (Podcast Slice 5): خانه / کتابخانه / پیشرفت / حساب.
const requiredLabels = ['خانه', 'کتابخانه', 'پیشرفت', 'حساب'];

describe('student navigation', () => {
  it('bottom nav declares the four primary destinations', () => {
    for (const label of requiredLabels) {
      expect(bottomNav).toContain(label);
    }
  });

  it('side nav renders the same shared destination items', () => {
    expect(sideNav).toContain('studentNavItems');
    expect(sideNav).toContain('currentNavValue');
  });

  it('bottom nav no longer offers the legacy lessons destination', () => {
    expect(bottomNav).not.toContain('درس‌ها');
  });

  it('bottom nav is hidden on tablet and up (md+)', () => {
    expect(bottomNav).toMatch(/display.*xs.*block.*md.*none/);
  });

  it('side nav is hidden on mobile and shown on tablet and up', () => {
    expect(sideNav).toMatch(/display.*xs.*none.*md.*block/);
  });
});
