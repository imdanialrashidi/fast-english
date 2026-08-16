// landing/src/components/brand.test.ts
// The landing brand must be the OFFICIAL Fast English assets, not an
// improvised mark:
//   - the inline monochrome path data is byte-identical to the approved
//     fast_english_logo_black.svg (same contract as the Student App's
//     shared/ui/brand/assets.test.ts);
//   - the header wordmark PNG copy matches the approved asset;
//   - the landing favicon is the official app favicon (never the legacy
//     improvised "FE" gradient tile).
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { landingLogoPaths } from './BrandMark';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const SOURCE_DIR = join(ROOT, 'fast_english_logo_assets');
const LANDING_PUBLIC_DIR = join(ROOT, 'landing', 'public');

function svgPathData(svg: string): string[] {
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  return paths.map((p) => p.replace(/\s+/g, ' ').trim());
}

describe('landing brand assets', () => {
  it('inline monochrome mark is byte-identical to the approved SVG', () => {
    const svg = readFileSync(join(SOURCE_DIR, 'fast_english_logo_black.svg'), 'utf8');
    const approved = svgPathData(svg);
    expect(approved).toHaveLength(3);
    const inline = [landingLogoPaths.p0, landingLogoPaths.p1, landingLogoPaths.p2];
    for (let i = 0; i < approved.length; i++) {
      expect(inline[i].replace(/\s+/g, ' ').trim(), `path ${i}`).toBe(approved[i]);
    }
  });

  it('header wordmark PNG copy matches the approved asset', () => {
    const copy = readFileSync(join(LANDING_PUBLIC_DIR, 'fastenglish_header_logo.png'));
    const source = readFileSync(join(SOURCE_DIR, 'fastenglish_header_logo.png'));
    expect(copy).toEqual(source);
  });

  it('landing favicon is the official app favicon', () => {
    const copy = readFileSync(join(ROOT, 'landing', 'public', 'favicon.png'));
    const source = readFileSync(join(SOURCE_DIR, 'fast_english_app_favicon.png'));
    expect(copy).toEqual(source);
    expect(statSync(join(ROOT, 'landing', 'public', 'favicon.png')).size).toBeGreaterThan(1000);
  });
});
