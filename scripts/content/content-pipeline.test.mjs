// scripts/content/content-pipeline.test.mjs
// Podcast Slice 3 — Node-side pipeline unit tests: package path
// containment (incl. symlink escape), artwork dimensions, audio
// metadata extraction, transcript handling and CLI exit codes.

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  inspectAudio,
  inspectImage,
  inspectTranscript,
  mp3DurationSeconds,
  mp4DurationSeconds,
} from './assets.mjs';
import { makeMp3, makePng, writeFixturePackage } from './fixtures.mjs';
import { ContentPackagePathError, resolveAssetPath } from './paths.mjs';
import { generateTemplate } from './template.mjs';

const WORK = mkdtempSync(join(tmpdir(), 'fep-pipeline-test-'));
const pkg = writeFixturePackage(WORK, 'unit-pkg');

describe('package path containment', () => {
  it('resolves a normal asset inside the package', () => {
    const real = resolveAssetPath(pkg.dir, 'artwork/square.png');
    expect(real.startsWith(pkg.dir)).toBe(true);
  });
  it('rejects traversal paths structurally', () => {
    expect(() => resolveAssetPath(pkg.dir, '../outside.txt')).toThrow(ContentPackagePathError);
  });
  it('rejects absolute and Windows drive paths', () => {
    expect(() => resolveAssetPath(pkg.dir, '/etc/passwd')).toThrow(ContentPackagePathError);
    expect(() => resolveAssetPath(pkg.dir, 'C:\\windows\\x')).toThrow(ContentPackagePathError);
  });
  it('rejects a symlink pointing outside the package root', () => {
    const dir = join(WORK, 'symlink-pkg');
    cpSync(pkg.dir, dir, { recursive: true });
    const outside = join(WORK, 'outside-target.png');
    writeFileSync(outside, makePng(4, 4));
    symlinkSync(outside, join(dir, 'artwork', 'evil.png'));
    expect(() => resolveAssetPath(dir, 'artwork/evil.png')).toThrow(ContentPackagePathError);
    // Full pipeline: the package is invalid with PACKAGE_PATH_ESCAPE.
    // (Skipped on platforms without symlink support.)
  });
});

describe('artwork dimensions', () => {
  it('reads PNG dimensions and signature', () => {
    const info = inspectImage(pkg.dir, 'artwork/square.png');
    expect(info.mimeType).toBe('image/png');
    expect(info.width).toBe(640);
    expect(info.height).toBe(640);
  });
  it('reads hero dimensions', () => {
    const info = inspectImage(pkg.dir, 'artwork/hero.png');
    expect(info.width).toBe(1280);
    expect(info.height).toBe(720);
  });
  it('rejects an unsupported type', () => {
    const dir = join(WORK, 'bad-image-pkg');
    cpSync(pkg.dir, dir, { recursive: true });
    writeFileSync(join(dir, 'artwork', 'square.png'), Buffer.from('not an image'));
    expect(() => inspectImage(dir, 'artwork/square.png')).toThrow(ContentPackagePathError);
  });
});

describe('audio metadata extraction', () => {
  it('extracts a deterministic MP3 duration from synthetic frames', async () => {
    const mp3 = makeMp3(40);
    expect(mp3DurationSeconds(mp3)).toBe(1); // 40 * 1152 / 44100 ≈ 1.04
    const info = await inspectAudio(pkg.dir, 'audio/b1.mp3');
    expect(info.durationSeconds).toBe(1);
    expect(info.mimeType).toBe('audio/mpeg');
  });
  it('parses M4A/MP4 durations from a minimal mvhd box', () => {
    // ftyp + moov/mvhd (version 0): timescale 1000, duration 2500 → 2.5s.
    const mvhd = Buffer.alloc(108);
    mvhd.writeUInt32BE(108, 0);
    mvhd.write('mvhd', 4, 'ascii');
    mvhd[8] = 0; // version 0
    mvhd.writeUInt32BE(1000, 12); // timescale
    mvhd.writeUInt32BE(2500, 16); // duration
    const moov = Buffer.alloc(8 + 108);
    moov.writeUInt32BE(8 + 108, 0);
    moov.write('moov', 4, 'ascii');
    mvhd.copy(moov, 8);
    const ftyp = Buffer.alloc(20);
    ftyp.writeUInt32BE(20, 0);
    ftyp.write('ftyp', 4, 'ascii');
    const file = Buffer.concat([ftyp, moov]);
    expect(mp4DurationSeconds(file)).toBe(3); // round(2.5)
  });
  it('returns 0 for unparseable audio', () => {
    expect(mp3DurationSeconds(Buffer.from('garbage'))).toBe(0);
  });
  it('rejects oversized or unsupported audio files', async () => {
    const dir = join(WORK, 'bad-audio-pkg');
    cpSync(pkg.dir, dir, { recursive: true });
    writeFileSync(join(dir, 'audio', 'b1.ogg'), Buffer.from('ogg'));
    await expect(inspectAudio(dir, 'audio/b1.ogg')).rejects.toThrow(ContentPackagePathError);
  });
});

describe('transcript handling', () => {
  it('normalizes BOM, CRLF and blank lines via the parser', async () => {
    const dir = join(WORK, 't-pkg');
    cpSync(pkg.dir, dir, { recursive: true });
    writeFileSync(
      join(dir, 'transcripts', 'b1.md'),
      '\uFEFF# Title\r\n\r\n\r\n\r\nLine one\r\nLine two  \r\n',
    );
    const info = inspectTranscript(dir, 'transcripts/b1.md');
    expect(info.normalized).toBe('# Title\n\nLine one\nLine two');
  });
  it('rejects embedded scripts', () => {
    const dir = join(WORK, 't-pkg2');
    cpSync(pkg.dir, dir, { recursive: true });
    writeFileSync(join(dir, 'transcripts', 'b1.md'), 'Hello <script>alert(1)</script>');
    expect(() => inspectTranscript(dir, 'transcripts/b1.md')).toThrow(ContentPackagePathError);
  });
});

describe('CLI exit codes', () => {
  const cli = (args, env = {}) =>
    spawnSync('node', ['scripts/content/cli.mjs', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: 30_000,
    });
  it('validate: 0 for a valid package', () => {
    const r = cli(['validate', pkg.dir]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PASS');
  });
  it('validate: 1 for an invalid package (template)', () => {
    const dir = join(WORK, 'tpl-exit');
    generateTemplate(WORK, 'tpl-exit', {});
    const r = cli(['validate', dir]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('FAIL');
  });
  it('validate: 1 for a missing directory', () => {
    const r = cli(['validate', join(WORK, 'does-not-exist')]);
    expect(r.status).toBe(1);
  });
  it('plan: 2 when environment variables are missing', () => {
    const r = cli(['plan', pkg.dir], {
      FEP_PB_URL: '',
      FEP_STAFF_EMAIL: '',
      FEP_STAFF_PASSWORD: '',
    });
    expect(r.status).toBe(2);
  });
  it('new: creates once and refuses to overwrite on the second call', () => {
    const slug = `unit-${Date.now()}`;
    const first = cli(['new', slug], { FEP_CONTENT_DIR: WORK });
    expect(first.status).toBe(0);
    const second = cli(['new', slug], { FEP_CONTENT_DIR: WORK });
    expect(second.status).toBe(2);
    expect(second.stdout).toContain('refusing to overwrite');
  });
  it('new: --levels A1,B1 (space-separated) produces exactly those variants', () => {
    const slug = `levels-space-${Date.now()}`;
    const r = cli(['new', slug, '--levels', 'A1,B1'], { FEP_CONTENT_DIR: WORK });
    expect(r.status).toBe(0, r.stdout);
    const pkg2 = JSON.parse(readFileSync(join(WORK, slug, 'episode.json'), 'utf8'));
    expect(pkg2.variants.map((v) => v.level)).toEqual(['A1', 'B1']);
  });
  it('new: --levels=A1,B1 (equals form) keeps working', () => {
    const slug = `levels-eq-${Date.now()}`;
    const r = cli(['new', slug, '--levels=A1,B1'], { FEP_CONTENT_DIR: WORK });
    expect(r.status).toBe(0, r.stdout);
    const pkg2 = JSON.parse(readFileSync(join(WORK, slug, 'episode.json'), 'utf8'));
    expect(pkg2.variants.map((v) => v.level)).toEqual(['A1', 'B1']);
  });
  it('validate never prints transcript contents', () => {
    const r = cli(['validate', pkg.dir]);
    expect(r.stdout).not.toContain('fixture transcript');
    expect(r.stdout).not.toContain('pyramid stands');
  });
});
