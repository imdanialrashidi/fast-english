#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// scripts/generate-og-image.mjs
//
// Generates the deterministic social preview image
// `landing/public/og-image.png` (1200x630) with no external
// dependencies: a branded gradient tile with CEFR level stripes.
// The asset is committed so builds do not need to regenerate it;
// re-running this script reproduces byte-identical output.
import { deflateSync } from 'node:zlib';

const WIDTH = 1200;
const HEIGHT = 630;

// Midnight/ice palette (shared/ui/tokens/colors.ts + the landing tokens):
// the same family as the Student App Dark canvas and the PWA theme.
const MIDNIGHT = [11, 18, 32]; // #0B1220
const ICE_MUTED = [179, 193, 200]; // #B3C1C8
const PRIMARY = [42, 111, 140]; // #2A6F8C
const ACCENT = [46, 112, 146]; // #2E7092

// CEFR level stripe colors (backgrounds from the landing tokens).
const STRIPES = [
  [224, 242, 254], // A1 #E0F2FE
  [220, 252, 231], // A2 #DCFCE7
  [254, 243, 199], // B1 #FEF3C7
  [255, 237, 213], // B2 #FFEDD5
  [237, 233, 254], // C1 #EDE9FE
  [252, 231, 243], // C2 #FCE7F3
];
const STRIPE_W = 90;
const STRIPE_GAP = 20;
const STRIPE_Y = 500;
const STRIPE_H = 60;

// Waveform motif (deterministic; mirrored from the hero visual).
const WAVE = [14, 22, 34, 24, 42, 30, 18, 46, 38, 52, 26, 40, 20, 32, 48, 26, 36, 44, 22, 30];
const WAVE_Y = 330;
const WAVE_H = 90;

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const lerpColor = (c1, c2, t) => [
  lerp(c1[0], c2[0], t),
  lerp(c1[1], c2[1], t),
  lerp(c1[2], c2[2], t),
];

const totalStripes = STRIPES.length;
const stripesWidth = totalStripes * STRIPE_W + (totalStripes - 1) * STRIPE_GAP;
const stripesX = Math.floor((WIDTH - stripesWidth) / 2);

// Waveform bar geometry: bar i occupies x in [x0, x0+barW] with rounded
// ends approximated by vertical bars (the encoder is minimal).
const barW = 16;
const barGap = 14;
const barsWidth = WAVE.length * barW + (WAVE.length - 1) * barGap;
const barsX = Math.floor((WIDTH - barsWidth) / 2);

// Soft radial accent glow behind the waveform (blended toward midnight).
function glow(x, y) {
  const cx = WIDTH * 0.5;
  const cy = WAVE_Y;
  const r = 340;
  const d = Math.hypot(x - cx, y - cy) / r;
  if (d > 1) return null;
  const t = (1 - d) * (1 - d) * 0.28;
  return lerpColor(MIDNIGHT, PRIMARY, t);
}

function pixelAt(x, y) {
  // CEFR stripe band (the signature element).
  if (y >= STRIPE_Y && y < STRIPE_Y + STRIPE_H) {
    const rel = x - stripesX;
    if (rel >= 0 && rel < stripesWidth) {
      const slot = Math.floor(rel / (STRIPE_W + STRIPE_GAP));
      const within = rel - slot * (STRIPE_W + STRIPE_GAP);
      if (within < STRIPE_W && slot < totalStripes) {
        return STRIPES[slot];
      }
    }
  }
  // Waveform bars.
  if (y >= WAVE_Y && y < WAVE_Y + WAVE_H) {
    const rel = x - barsX;
    if (rel >= 0 && rel < barsWidth) {
      const slot = Math.floor(rel / (barW + barGap));
      const within = rel - slot * (barW + barGap);
      if (within < barW && slot < WAVE.length) {
        const h = WAVE[slot];
        const barTop = WAVE_Y + WAVE_H - h;
        if (y >= barTop) {
          // The middle bars are the "playing" accent.
          return slot >= 7 && slot <= 9 ? ACCENT : ICE_MUTED;
        }
      }
    }
  }
  const g = glow(x, y);
  if (g) return g;
  return MIDNIGHT;
}

// --- Minimal PNG encoder ---------------------------------------------------

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function buildPng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace

  // Raw scanlines: filter byte 0 + RGB triplets.
  const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
  for (let y = 0; y < HEIGHT; y += 1) {
    const rowStart = y * (1 + WIDTH * 3);
    raw[rowStart] = 0;
    for (let x = 0; x < WIDTH; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      const off = rowStart + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = buildPng();
const target = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'landing',
  'public',
  'og-image.png',
);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, png);
console.log(`og-image written: ${target} (${png.length} bytes)`);
