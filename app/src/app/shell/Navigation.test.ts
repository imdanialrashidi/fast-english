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

const requiredLabels = ['خانه', 'درس‌ها', 'پیشرفت', 'حساب'];

describe('student navigation', () => {
  it('bottom nav declares the four primary destinations', () => {
    for (const label of requiredLabels) {
      expect(bottomNav).toContain(label);
    }
  });

  it('side nav declares the same four primary destinations', () => {
    for (const label of requiredLabels) {
      expect(sideNav).toContain(label);
    }
  });

  it('bottom nav is hidden on tablet and up (md+)', () => {
    expect(bottomNav).toMatch(/display.*xs.*block.*md.*none/);
  });

  it('side nav is hidden on mobile and shown on tablet and up', () => {
    expect(sideNav).toMatch(/display.*xs.*none.*md.*block/);
  });
});
