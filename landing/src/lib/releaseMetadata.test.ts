import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchReleaseMetadata,
  formatReleaseSize,
  resetReleaseMetadataCache,
  validateReleaseMetadata,
} from './releaseMetadata';

const valid = {
  versionName: '1.0.0',
  versionCode: 1,
  packageId: 'com.fastenglishpodcast.app',
  fileName: 'fast-english-podcast-v1.0.0.apk',
  sizeBytes: 3676778,
  sha256: 'e358b5c4654d6c259411c921acd69983d07799a15161c1fd02f6a869a9fdc2c5',
  signingCertificateSha256: '8FE0EA73B1243ABBE9263C28678BEAC521462E8D302F790AF0029E5C4B49D543',
  minimumAndroidApi: 24,
  targetAndroidApi: 36,
  builtAt: '2026-08-17T20:16:29Z',
};

describe('validateReleaseMetadata', () => {
  it('accepts the canonical valid payload and derives same-origin URLs', () => {
    const r = validateReleaseMetadata(valid);
    expect(r).not.toBeNull();
    expect(r?.versionName).toBe('1.0.0');
    expect(r?.downloadPath).toBe('/releases/fast-english-podcast-v1.0.0.apk');
    expect(r?.downloadUrl).toBe(
      'https://fastenglishpodcast.com/releases/fast-english-podcast-v1.0.0.apk',
    );
    expect(r?.sizeBytes).toBe(3676778);
  });

  it('rejects external origin redirect via url field (ignored) and via fileName traversal', () => {
    // Payload tries to inject external URL — we ignore the field and use fileName
    const withUrl = { ...valid, url: 'https://evil.com/malware.apk' };
    const r1 = validateReleaseMetadata(withUrl);
    expect(r1).not.toBeNull();
    expect(r1?.downloadPath).toBe('/releases/fast-english-podcast-v1.0.0.apk');
    expect(r1?.downloadUrl).not.toContain('evil.com');

    // FileName with traversal → rejected
    expect(validateReleaseMetadata({ ...valid, fileName: '../evil.apk' })).toBeNull();
    expect(
      validateReleaseMetadata({ ...valid, fileName: '/releases/fast-english-podcast-v1.0.0.apk' }),
    ).toBeNull();
    expect(validateReleaseMetadata({ ...valid, fileName: 'https://evil.com/app.apk' })).toBeNull();
  });

  it('rejects localhost and debug builds', () => {
    expect(
      validateReleaseMetadata({ ...valid, fileName: 'fast-english-podcast-v1.0.0-debug.apk' }),
    ).toBeNull();
    // Version mismatch between fileName and versionName → rejected (prevents confusion)
    expect(
      validateReleaseMetadata({ ...valid, fileName: 'fast-english-podcast-v9.9.9.apk' }),
    ).toBeNull();
  });

  it('rejects wrong packageId', () => {
    expect(validateReleaseMetadata({ ...valid, packageId: 'com.evil.app' })).toBeNull();
  });

  it('rejects invalid sha256', () => {
    expect(validateReleaseMetadata({ ...valid, sha256: 'zzzz' })).toBeNull();
    expect(validateReleaseMetadata({ ...valid, sha256: 'short' })).toBeNull();
    expect(validateReleaseMetadata({ ...valid, sha256: '' })).toBeNull();
  });

  it('rejects malformed version', () => {
    expect(validateReleaseMetadata({ ...valid, versionName: '1.0' })).toBeNull();
    expect(validateReleaseMetadata({ ...valid, versionName: '' })).toBeNull();
    expect(validateReleaseMetadata({ ...valid, versionCode: 0 })).toBeNull();
    expect(validateReleaseMetadata({ ...valid, versionCode: '1' })).toBeNull();
  });

  it('rejects unsafe sizeBytes', () => {
    expect(validateReleaseMetadata({ ...valid, sizeBytes: -1 })).toBeNull();
    expect(validateReleaseMetadata({ ...valid, sizeBytes: 999 * 1024 * 1024 })).toBeNull();
    expect(validateReleaseMetadata({ ...valid, sizeBytes: '3676778' })).toBeNull();
  });

  it('allows missing sizeBytes (shows without size) but still validates', () => {
    const { sizeBytes: _omit, ...withoutSize } = valid;
    const r = validateReleaseMetadata(withoutSize);
    expect(r).not.toBeNull();
    expect(r?.sizeBytes).toBeNull();
  });

  it('rejects non-object and empty', () => {
    expect(validateReleaseMetadata(null)).toBeNull();
    expect(validateReleaseMetadata([])).toBeNull();
    expect(validateReleaseMetadata({})).toBeNull();
  });

  it('ignores extra url fields and never returns external origin', () => {
    const payload = {
      ...valid,
      downloadUrl: 'https://evil.com/app.apk',
      apkUrl: 'http://localhost:3000/app.apk',
    };
    const r = validateReleaseMetadata(payload);
    expect(r).not.toBeNull();
    expect(r?.downloadUrl.startsWith('https://fastenglishpodcast.com/releases/')).toBe(true);
    expect(r?.downloadPath.startsWith('/releases/')).toBe(true);
  });
});

describe('formatReleaseSize', () => {
  it('formats bytes to Persian human readable', () => {
    expect(formatReleaseSize(3676778)).toContain('مگابایت');
    expect(formatReleaseSize(500)).toContain('بایت');
    expect(formatReleaseSize(2048)).toContain('کیلوبایت');
    expect(formatReleaseSize(null)).toBeNull();
    expect(formatReleaseSize(0)).toBeNull();
  });
});

describe('fetchReleaseMetadata', () => {
  beforeEach(() => {
    resetReleaseMetadataCache();
    vi.unstubAllGlobals();
  });

  it('returns validated metadata on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => valid,
      }),
    );
    const r = await fetchReleaseMetadata();
    expect(r?.versionName).toBe('1.0.0');
    expect(r?.downloadPath).toBe('/releases/fast-english-podcast-v1.0.0.apk');
  });

  it('returns null on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      }),
    );
    expect(await fetchReleaseMetadata()).toBeNull();
  });

  it('returns null on invalid JSON shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ versionName: 'bad' }),
      }),
    );
    expect(await fetchReleaseMetadata()).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchReleaseMetadata()).toBeNull();
  });

  it('caches per page load', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => valid,
    });
    vi.stubGlobal('fetch', spy);
    await fetchReleaseMetadata();
    await fetchReleaseMetadata();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
