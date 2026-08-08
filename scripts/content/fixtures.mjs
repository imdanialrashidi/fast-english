// scripts/content/fixtures.mjs
// Podcast Slice 3 — deterministic, test-safe media fixtures.
//
// Generates tiny valid PNGs (node:zlib) and small MP3 frames with a real,
// parseable duration. Used by the committed example package and by the
// smoke suite (which writes its own packages into a temp directory).
// No copyrighted material; every byte is generated here.

import { mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Deterministic solid-color PNG (rgba). */
export function makePng(width, height, { r = 40, g = 80, b = 200, a = 255 } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const off = rowStart + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }
  const idat = deflateSync(raw);

  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A minimal MPEG-1 Layer III frame (128 kbps, 44.1 kHz, stereo). */
function mp3Frame(payloadByte = 0x55) {
  const header = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
  const payload = Buffer.alloc(417, payloadByte);
  return Buffer.concat([header, payload]);
}

/**
 * MP3 with `frames` frames → duration = frames * 1152 / 44100 seconds
 * (~0.0261 s per frame). Deterministic and parseable by both the CLI
 * frame parser and music-metadata.
 */
export function makeMp3(frames = 40) {
  const frame = mp3Frame();
  const out = Buffer.alloc(frame.length * frames);
  for (let i = 0; i < frames; i++) frame.copy(out, i * frame.length);
  return out;
}

/**
 * Writes a complete, valid package directory for the given slug under
 * `root` and returns its path. All assets are generated fixtures.
 * `overrides` can replace manifest fields or omit files for failure
 * scenarios (e.g. `{ omit: ['audio/b1.mp3'] }`).
 */
export function writeFixturePackage(root, slug, overrides = {}) {
  const dir = join(root, slug);
  mkdirSync(join(dir, 'artwork'), { recursive: true });
  mkdirSync(join(dir, 'audio'), { recursive: true });
  mkdirSync(join(dir, 'transcripts'), { recursive: true });

  const square = overrides.square ?? makePng(640, 640);
  const hero = overrides.hero ?? makePng(1280, 720);
  const audioB1 = overrides.audioB1 ?? makeMp3(40);
  const audioC1 = overrides.audioC1 ?? makeMp3(60);

  writeFileSync(join(dir, 'artwork', 'square.png'), square);
  writeFileSync(join(dir, 'artwork', 'hero.png'), hero);
  writeFileSync(join(dir, 'audio', 'b1.mp3'), audioB1);
  writeFileSync(join(dir, 'audio', 'c1.mp3'), audioC1);
  writeFileSync(
    join(dir, 'transcripts', 'b1.md'),
    overrides.transcriptB1 ??
      '# The Pyramids of Egypt\n\nThis is a short fixture transcript about the pyramids.\n\nIt has enough words to satisfy the minimum length check for the example package and the smoke suite.\n\nParagraph two adds a little more text so the transcript is not flagged as too short by the editorial checks.\n',
  );
  writeFileSync(
    join(dir, 'transcripts', 'c1.md'),
    overrides.transcriptC1 ??
      '# The Pyramids of Egypt\n\nA longer fixture transcript for the C1 variant with a complete explanation of pyramid architecture, history and the people who built them.\n\nThis paragraph repeats the theme so the C1 transcript clearly exceeds the documented minimum length threshold used by the editorial validator.\n',
  );

  const manifest = {
    $schema: '../../schemas/episode-package.schema.json',
    schemaVersion: '1.0.0',
    contentKey: `general.${slug}`,
    contentVersion: overrides.contentVersion ?? 1,
    categoryKey: 'general',
    episode: {
      slug,
      titleEn: overrides.titleEn ?? `The ${slug} Episode`,
      titleFa: overrides.titleFa ?? `اپیزود ${slug}`,
      descriptionFa:
        overrides.descriptionFa ??
        'توضیح کوتاه اما کافی برای این اپیزود آزمایشی درباره تاریخچه موضوع مورد بحث در این اپیزود.',
      artworkSquare: 'artwork/square.png',
      heroImageWide: 'artwork/hero.png',
      artworkAltFa: 'نمای گرافیکی اپیزود آزمایشی',
      episodeNumber: overrides.episodeNumber ?? 1,
      featured: false,
    },
    variants: [
      {
        level: 'B1',
        summaryFa: 'خلاصه فارسی سطح B1 برای این اپیزود آزمایشی.',
        audio: 'audio/b1.mp3',
        transcript: 'transcripts/b1.md',
        vocabulary: [
          {
            term: 'pyramid',
            phonetic: '/ˈpɪrəmɪd/',
            partOfSpeech: 'noun',
            meaningFa: 'هرم',
            definitionEn: 'A large stone structure with a square base and triangular sides.',
            exampleSentence: 'The pyramid stands at the edge of the desert.',
          },
          {
            term: 'tomb',
            phonetic: '/tuːm/',
            partOfSpeech: 'noun',
            meaningFa: 'مقبره',
            definitionEn: 'A place where a dead person is buried.',
            exampleSentence: 'The tomb was sealed for thousands of years.',
          },
        ],
      },
      {
        level: 'C1',
        summaryFa: 'خلاصه فارسی سطح C1 با واژگان پیشرفته‌تر برای این اپیزود.',
        audio: 'audio/c1.mp3',
        transcript: 'transcripts/c1.md',
        vocabulary: [
          {
            term: 'monument',
            phonetic: '/ˈmɒnjʊmənt/',
            partOfSpeech: 'noun',
            meaningFa: 'یادمان',
            definitionEn: 'A structure built to remember a person or event.',
            exampleSentence: 'The monument honours the builders of the ancient city.',
          },
          {
            term: 'excavation',
            phonetic: '/ˌekskəˈveɪʃn/',
            partOfSpeech: 'noun',
            meaningFa: 'کاوش',
            definitionEn: 'The activity of digging in the ground to find old objects.',
            exampleSentence: 'The excavation revealed a hidden chamber.',
          },
        ],
      },
    ],
  };
  writeFileSync(join(dir, 'episode.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const omit = new Set(overrides.omit ?? []);
  for (const rel of omit) {
    try {
      unlinkSync(join(dir, rel));
    } catch {
      // already missing
    }
  }
  return { dir, manifest };
}

/**
 * Store-method ZIP builder (test/e2e fixtures). Writes deterministic
 * uncompressed ZIP bytes for the given entries — enough for the Admin
 * ZIP ingestion path (stored entries + a top-level folder). The browser
 * adapter also supports deflate; the smoke/e2e fixtures use store so the
 * bytes stay deterministic and dependency-free.
 */
export function buildStoreZip(entries) {
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let k = 0; k < 8; k++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  const enc = new TextEncoder();
  const u16le = (v) => new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
  const u32le = (v) =>
    new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]);
  const parts = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = enc.encode(entry.path);
    const bytes = Buffer.isBuffer(entry.bytes) ? new Uint8Array(entry.bytes) : entry.bytes;
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + name.length + bytes.length);
    local.set([0x50, 0x4b, 0x03, 0x04], 0);
    local.set(u16le(20), 4);
    local.set(u16le(0), 6);
    local.set(u16le(0), 8);
    local.set(u16le(0), 10);
    local.set(u16le(0x21), 12);
    local.set(u32le(crc), 14);
    local.set(u32le(bytes.length), 18);
    local.set(u32le(bytes.length), 22);
    local.set(u16le(name.length), 26);
    local.set(u16le(0), 28);
    local.set(name, 30);
    local.set(bytes, 30 + name.length);
    parts.push(local);
    const cd = new Uint8Array(46 + name.length);
    cd.set([0x50, 0x4b, 0x01, 0x02], 0);
    cd.set(u16le(0x031e), 4);
    cd.set(u16le(20), 6);
    cd.set(u16le(0), 8);
    cd.set(u16le(0), 10);
    cd.set(u16le(0), 12);
    cd.set(u16le(0x21), 14);
    cd.set(u32le(crc), 16);
    cd.set(u32le(bytes.length), 20);
    cd.set(u32le(bytes.length), 24);
    cd.set(u16le(name.length), 28);
    cd.set(u16le(0), 30);
    cd.set(u16le(0), 32);
    cd.set(u16le(0), 34);
    cd.set(u16le(0), 36);
    cd.set(u32le(0o100644 << 16), 38);
    cd.set(u32le(offset), 42);
    cd.set(name, 46);
    central.push(cd);
    offset += local.length;
  }
  const cdBytes = new Uint8Array(central.reduce((s, c) => s + c.length, 0));
  let cdOff = 0;
  for (const c of central) {
    cdBytes.set(c, cdOff);
    cdOff += c.length;
  }
  const eocd = new Uint8Array(22);
  eocd.set([0x50, 0x4b, 0x05, 0x06], 0);
  eocd.set(u16le(0), 4);
  eocd.set(u16le(0), 6);
  eocd.set(u16le(entries.length), 8);
  eocd.set(u16le(entries.length), 10);
  eocd.set(u32le(cdBytes.length), 12);
  eocd.set(u32le(offset), 16);
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0) + cdBytes.length + 22);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  out.set(cdBytes, pos);
  pos += cdBytes.length;
  out.set(eocd, pos);
  return Buffer.from(out);
}

/** ZIP entries for a written fixture package directory (episode.json + assets). */
export function packageDirToZipEntries(pkgDir, manifest) {
  const entries = [];
  const collect = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      const full = `${dir}/${name}`;
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(full).isDirectory()) {
        collect(full, rel);
      } else {
        entries.push({ path: rel, bytes: readFileSync(full) });
      }
    }
  };
  collect(pkgDir, manifest.episode.slug);
  return entries;
}
