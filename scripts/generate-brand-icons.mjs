// scripts/generate-brand-icons.mjs
// Deterministic brand-icon generator for the Fast English Podcast
// Product PWA and the Capacitor Android project.
//
// Produces PNGs only (pure Node: zlib + a tiny PNG encoder). The design
// mirrors the Product app BrandMark: a rounded gradient tile
// (#1D4ED8 -> #7C3AED, 135deg) with a white play triangle and three
// waveform bars. No fonts, no external imagery, no third-party tools.
//
// Outputs:
//   app/public/pwa-192x192.png              PWA icon 192x192 ("any")
//   app/public/pwa-512x512.png              PWA icon 512x512 ("any")
//   app/public/pwa-maskable-512x512.png     PWA maskable icon (full-bleed)
//   android/app/src/main/res/mipmap-*/ic_launcher.png / _round.png
//   android/app/src/main/res/mipmap-*/ic_launcher_foreground.png
//   android/app/src/main/res/drawable*/splash.png
//
// Run: node scripts/generate-brand-icons.mjs
// Deterministic: no timestamps are embedded; identical input -> identical bytes.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- brand constants (mirror app/src/app/theme/tokens.ts + BrandMark) ----
const GRADIENT_FROM = [0x1d, 0x4e, 0xd8]; // #1D4ED8 (primaryDark)
const GRADIENT_TO = [0x7c, 0x3a, 0xed]; // #7C3AED (secondary)
const SPLASH_BG = [0xf6, 0xf8, 0xfc]; // #F6F8FC (backgroundDefault)
const WHITE = [255, 255, 255];

// ---- tiny PNG encoder (RGBA8, filter 0, zlib) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- geometry helpers (normalized 0..1 coordinates) ----

// Signed distance to a rounded rectangle (negative inside).
// rect: { cx, cy, w, h, r }
function sdRoundRect(px, py, r) {
  const qx = Math.abs(px - r.cx) - (r.w / 2 - r.r);
  const qy = Math.abs(py - r.cy) - (r.h / 2 - r.r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r.r;
}

// Signed distance to a triangle (negative inside). `v` = vertices.
function sdTriangle(px, py, v) {
  const e0 = [v[1][0] - v[0][0], v[1][1] - v[0][1]];
  const e1 = [v[2][0] - v[1][0], v[2][1] - v[1][1]];
  const e2 = [v[0][0] - v[2][0], v[0][1] - v[2][1]];
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const area = cross(e0, e1);
  const sign = area < 0 ? -1 : 1;
  const p = [px, py];
  const d = [
    Math.abs(cross(e0, [p[0] - v[0][0], p[1] - v[0][1]])) / Math.hypot(e0[0], e0[1]),
    Math.abs(cross(e1, [p[0] - v[1][0], p[1] - v[1][1]])) / Math.hypot(e1[0], e1[1]),
    Math.abs(cross(e2, [p[0] - v[2][0], p[1] - v[2][1]])) / Math.hypot(e2[0], e2[1]),
  ];
  const inside =
    cross(e0, [p[0] - v[0][0], p[1] - v[0][1]]) * sign >= 0 &&
    cross(e1, [p[0] - v[1][0], p[1] - v[1][1]]) * sign >= 0 &&
    cross(e2, [p[0] - v[2][0], p[1] - v[2][1]]) * sign >= 0;
  return inside ? -Math.min(d[0], d[1], d[2]) : Math.min(d[0], d[1], d[2]);
}

// The brand mark: play triangle + waveform bars, normalized around
// center (0.5, 0.5); total group width ~0.475 (x 0.2775 .. 0.7525).
function markInside(px, py) {
  const tri = [
    [0.2775, 0.36],
    [0.2775, 0.64],
    [0.4575, 0.5],
  ];
  const bars = [
    { cx: 0.55, w: 0.065, h: 0.3, y0: 0.35 },
    { cx: 0.635, w: 0.065, h: 0.2, y0: 0.4 },
    { cx: 0.72, w: 0.065, h: 0.24, y0: 0.38 },
  ];
  if (sdTriangle(px, py, tri) <= 0.02) return true;
  for (const b of bars) {
    if (sdRoundRect(px, py, { cx: b.cx, cy: b.y0 + b.h / 2, w: b.w, h: b.h, r: b.w / 2 }) <= 0)
      return true;
  }
  return false;
}

// Gradient background color for a point inside the tile.
function tileColor(px, py) {
  const t = Math.max(0, Math.min(1, (px + py) / 2));
  return [
    Math.round(GRADIENT_FROM[0] + (GRADIENT_TO[0] - GRADIENT_FROM[0]) * t),
    Math.round(GRADIENT_FROM[1] + (GRADIENT_TO[1] - GRADIENT_FROM[1]) * t),
    Math.round(GRADIENT_FROM[2] + (GRADIENT_TO[2] - GRADIENT_FROM[2]) * t),
  ];
}

// Rasterize a square icon.
// options: { bg: 'tile'|'circle'|'plain'|'transparent', plainBg, tileRadius,
//            markScale }  (normalized; plainBg color for 'plain')
function raster(size, options) {
  const SS = 4; // supersampling
  const buf = Buffer.alloc(size * size * 4);
  const { bg, plainBg = WHITE, tileRadius = 0.22, markScale = 1 } = options;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          let color = WHITE;
          let alpha = 0;
          if (bg === 'tile') {
            if (sdRoundRect(px, py, { cx: 0.5, cy: 0.5, w: 1, h: 1, r: tileRadius }) <= 0) {
              color = tileColor(px, py);
              alpha = 1;
            }
          } else if (bg === 'circle') {
            if (Math.hypot(px - 0.5, py - 0.5) <= 0.5) {
              color = tileColor(px, py);
              alpha = 1;
            }
          } else if (bg === 'plain') {
            color = plainBg;
            alpha = 1;
          }
          const mx = 0.5 + (px - 0.5) / markScale;
          const my = 0.5 + (py - 0.5) / markScale;
          if (markInside(mx, my)) {
            color = WHITE;
            alpha = 1;
          }
          if (alpha > 0) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += 1;
          }
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      buf[i] = a === 0 ? 0 : Math.round(r / a);
      buf[i + 1] = a === 0 ? 0 : Math.round(g / a);
      buf[i + 2] = a === 0 ? 0 : Math.round(b / a);
      buf[i + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, size, buf);
}

// Rasterize a (possibly non-square) splash: light background with a
// centered brand tile. Fully opaque.
function rasterSplash(w, h) {
  const SS = 3;
  const buf = Buffer.alloc(w * h * 4);
  const tileW = Math.min(w, h) * 0.44;
  const tile = { cx: 0.5, cy: 0.5, w: tileW / w, h: tileW / h, r: (tileW / Math.min(w, h)) * 0.22 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / w;
          const py = (y + (sy + 0.5) / SS) / h;
          let color = SPLASH_BG;
          if (sdRoundRect(px, py, tile) <= 0) color = tileColor(px, py);
          // Mark inside the tile (tile-space coordinates).
          const mx = 0.5 + (px - 0.5) / tile.w;
          const my = 0.5 + (py - 0.5) / tile.h;
          if (markInside(mx, my)) color = WHITE;
          r += color[0];
          g += color[1];
          b += color[2];
        }
      }
      const n = SS * SS;
      const i = (y * w + x) * 4;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
      buf[i + 3] = 255;
    }
  }
  return encodePng(w, h, buf);
}

function write(path, png) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
}

// ---- outputs ----
const APP_PUBLIC = join(ROOT, 'app/public');
write(join(APP_PUBLIC, 'pwa-192x192.png'), raster(192, { bg: 'tile' }));
write(join(APP_PUBLIC, 'pwa-512x512.png'), raster(512, { bg: 'tile' }));
write(
  join(APP_PUBLIC, 'pwa-maskable-512x512.png'),
  raster(512, { bg: 'tile', tileRadius: 0.05, markScale: 0.8 }),
);

const RES = join(ROOT, 'android/app/src/main/res');
const iconSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const fgSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const [density, size] of Object.entries(iconSizes)) {
  write(join(RES, `mipmap-${density}`, 'ic_launcher.png'), raster(size, { bg: 'tile' }));
  write(join(RES, `mipmap-${density}`, 'ic_launcher_round.png'), raster(size, { bg: 'circle' }));
}
// Adaptive foreground: transparent background, mark within the 66/108 safe zone.
for (const [density, size] of Object.entries(fgSizes)) {
  write(
    join(RES, `mipmap-${density}`, 'ic_launcher_foreground.png'),
    raster(size, { bg: 'transparent', markScale: 0.62 }),
  );
}

// Splash: light background + centered brand tile (no text).
const portSizes = {
  mdpi: [320, 480],
  hdpi: [480, 800],
  xhdpi: [640, 960],
  xxhdpi: [960, 1440],
  xxxhdpi: [1280, 1920],
};
for (const [density, [w, h]] of Object.entries(portSizes)) {
  write(join(RES, `drawable-port-${density}`, 'splash.png'), rasterSplash(w, h));
  write(join(RES, `drawable-land-${density}`, 'splash.png'), rasterSplash(h, w));
}
write(join(RES, 'drawable', 'splash.png'), rasterSplash(480, 320));

console.log('Brand icons generated.');
