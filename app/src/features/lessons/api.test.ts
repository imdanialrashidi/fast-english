// app/src/features/lessons/api.test.ts
// Focused tests for the lesson API client. The PB SDK is mocked so we
// can assert the resolved URLs (absolute, SDK-origin based) without
// requiring a live PB instance. This guards the native-build invariant:
// on Android release there is no shared browser origin, so root-relative
// `/api/...` paths must never reach fetch / <audio> unresolved.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface PbMockShape {
  send: ReturnType<typeof vi.fn>;
  files: {
    getToken: ReturnType<typeof vi.fn>;
  };
  buildURL: ReturnType<typeof vi.fn>;
}

const pbMock: PbMockShape = {
  send: vi.fn(),
  files: {
    getToken: vi.fn(),
  },
  buildURL: vi.fn(),
};

vi.mock('../../lib/pocketbase', () => ({
  getPocketBase: () => pbMock,
}));

import { buildProtectedAudioUrl, getPublicSample, resolveMediaUrl } from './api';

const MOCK_BASE = 'http://test.local';

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  pbMock.send.mockReset();
  pbMock.files.getToken.mockReset();
  pbMock.buildURL.mockReset();
  pbMock.buildURL.mockImplementation((path: string) => `${MOCK_BASE}${path}`);
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOk(body: unknown): void {
  fetchSpy.mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('getPublicSample', () => {
  it('fetches an absolute URL resolved through pb.buildURL', async () => {
    mockFetchOk({ kind: 'sample_ready', lesson: {} });
    await getPublicSample();
    expect(pbMock.buildURL).toHaveBeenCalledWith('/api/fast-english/public/sample');
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected a fetch call');
    expect(call[0]).toBe(`${MOCK_BASE}/api/fast-english/public/sample`);
  });

  it('keeps the accept: application/json header', async () => {
    mockFetchOk({ kind: 'sample_ready', lesson: {} });
    await getPublicSample();
    const call = fetchSpy.mock.calls[0];
    if (!call) throw new Error('expected a fetch call');
    const [, opts] = call;
    expect(opts?.headers).toMatchObject({ accept: 'application/json' });
  });

  it('throws on a non-ok response (maps to the existing error phase)', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('boom', { status: 500, headers: { 'Content-Type': 'text/plain' } }),
    );
    await expect(getPublicSample()).rejects.toThrow();
  });
});

describe('buildProtectedAudioUrl', () => {
  it('returns an absolute URL resolved through the mock base', async () => {
    pbMock.files.getToken.mockResolvedValueOnce('tok-1');
    const url = await buildProtectedAudioUrl('/api/fast-english/lessons/l1/audio');
    expect(url.startsWith(MOCK_BASE)).toBe(true);
    expect(url).toBe(`${MOCK_BASE}/api/fast-english/lessons/l1/audio?token=tok-1`);
  });

  it('contains the file token from pb.files.getToken', async () => {
    pbMock.files.getToken.mockResolvedValueOnce('tok-secret');
    const url = await buildProtectedAudioUrl('/api/fast-english/lessons/l1/audio');
    expect(url).toContain('token=tok-secret');
    expect(pbMock.files.getToken).toHaveBeenCalledTimes(1);
  });

  it('round-trips a token containing reserved characters', async () => {
    const trickyToken = 'a+b&c=d/e?x#y';
    pbMock.files.getToken.mockResolvedValueOnce(trickyToken);
    const url = await buildProtectedAudioUrl('/api/fast-english/lessons/l1/audio');
    expect(new URL(url).searchParams.get('token')).toBe(trickyToken);
  });

  it('produces exactly one ? when the input has no query string', async () => {
    pbMock.files.getToken.mockResolvedValueOnce('tok-1');
    const url = await buildProtectedAudioUrl('/api/fast-english/lessons/l1/audio');
    // One ? and only the token param — no `?token=...?` concatenation bug.
    expect(url.split('?')).toHaveLength(2);
    expect(url.split('?')[1]).toBe('token=tok-1');
  });

  it('preserves an existing query string when one exists', async () => {
    pbMock.files.getToken.mockResolvedValueOnce('tok-1');
    const url = await buildProtectedAudioUrl('/api/fast-english/lessons/l1/audio?v=2');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('v')).toBe('2');
    expect(parsed.searchParams.get('token')).toBe('tok-1');
  });
});

describe('resolveMediaUrl', () => {
  it('resolves the public sample audio path through pb.buildURL without minting a token', () => {
    const url = resolveMediaUrl('/api/fast-english/public/sample/audio');
    expect(url).toBe(`${MOCK_BASE}/api/fast-english/public/sample/audio`);
    expect(pbMock.buildURL).toHaveBeenCalledWith('/api/fast-english/public/sample/audio');
    expect(pbMock.files.getToken).not.toHaveBeenCalled();
  });
});
