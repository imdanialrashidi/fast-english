import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const source = readFileSync(
  resolve(repoRoot, 'app', 'src', 'app', 'routes', 'LessonDemoRoute.tsx'),
  'utf8',
);

describe('English lesson content direction', () => {
  it('sets lang="en" and dir="ltr" on the lesson body container', () => {
    expect(source).toMatch(/lang="en"/);
    expect(source).toMatch(/dir="ltr"/);
  });

  it('keeps the lesson body inside a width-bounded readable column', () => {
    expect(source).toMatch(/maxWidth.*38rem/);
  });

  it('does not use the same physical-direction property pattern for RTL layout', () => {
    expect(source).not.toMatch(/textAlign:\s*['"]right['"]/);
  });
});
