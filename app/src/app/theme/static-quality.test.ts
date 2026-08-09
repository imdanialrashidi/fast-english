// Static quality rules for the visual system.
//
// Automated scans over the Product-App source (app/) that detect:
//   1. raw supplied brand hex colors outside approved files;
//   2. arbitrary box shadows outside the elevation tokens;
//   3. arbitrary border radii outside the approved shape set;
//   4. direct imports of brand assets outside the Brand component;
//   5. raw black/white used as foreground colors;
//   6. remote font URLs;
//   7. undocumented animation/transition durations;
//   8. `transition: all`;
//   9. global overflow hiding (text ellipsis is the documented exception).
//
// Scans run against the working tree (app/, plus the app index.html). Test
// files and the catalog are allowed to reference token values; approved
// files are listed explicitly so new violations fail loudly.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root (see vitest.config.ts).
const ROOT = process.cwd();
const APP_DIR = join(ROOT, 'app');

// The ten supplied brand source colors (lowercase, no `#`).
const SUPPLIED_HEXES = [
  '0e171b',
  'f5f9fa',
  '4f95b5',
  'a3c9dc',
  '6eaecf',
  'e4edf1',
  '05090a',
  '4a90b0',
  '23495c',
  '307191',
];

// Files where the supplied hexes may legitimately appear. The design
// tokens live in shared/ui (Podcast Slice 1) and are scanned together
// with the app source.
const HEX_APPROVED_REL = new Set([
  'shared/ui/tokens/colors.ts', // the palette definition itself
  'shared/ui/theme.test.ts', // test fixtures
  'shared/ui/palette.contrast.test.ts', // test fixtures
]);

// Files where literal shadows/durations may appear (the token definitions).
const SHADOW_APPROVED_REL = new Set([
  'shared/ui/tokens/elevation.ts',
  'shared/ui/theme.ts',
  'shared/ui/theme.test.ts',
]);

const DURATION_APPROVED_REL = new Set([
  'shared/ui/tokens/motion.ts',
  'shared/ui/theme.ts',
  'shared/ui/theme.test.ts',
  'shared/ui/ThemeSwitch.tsx',
  'app/src/app/shell/AppHeader.tsx',
  'app/src/app/routes/CatalogRoute.tsx',
]);

// Approved literal border-radius values (px) from tokens/shape.ts.
const APPROVED_RADII = new Set(['10', '12', '16', '20', '24', '999']);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (/\.(tsx?|css)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

// Scan the Product-App source together with the shared design system
// (tokens/theme/Brand moved to shared/ in Podcast Slice 1).
const SHARED_UI_DIR = join(ROOT, 'shared', 'ui');
const appFiles = walk(APP_DIR)
  .concat(walk(SHARED_UI_DIR))
  .filter((f) => !f.includes('.test.'));
const allAppFiles = walk(APP_DIR).concat(walk(SHARED_UI_DIR));

function rel(file: string): string {
  // Repo-relative path so app/ and shared/ files share one namespace.
  return relative(ROOT, file);
}

describe('static quality rules (Product App)', () => {
  it('finds no supplied brand hex colors outside approved files', () => {
    const offenders: string[] = [];
    for (const file of appFiles) {
      const content = readFileSync(file, 'utf8');
      if (!content.toLowerCase().includes('#')) continue;
      const lower = content.toLowerCase();
      for (const hex of SUPPLIED_HEXES) {
        if (lower.includes(`#${hex}`)) {
          offenders.push(`${rel(file)}: #${hex}`);
        }
      }
    }
    const unapproved = offenders.filter((o) => {
      const file = o.split(':')[0];
      return !HEX_APPROVED_REL.has(file);
    });
    expect(unapproved).toEqual([]);
  });

  it('finds no literal box shadows outside the elevation tokens', () => {
    const offenders: string[] = [];
    for (const file of appFiles) {
      if (SHADOW_APPROVED_REL.has(rel(file))) continue;
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        // A literal shadow: boxShadow followed by a quoted value containing
        // an offset/rgba (var() and `none` references are allowed).
        if (
          /\bboxShadow\s*:\s*['"`][^'"`]*(rgba|0px|\dpx)/.test(line) &&
          !/var\(--mui-elevation/.test(line)
        ) {
          offenders.push(`${rel(file)}:${i + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('finds no border radii outside the approved shape set', () => {
    const offenders: string[] = [];
    for (const file of appFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        const m = line.match(/borderRadius\s*:\s*['"]?(\d+)(?:px)?['"]?/);
        // '50%' is a circular mark, not a radius role.
        if (/borderRadius\s*:\s*'50%'/.test(line)) return;
        if (m && !APPROVED_RADII.has(m[1])) {
          offenders.push(`${rel(file)}:${i + 1} borderRadius ${m[1]}px ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('imports brand assets only through the Brand component', () => {
    const offenders: string[] = [];
    for (const file of appFiles) {
      const content = readFileSync(file, 'utf8');
      if (/assets\/brand\//.test(content) && rel(file) !== 'shared/ui/brand/Brand.tsx') {
        offenders.push(rel(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('finds no raw black/white foreground colors', () => {
    const offenders: string[] = [];
    for (const file of appFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/\bcolor\s*:\s*['"`](black|white|#000|#fff|#000000|#ffffff)['"`]/i.test(line)) {
          offenders.push(`${rel(file)}:${i + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('loads fonts only from the self-hosted local bundle', () => {
    const offenders: string[] = [];
    for (const file of [...appFiles, join(ROOT, 'app', 'index.html')]) {
      const content = readFileSync(file, 'utf8');
      if (/fonts\.(googleapis|gstatic)\.com|@import|url\(\s*https?:/i.test(content)) {
        offenders.push(rel(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('finds no undocumented animation/transition durations', () => {
    const offenders: string[] = [];
    for (const file of appFiles) {
      if (DURATION_APPROVED_REL.has(rel(file))) continue;
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        // Literal millisecond durations outside the motion tokens.
        if (/\b\d{2,4}ms\b/.test(line)) {
          offenders.push(`${rel(file)}:${i + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('finds no `transition: all`', () => {
    const offenders: string[] = [];
    for (const file of appFiles) {
      const content = readFileSync(file, 'utf8');
      if (/\btransition\s*:\s*['"`]?all\b/i.test(content)) {
        offenders.push(rel(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('finds no global overflow hiding (documented exceptions)', () => {
    // Exceptions (must not be used to conceal layout defects):
    //  - text truncation: textOverflow ellipsis or WebkitLineClamp in the
    //    same style block (single- and multi-line clamping);
    //  - image containment: maxHeight-bounded preview/crop boxes;
    //  - visually-hidden screen-reader inputs: `clip: rect(...)`;
    //  - image fitting: objectFit cover/contain.
    const offenders: string[] = [];
    for (const file of appFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (!/\boverflow(X)?\s*:\s*['"`]hidden['"`]/.test(line)) return;
        const block = lines.slice(i, i + 12).join('\n');
        const allowed =
          /textOverflow\s*:\s*['"`]ellipsis['"`]/.test(block) ||
          /WebkitLineClamp\s*:/.test(block) ||
          /\bmaxHeight\s*:/.test(block) ||
          /clip\s*:\s*['"`]rect\(0,0,0,0\)/.test(block) ||
          /\bobjectFit\s*:/.test(block);
        if (!allowed) {
          offenders.push(`${rel(file)}:${i + 1} ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('scans a meaningful surface (at least 60 source files)', () => {
    expect(allAppFiles.length).toBeGreaterThanOrEqual(60);
  });
});
