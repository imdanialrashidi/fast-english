// app/src/lib/pocketbase.telemetry.test.ts
// The send() instrumentation boundary: only server-side/transport failures
// are reported (5xx, 429, network-level), paths are redacted, 4xx business
// errors stay silent, and the identical error object is rethrown (the
// progress-save 409 path depends on that).

import PocketBase from 'pocketbase';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { instrumentSend } from './pocketbase';
import { _resetTelemetryForTests, _setSinksForTests } from './telemetry';
import { RingBufferSink } from './telemetry/sinks';

function clientWithFailingSend(failure: unknown) {
  const client = new PocketBase('http://127.0.0.1:1');
  const sendMock = vi.fn().mockImplementation(() => Promise.reject(failure));
  client.send = sendMock as typeof client.send;
  return { client: instrumentSend(client), sendMock };
}

afterEach(() => {
  _resetTelemetryForTests();
  vi.restoreAllMocks();
});

describe('instrumentSend', () => {
  it('reports 5xx failures with a redacted path and rethrows the same error', async () => {
    const ring = new RingBufferSink(20);
    _setSinksForTests([ring]);
    const err = Object.assign(new Error('boom'), { status: 500 });
    const { client, sendMock } = clientWithFailingSend(err);
    await expect(
      client.send('/api/fast-english/lessons/abc123def456ghi/progress', { method: 'GET' }),
    ).rejects.toBe(err);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const apiFailures = ring.snapshot().filter((e) => e.name === 'api_failure');
    expect(apiFailures).toHaveLength(1);
    expect(apiFailures[0].fields).toMatchObject({
      path: '/api/fast-english/lessons/:id/progress',
      method: 'GET',
      status: 500,
      kind: 'http',
    });
  });

  it('reports 429 rate-limit failures', async () => {
    const ring = new RingBufferSink(20);
    _setSinksForTests([ring]);
    const err = Object.assign(new Error('limited'), { status: 429 });
    const { client } = clientWithFailingSend(err);
    await expect(client.send('/api/fast-english/lessons', { method: 'GET' })).rejects.toBe(err);
    expect(ring.snapshot().filter((e) => e.name === 'api_failure')).toHaveLength(1);
  });

  it('does NOT report 4xx business errors (they are user-facing)', async () => {
    const ring = new RingBufferSink(20);
    _setSinksForTests([ring]);
    for (const status of [400, 401, 403, 409, 422]) {
      const err = Object.assign(new Error(`e${status}`), { status });
      const { client } = clientWithFailingSend(err);
      await expect(
        client.send('/api/fast-english/lessons/x/progress', { method: 'GET' }),
      ).rejects.toBe(err);
    }
    expect(ring.snapshot().filter((e) => e.name === 'api_failure')).toHaveLength(0);
  });

  it('reports transport-level failures as network kind and strips query tokens', async () => {
    const ring = new RingBufferSink(20);
    _setSinksForTests([ring]);
    const err = Object.assign(new Error('Failed to fetch'), {
      originalError: new TypeError('Failed to fetch'),
    });
    const { client } = clientWithFailingSend(err);
    await expect(
      client.send('/api/fast-english/lessons/abc123def456ghi?token=SECRET', { method: 'GET' }),
    ).rejects.toBe(err);
    const apiFailures = ring.snapshot().filter((e) => e.name === 'api_failure');
    expect(apiFailures).toHaveLength(1);
    expect(apiFailures[0].fields).toMatchObject({ kind: 'network', status: 0 });
    expect(String(apiFailures[0].fields.path)).not.toContain('SECRET');
  });

  it('never throws from the instrumentation itself on success paths', async () => {
    const ring = new RingBufferSink(20);
    _setSinksForTests([ring]);
    const client = new PocketBase('http://127.0.0.1:1');
    client.send = (() => Promise.resolve({ ok: true })) as typeof client.send;
    const wrapped = instrumentSend(client);
    await expect(wrapped.send('/api/health', { method: 'GET' })).resolves.toEqual({ ok: true });
    expect(ring.snapshot().filter((e) => e.name === 'api_failure')).toHaveLength(0);
  });
});
