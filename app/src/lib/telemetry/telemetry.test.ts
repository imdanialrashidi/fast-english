// app/src/lib/telemetry/telemetry.test.ts
// Privacy + failure-isolation contract for the telemetry boundary.
//
// These tests mechanically enforce the two non-negotiable properties of
// the observability foundation:
//   1. no sensitive data may ever leave through a telemetry event
//      (tokens, phones, names, receipt/media URLs, raw payloads);
//   2. observability failures never break the Student experience
//      (no throw from any public entry point; broken sinks isolated).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyMediaError, shouldFireMilestone } from './events';
import {
  _resetTelemetryForTests,
  _setSinksForTests,
  getDiagnosticSnapshot,
  reportApiFailure,
  reportError,
  reportPlayerFailure,
  setSurface,
  track,
} from './index';
import { redactPath, sanitizeMessage } from './redact';
import { BeaconSink, ConsoleSink, RingBufferSink, type TelemetrySink } from './sinks';

afterEach(() => {
  _resetTelemetryForTests();
  vi.restoreAllMocks();
});

describe('redactPath', () => {
  it('replaces record-id-looking segments with :id', () => {
    expect(redactPath('/api/fast-english/lessons/abc123def456ghi/progress')).toBe(
      '/api/fast-english/lessons/:id/progress',
    );
  });

  it('strips query strings entirely (tokens live there)', () => {
    expect(redactPath('/api/fast-english/lessons/abc123def456ghi?token=SECRET&page=1')).toBe(
      '/api/fast-english/lessons/:id',
    );
  });

  it('keeps static route segments verbatim', () => {
    expect(redactPath('/api/fast-english/lessons')).toBe('/api/fast-english/lessons');
    expect(redactPath('/api/fast-english/placement/attempts/start')).toBe(
      '/api/fast-english/placement/attempts/start',
    );
    expect(redactPath('/library')).toBe('/library');
    expect(redactPath('/lessons/demo')).toBe('/lessons/demo');
  });
});

describe('sanitizeMessage', () => {
  it('redacts query token values', () => {
    expect(sanitizeMessage('failed to load ?token=abc123XYZ')).not.toMatch(/abc123XYZ/);
  });

  it('redacts bare token= values in free text (no query markers)', () => {
    const out = sanitizeMessage('boom token=SUPERSECRET and phone 09123456789');
    expect(out).not.toContain('SUPERSECRET');
    expect(out).not.toContain('09123456789');
    expect(out).toContain('token=[REDACTED]');
  });

  it('redacts JWT blobs', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const out = sanitizeMessage(`boom ${jwt} end`);
    expect(out).not.toContain(jwt);
    expect(out).toContain('REDACTED');
  });

  it('redacts long random-looking strings (file tokens / nonces)', () => {
    const token = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
    expect(sanitizeMessage(`url=${token}`)).not.toContain(token);
  });

  it('redacts Iranian mobile numbers and emails (personal data)', () => {
    const out = sanitizeMessage('call 09123456789 or +989123456789 or a@b.example.com now');
    expect(out).not.toMatch(/09123456789|989123456789/);
    expect(out).not.toContain('a@b.example.com');
    expect(out).toContain('[REDACTED_PHONE]');
    expect(out).toContain('[REDACTED_EMAIL]');
  });

  it('keeps Persian-digit phone examples in copy untouched', () => {
    const out = sanitizeMessage('مثلاً ۰۹۱۲۳۴۵۶۷۸۹');
    expect(out).toContain('۰۹۱۲۳۴۵۶۷۸۹');
  });
});

describe('RingBufferSink', () => {
  it('is bounded and returns a copy', () => {
    const sink = new RingBufferSink(3);
    for (let i = 0; i < 5; i++) sink.emit(eventWithName(`e${i}`));
    const snap = sink.snapshot();
    expect(snap.map((e) => e.name)).toEqual(['e2', 'e3', 'e4']);
    snap.push(eventWithName('mutated'));
    expect(sink.snapshot()).toHaveLength(3);
  });
});

describe('BeaconSink', () => {
  it('batches and flushes via sendBeacon; failures are swallowed', async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon });
    const sink = new BeaconSink('https://example.invalid/ingest', {
      flushIntervalMs: 60_000,
    });
    sink.emit(eventWithName('a'));
    sink.emit(eventWithName('b'));
    expect(sink.pendingCount()).toBe(2);
    sink.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const payload = await ((sendBeacon.mock.calls[0] as unknown[])[1] as Blob).text();
    const parsed = JSON.parse(payload) as Array<{ name: string }>;
    expect(parsed.map((e) => e.name)).toEqual(['a', 'b']);

    // sendBeacon throwing must not propagate.
    vi.stubGlobal('navigator', {
      sendBeacon: () => {
        throw new Error('boom');
      },
    });
    sink.emit(eventWithName('c'));
    expect(() => sink.flush()).not.toThrow();
    sink.dispose();
  });
});

describe('ConsoleSink', () => {
  it('is a no-op when disabled', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    new ConsoleSink(false).emit(eventWithName('x'));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('facade', () => {
  it('never throws when a sink throws; other sinks still receive the event', () => {
    const good = new RingBufferSink(10);
    const broken: TelemetrySink = {
      name: 'broken',
      emit: () => {
        throw new Error('broken sink');
      },
    };
    _setSinksForTests([good, broken]);
    expect(() => track('x', 'info', {})).not.toThrow();
    expect(good.snapshot().some((e) => e.name === 'x')).toBe(true);
  });

  it('reportError sanitizes free text and stays bounded', () => {
    expect(() =>
      reportError(new Error('boom token=SUPERSECRET'), { kind: 'uncaught' }),
    ).not.toThrow();
  });

  it('reportApiFailure never includes the query string', () => {
    expect(() =>
      reportApiFailure(
        '/api/fast-english/lessons/abc123def456ghi?token=SECRET',
        'GET',
        500,
        'http',
      ),
    ).not.toThrow();
  });

  it('reportPlayerFailure only carries lessonId + classified code', () => {
    expect(() => reportPlayerFailure('lesson-1', 'media_err_network')).not.toThrow();
  });

  it('setSurface redacts ids', () => {
    expect(() => setSurface('/lessons/abc123def456ghi')).not.toThrow();
    expect(getDiagnosticSnapshot().appVersion).toBeTypeOf('string');
  });
});

describe('shouldFireMilestone', () => {
  it('fires once at the 50% crossing', () => {
    expect(shouldFireMilestone(50, 100, false)).toBe('50');
    expect(shouldFireMilestone(49.9, 100, false)).toBeNull();
    expect(shouldFireMilestone(50, 100, true)).toBeNull();
  });

  it('never fires for unknown durations or negative positions', () => {
    expect(shouldFireMilestone(10, 0, false)).toBeNull();
    expect(shouldFireMilestone(10, Number.NaN, false)).toBeNull();
    expect(shouldFireMilestone(-1, 100, false)).toBeNull();
  });
});

describe('classifyMediaError', () => {
  it('maps MediaError codes to stable kinds', () => {
    expect(classifyMediaError(1)).toBe('media_err_aborted');
    expect(classifyMediaError(2)).toBe('media_err_network');
    expect(classifyMediaError(3)).toBe('media_err_decode');
    expect(classifyMediaError(4)).toBe('media_err_src_not_supported');
    expect(classifyMediaError(undefined)).toBe('media_err_unknown');
    expect(classifyMediaError(99)).toBe('media_err_unknown');
  });
});

function eventWithName(name: string) {
  return {
    name,
    level: 'info' as const,
    ts: 0,
    surface: '',
    appVersion: 'test',
    buildTime: '',
    fields: {},
  };
}
