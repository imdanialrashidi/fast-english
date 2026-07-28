import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const landingSource = readFileSync(resolve(root, 'src', 'Landing.tsx'), 'utf8');
const styles = readFileSync(resolve(root, 'src', 'styles.css'), 'utf8');

const requiredSections = [
  'Header',
  'Hero',
  'CefrSection',
  'SampleLesson',
  'HowItWorks',
  'CtaSection',
  'Footer',
];

describe('landing foundation', () => {
  it('composes all required sections', () => {
    for (const name of requiredSections) {
      expect(landingSource).toContain(name);
    }
  });

  it('imports Tailwind through @import "tailwindcss"', () => {
    expect(styles).toMatch(/@import\s+['"]tailwindcss['"]/);
  });

  it('restricts Tailwind source scanning to the landing surface', () => {
    expect(styles).toMatch(/@source\s+['"][^'"]*\*\.\{ts,tsx,html\}/);
  });

  it('self-hosts Vazirmatn variable WOFF2 and does not load a runtime CDN', () => {
    expect(styles).toMatch(/@font-face[\s\S]*?Vazirmatn[\s\S]*?woff2-variations/);
    expect(styles).not.toMatch(/fonts\.googleapis\.com|cdn\.jsdelivr\.net.*vazirmatn/);
  });
});
