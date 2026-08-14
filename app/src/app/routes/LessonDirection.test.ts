import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
// The lesson-direction contract lives on the LIVE episode surface (the
// legacy app/routes/LessonDemoRoute.tsx was removed as dead code). The
// English reading body is LTR-isolated inside the RTL shell and width-
// bounded by the shared readingMaxWidth token.
const source = readFileSync(
  resolve(repoRoot, 'app', 'src', 'features', 'lessons', 'routes', 'LessonDetailRoute.tsx'),
  'utf8',
);
const tokens = readFileSync(resolve(repoRoot, 'shared', 'ui', 'tokens', 'spacing.ts'), 'utf8');

describe('English lesson content direction', () => {
  it('sets lang="en" and dir="ltr" on the lesson body container', () => {
    expect(source).toMatch(/lang="en"/);
    expect(source).toMatch(/dir="ltr"/);
  });

  it('keeps the lesson body inside a width-bounded readable column via the readingMaxWidth token', () => {
    expect(source).toMatch(/layout\.readingMaxWidth/);
    const width = tokens.match(/readingMaxWidth:\s*'([^']+)'/);
    expect(width).toBeTruthy();
    expect(width?.[1]).toMatch(/^(\d+\.?\d*)rem$/);
    const rem = Number(width?.[1].replace('rem', ''));
    expect(rem).toBeGreaterThan(0);
    expect(rem).toBeLessThanOrEqual(42);
  });

  it('does not use the same physical-direction property pattern for RTL layout', () => {
    expect(source).not.toMatch(/textAlign:\s*['"]right['"]/);
  });
});
