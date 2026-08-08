import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const appStyles = readFileSync(resolve(repoRoot, 'app', 'src', 'styles.css'), 'utf8');
const landingStyles = readFileSync(resolve(repoRoot, 'landing', 'src', 'styles.css'), 'utf8');
const appFiles = [
  'src/main.tsx',
  'src/app/App.tsx',
  'src/app/theme/ThemeHost.tsx',
  'src/app/shell/AppShell.tsx',
];
const landingFiles = [
  'src/mount.tsx',
  'src/entry-home.tsx',
  'src/entry-about.tsx',
  'src/entry-install.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/PrivacyPage.tsx',
  'src/layouts/SiteLayout.tsx',
  'src/sections/Header.tsx',
  'src/sections/Hero.tsx',
  'src/sections/CefrSection.tsx',
  'src/sections/SampleLesson.tsx',
  'src/sections/HowItWorks.tsx',
  'src/sections/InstallSection.tsx',
  'src/sections/FaqSection.tsx',
  'src/sections/Footer.tsx',
  'src/components/BrandMark.tsx',
  'src/components/ApkButton.tsx',
  'src/lib/siteConfig.ts',
  'src/content/siteContent.ts',
];

describe('build boundary isolation', () => {
  it('app stylesheet does not import Tailwind', () => {
    expect(appStyles).not.toMatch(/@import\s+['"]tailwindcss['"]/);
    expect(appStyles).not.toMatch(/@tailwind/);
  });

  it('landing stylesheet imports Tailwind through @import "tailwindcss"', () => {
    expect(landingStyles).toMatch(/@import\s+['"]tailwindcss['"]/);
  });

  it('landing stylesheet does not import MUI', () => {
    expect(landingStyles).not.toMatch(/@mui\//);
  });

  it('app stylesheet does not use Tailwind @apply', () => {
    expect(appStyles).not.toMatch(/@apply\s+/);
  });

  it('landing source does not import from app or shared', () => {
    for (const rel of landingFiles) {
      const src = readFileSync(resolve(repoRoot, 'landing', rel), 'utf8');
      expect(src, `${rel} must not import from app/`).not.toMatch(/from\s+['"][^'"]*app\//);
      expect(src, `${rel} must not import from shared/`).not.toMatch(/from\s+['"][^'"]*shared\//);
    }
  });

  it('app source does not import from landing', () => {
    for (const rel of appFiles) {
      const src = readFileSync(resolve(repoRoot, 'app', rel), 'utf8');
      expect(src, `${rel} must not import from landing/`).not.toMatch(/from\s+['"][^'"]*landing\//);
    }
  });
});
