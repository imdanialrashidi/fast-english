// shared/content-package/zip.test.ts
// Podcast Slice 4 — bounded ZIP ingestion adapter + package assembly.
// Builds real ZIP bytes (store + deflate), asserts traversal/symlink/
// method/limit rejection, and proves the assembled package matches the
// Slice 3 representation (same shared validation modules as the CLI).

import { describe, expect, it } from 'vitest';
import { parseZip, ZIP_LIMITS, zipBasename } from './zip.ts';
import { assemblePackageFromZip } from './zipPackage.ts';

// --- Minimal deterministic ZIP writer (test helper) -------------------------

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface TestEntry {
  path: string;
  bytes: Uint8Array;
  method?: number;
  /** uncompressed length when method !== 0 (deflate test). */
  uncompressedSize?: number;
  /** unix mode for the external attrs (symlink test). */
  unixMode?: number;
}

function buildZip(entries: TestEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16le = (v: number) => new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
  const u32le = (v: number) =>
    new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]);

  for (const entry of entries) {
    const name = enc.encode(entry.path);
    const method = entry.method ?? 0;
    const uncompressedSize = entry.uncompressedSize ?? entry.bytes.length;
    const crc =
      entry.uncompressedSize !== undefined
        ? crc32(new Uint8Array(entry.uncompressedSize))
        : crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length + entry.bytes.length);
    local.set([0x50, 0x4b, 0x03, 0x04], 0);
    local.set(u16le(20), 4); // version needed
    local.set(u16le(0), 6); // flags
    local.set(u16le(method), 8);
    local.set(u16le(0), 10); // time
    local.set(u16le(0x21), 12); // date
    local.set(u32le(crc), 14);
    local.set(u32le(entry.bytes.length), 18); // compressed size
    local.set(u32le(uncompressedSize), 22); // uncompressed size
    local.set(u16le(name.length), 26);
    local.set(u16le(0), 28); // extra len
    local.set(name, 30);
    local.set(entry.bytes, 30 + name.length);
    parts.push(local);

    const externalAttrs = ((entry.unixMode ?? 0o100644) & 0xffff) << 16;
    const cd = new Uint8Array(46 + name.length);
    cd.set([0x50, 0x4b, 0x01, 0x02], 0);
    cd.set(u16le(0x031e), 4); // version made by (unix)
    cd.set(u16le(20), 6);
    cd.set(u16le(0), 8); // flags
    cd.set(u16le(method), 10);
    cd.set(u16le(0), 12);
    cd.set(u16le(0x21), 14);
    cd.set(u32le(crc), 16);
    cd.set(u32le(entry.bytes.length), 20);
    cd.set(u32le(uncompressedSize), 24);
    cd.set(u16le(name.length), 28);
    cd.set(u16le(0), 30);
    cd.set(u16le(0), 32);
    cd.set(u16le(0), 34);
    cd.set(u16le(0), 36);
    cd.set(u32le(externalAttrs >>> 0), 38);
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
  return out;
}

const manifest = {
  schemaVersion: '1.0.0',
  contentKey: 'general.probe-episode',
  contentVersion: 1,
  categoryKey: 'general',
  episode: {
    slug: 'probe-episode',
    titleEn: 'Probe Episode',
    titleFa: 'اپیزود آزمایشی',
    descriptionFa: 'توضیح کامل و کافی برای اپیزود آزمایشی که از آستانه هشدار بلندتر باشد.',
    artworkSquare: 'artwork/square.png',
    heroImageWide: 'artwork/hero.png',
    artworkAltFa: 'نمای آزمایشی',
    episodeNumber: 1,
    featured: false,
  },
  variants: [
    {
      level: 'B1',
      summaryFa: 'خلاصه آزمایشی نسخه B1',
      audio: 'audio/b1.mp3',
      transcript: 'transcripts/b1.md',
      vocabulary: [
        {
          term: 'pyramid',
          phonetic: '/ˈpɪrəmɪd/',
          partOfSpeech: 'noun',
          meaningFa: 'هرم',
          definitionEn: 'A large structure with triangular sides.',
          exampleSentence: 'The pyramid is very old.',
        },
      ],
    },
  ],
};

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x36, 0x28, 0x19,
]);

const transcript = `# Probe Episode\n\nThis is a sufficiently long transcript for the probe episode that clears the short-transcript warning threshold comfortably.\n\nAnother paragraph with real content.\n`;

function validEntries(): TestEntry[] {
  return [
    {
      path: 'probe-episode/episode.json',
      bytes: new TextEncoder().encode(JSON.stringify(manifest)),
    },
    { path: 'probe-episode/artwork/square.png', bytes: PNG_BYTES },
    { path: 'probe-episode/artwork/hero.png', bytes: PNG_BYTES },
    { path: 'probe-episode/audio/b1.mp3', bytes: new Uint8Array([0xff, 0xfb, 0x90, 0x64]) },
    { path: 'probe-episode/transcripts/b1.md', bytes: new TextEncoder().encode(transcript) },
  ];
}

describe('zipBasename', () => {
  it('returns the last path segment', () => {
    expect(zipBasename('a/b/episode.json')).toBe('episode.json');
    expect(zipBasename('episode.json')).toBe('episode.json');
  });
});

describe('parseZip', () => {
  it('parses a store-method zip with a top-level folder', async () => {
    const result = await parseZip(buildZip(validEntries()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries).toHaveLength(5);
    expect(result.entries[0].path).toBe('probe-episode/episode.json');
  });

  it('inflates deflate entries', async () => {
    const DCS = (
      globalThis as {
        CompressionStream?: new (
          f: string,
        ) => { readable: ReadableStream; writable: WritableStream };
      }
    ).CompressionStream;
    if (typeof DCS !== 'function') return; // environment without CompressionStream
    const cs = new DCS('deflate-raw');
    const writer = cs.writable.getWriter();
    await writer.write(new TextEncoder().encode(transcript));
    await writer.close();
    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(new Uint8Array(value));
    }
    const compressed = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
    let off = 0;
    for (const c of chunks) {
      compressed.set(c, off);
      off += c.length;
    }
    const result = await parseZip(
      buildZip([
        {
          path: 'probe-episode/transcripts/b1.md',
          bytes: compressed,
          method: 8,
          uncompressedSize: new TextEncoder().encode(transcript).length,
        },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new TextDecoder().decode(result.entries[0].bytes)).toBe(transcript);
  });

  it('rejects path traversal entries', async () => {
    const entries = validEntries();
    entries.push({ path: '../evil.txt', bytes: new Uint8Array([1]) });
    const result = await parseZip(buildZip(entries));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ZIP_ENTRY_UNSAFE_PATH');
  });

  it('rejects symlink entries', async () => {
    const entries = validEntries();
    entries.push({
      path: 'probe-episode/link.mp3',
      bytes: new Uint8Array([1]),
      unixMode: 0o120777,
    });
    const result = await parseZip(buildZip(entries));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ZIP_SYMLINK_REJECTED');
  });

  it('rejects unsupported compression methods', async () => {
    const entries = validEntries();
    entries.push({ path: 'x.bin', bytes: new Uint8Array([1, 2, 3]), method: 12 });
    const result = await parseZip(buildZip(entries));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ZIP_UNSUPPORTED_METHOD');
  });

  it('rejects garbage bytes', async () => {
    const result = await parseZip(new Uint8Array([1, 2, 3, 4, 5]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ZIP_INVALID');
  });

  it('enforces the entry-count limit', async () => {
    const many: TestEntry[] = [];
    for (let i = 0; i < ZIP_LIMITS.maxEntries + 1; i++) {
      many.push({ path: `f${i}.bin`, bytes: new Uint8Array([i]) });
    }
    const result = await parseZip(buildZip(many));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('ZIP_TOO_MANY_ENTRIES');
  });
});

describe('assemblePackageFromZip', () => {
  it('assembles a valid package with assets, fingerprint inputs and transcripts', async () => {
    const parsed = await parseZip(buildZip(validEntries()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const pkg = await assemblePackageFromZip(parsed.entries);
    if (!pkg.ok) throw new Error(`pkg errors: ${JSON.stringify(pkg.errors)}`);
    expect(pkg.ok).toBe(true);
    expect(pkg.errors).toEqual([]);
    expect(pkg.manifest?.contentKey).toBe('general.probe-episode');
    expect(pkg.assets?.length).toBe(4);
    const audio = pkg.assets?.find((a) => a.kind === 'audio');
    expect(audio?.mimeType).toBe('audio/mpeg');
    expect(audio?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(pkg.transcripts?.B1).toContain('Probe Episode');
  });

  it('reports a missing episode.json', async () => {
    const parsed = await parseZip(buildZip([{ path: 'x/readme.md', bytes: new Uint8Array([1]) }]));
    if (!parsed.ok) throw new Error('expected parse ok');
    const pkg = await assemblePackageFromZip(parsed.entries);
    expect(pkg.ok).toBe(false);
    expect(pkg.errors.some((e) => e.code === 'MANIFEST_NOT_FOUND')).toBe(true);
  });

  it('rejects a content-key mismatch', async () => {
    const broken = structuredClone(manifest);
    broken.contentKey = 'other.probe-episode';
    const entries = validEntries();
    entries[0] = {
      path: 'probe-episode/episode.json',
      bytes: new TextEncoder().encode(JSON.stringify(broken)),
    };
    const parsed = await parseZip(buildZip(entries));
    if (!parsed.ok) throw new Error('expected parse ok');
    const pkg = await assemblePackageFromZip(parsed.entries);
    expect(pkg.ok).toBe(false);
    expect(pkg.errors.some((e) => e.code === 'CONTENT_KEY_MISMATCH')).toBe(true);
  });

  it('reports missing declared assets', async () => {
    const entries = validEntries().filter((e) => !e.path.includes('audio/'));
    const parsed = await parseZip(buildZip(entries));
    if (!parsed.ok) throw new Error('expected parse ok');
    const pkg = await assemblePackageFromZip(parsed.entries);
    expect(pkg.ok).toBe(false);
    expect(pkg.errors.some((e) => e.code === 'ASSET_MISSING' && e.path === 'audio/b1.mp3')).toBe(
      true,
    );
  });

  it('flags editorial errors (placeholder copy) via the shared modules', async () => {
    const broken = structuredClone(manifest);
    broken.episode.titleEn = 'TODO_REPLACE';
    const entries = validEntries();
    entries[0] = {
      path: 'probe-episode/episode.json',
      bytes: new TextEncoder().encode(JSON.stringify(broken)),
    };
    const parsed = await parseZip(buildZip(entries));
    if (!parsed.ok) throw new Error('expected parse ok');
    const pkg = await assemblePackageFromZip(parsed.entries);
    expect(pkg.ok).toBe(false);
    expect(pkg.errors.some((e) => e.code === 'PLACEHOLDER_VALUE')).toBe(true);
  });
});
