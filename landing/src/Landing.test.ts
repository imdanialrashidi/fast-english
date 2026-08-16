import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const homeSource = readFileSync(resolve(root, 'src', 'pages', 'HomePage.tsx'), 'utf8');
const styles = readFileSync(resolve(root, 'src', 'styles.css'), 'utf8');

const requiredSections = [
  'Hero',
  'WhyLevelsSection',
  'HowItWorks',
  'ExperienceSection',
  'CefrSection',
  'SampleLesson',
  'PaymentSection',
  'InstallSection',
  'FaqSection',
  'FinalCta',
];

describe('landing foundation', () => {
  it('composes all required home sections', () => {
    for (const name of requiredSections) {
      expect(homeSource).toContain(name);
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

  it('does not import MUI/Emotion anywhere in the landing surface', () => {
    const sourceFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) sourceFiles.push(full);
      }
    };
    walk(resolve(root, 'src'));
    expect(sourceFiles.length).toBeGreaterThan(20);
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/@mui\/|@emotion\//);
    }
  });
});
