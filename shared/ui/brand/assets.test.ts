// Asset correctness tests for the approved logo assets.
//
// Programmatic inspection only — no image understanding. Verifies:
//   - every approved asset exists (source + app copies in sync);
//   - the SVG parses, has a valid viewBox, no external references/scripts;
//   - the Brand component preserves the exact approved geometry;
//   - PNG dimensions/format are known and RGBA (alpha channel);
//   - the favicon path referenced by index.html is valid;
//   - no page imports the raw assets outside the Brand component;
//   - Dark mode never renders the black PNG/SVG artwork (documented fallback).

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { logoPaths } from './Brand';

const ROOT = process.cwd();
const SOURCE_DIR = join(ROOT, 'fast_english_logo_assets');
const APP_BRAND_DIR = join(ROOT, 'shared', 'assets', 'brand');

const APPROVED = {
  svg: 'fast_english_logo_black.svg',
  headerPng: 'fastenglish_header_logo.png',
  faviconPng: 'fast_english_app_favicon.png',
} as const;

function pngInfo(path: string) {
  const buf = readFileSync(path);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  return { width, height, bitDepth, colorType, bytes: buf.length };
}

describe('brand assets', () => {
  it('has every approved asset in the source directory', () => {
    for (const name of Object.values(APPROVED)) {
      expect(statSync(join(SOURCE_DIR, name)).isFile(), `missing ${name}`).toBe(true);
    }
  });

  it('keeps the app copies byte-identical to the source assets', () => {
    for (const name of Object.values(APPROVED)) {
      expect(readFileSync(join(APP_BRAND_DIR, name))).toEqual(readFileSync(join(SOURCE_DIR, name)));
    }
  });

  it('parses the SVG and has a valid viewBox', () => {
    const svg = readFileSync(join(APP_BRAND_DIR, APPROVED.svg), 'utf8');
    const viewBox = svg.match(/viewBox="([^"]+)"/);
    expect(viewBox).not.toBeNull();
    const vb = viewBox ?? ['', ''];
    const [x, y, w, h] = vb[1].split(/\s+/).map(Number);
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
    // aspect ratio matches the rendered mark's intrinsic ratio
    expect(w / h).toBeCloseTo(1536 / 1024, 5);
  });

  it('SVG contains no external references, scripts or images', () => {
    const svg = readFileSync(join(APP_BRAND_DIR, APPROVED.svg), 'utf8');
    expect(svg).not.toMatch(/xlink:href|href=|<\s*script|<image|<foreignObject|<use\b/i);
    expect(svg).not.toMatch(/url\(/i);
  });

  it('SVG mark is a monochrome currentColor treatment of the approved geometry', () => {
    const svg = readFileSync(join(APP_BRAND_DIR, APPROVED.svg), 'utf8');
    const sourcePaths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
    expect(sourcePaths.length).toBe(3);
    const rendered = Object.values(logoPaths);
    expect(rendered.length).toBe(3);
    // Geometry parity: each approved path is rendered verbatim.
    for (const p of sourcePaths) {
      expect(rendered).toContain(p);
    }
    // The mark is filled with currentColor (theme-aware), never hard black.
    const markSource = readFileSync(join(ROOT, 'shared', 'ui', 'brand', 'Brand.tsx'), 'utf8');
    expect(markSource).toMatch(/fill="currentColor"/);
  });

  it('PNG dimensions and formats are known and RGBA with alpha channel', () => {
    const header = pngInfo(join(APP_BRAND_DIR, APPROVED.headerPng));
    expect(header.width).toBe(697);
    expect(header.height).toBe(197);
    expect(header.colorType).toBe(6); // RGBA
    expect(header.bitDepth).toBe(8);
    expect(header.bytes).toBeGreaterThan(1000);

    const favicon = pngInfo(join(APP_BRAND_DIR, APPROVED.faviconPng));
    expect(favicon.width).toBe(1024);
    expect(favicon.height).toBe(1024);
    expect(favicon.colorType).toBe(6);
    expect(favicon.bitDepth).toBe(8);
  });

  it('favicon path referenced by the app HTML is valid', () => {
    const html = readFileSync(join(ROOT, 'app', 'index.html'), 'utf8');
    const link = html.match(/<link rel="icon"[^>]*href="([^"]+)"/);
    expect(link).not.toBeNull();
    const href = (link ?? ['', ''])[1];
    expect(statSync(join(ROOT, 'app', 'public', href.replace(/^\//, ''))).isFile()).toBe(true);
  });

  it('renders the header PNG only on Light surfaces (black artwork check)', () => {
    // The PNG is black artwork on transparent (RGBA) and must not be shown
    // on dark surfaces; the Brand component documents this fallback.
    const brandSource = readFileSync(join(ROOT, 'shared', 'ui', 'brand', 'Brand.tsx'), 'utf8');
    expect(brandSource).toMatch(/variant === 'header' && !isDark/);
    expect(brandSource).toMatch(/MonochromeMark/);
  });

  it('Brand component enforces a documented minimum mark size', () => {
    const brandSource = readFileSync(join(ROOT, 'shared', 'ui', 'brand', 'Brand.tsx'), 'utf8');
    expect(brandSource).toMatch(/MIN_BRAND_MARK_PX = 24/);
  });

  it('no page imports the raw brand assets outside the Brand component', () => {
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const matches = execSync(`rg -l "assets/brand/" app/src --glob '*.{ts,tsx}' || true`, {
      cwd: ROOT,
    })
      .toString()
      .trim();
    const offenders = matches
      .split('\n')
      .filter(Boolean)
      .filter((f) => !f.endsWith('app/brand/Brand.tsx') && !f.endsWith('brand/assets.test.ts'));
    expect(offenders).toEqual([]);
  });
});
