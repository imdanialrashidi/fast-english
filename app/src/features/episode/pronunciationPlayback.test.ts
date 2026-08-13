// app/src/features/episode/pronunciationPlayback.test.ts
// Slice 7 — word-scoped pronunciation playback ordering guarantees.
//
// The smallest faithful layer for the accepted pronunciation contract:
// a controllable fake audio host + a manual URL resolver prove that
//   - natural clip completion returns the surface to idle;
//   - media failures stay retryable (never stuck, never unavailable);
//   - an older in-flight URL resolution can never take over playback
//     after the student selected another word (or stopped).

import { describe, expect, it } from 'vitest';
import { createPronunciationPlayback, type PronunciationAudioHost } from './pronunciationPlayback';

interface FakeHost extends PronunciationAudioHost {
  playCalls: number;
  srcHistory: Array<string | null>;
}

function fakeHost(): FakeHost {
  const host: FakeHost = {
    src: null,
    playCalls: 0,
    srcHistory: [],
    onended: null,
    onerror: null,
    async play() {
      this.playCalls += 1;
    },
    pause() {},
    removeAttribute(name: string) {
      if (name === 'src') this.src = null;
    },
  };
  return host;
}

function recordEvents() {
  const events: string[] = [];
  return {
    events,
    handlers: {
      onPlaying: (id: string) => events.push(`playing:${id}`),
      onIdle: () => events.push('idle'),
      onRetryable: (id: string) => events.push(`retryable:${id}`),
    },
  };
}

describe('pronunciation playback session', () => {
  it('natural clip completion returns the surface to idle', async () => {
    const host = fakeHost();
    const { events, handlers } = recordEvents();
    const session = createPronunciationPlayback(host, handlers);

    session.start('a');
    await session.applyUrl(session.requestToken, 'a', 'url-a');
    expect(events).toEqual(['playing:a']);

    // The clip reaches its end naturally — the control must go idle.
    host.onended?.(new Event('ended'));
    expect(events).toEqual(['playing:a', 'idle']);
    expect(host.onended).not.toBeNull();
  });

  it('media error during playback is retryable, not unavailable', async () => {
    const host = fakeHost();
    const { events, handlers } = recordEvents();
    const session = createPronunciationPlayback(host, handlers);

    session.start('a');
    await session.applyUrl(session.requestToken, 'a', 'url-a');
    host.onerror?.(new Event('error'));
    expect(events).toEqual(['playing:a', 'retryable:a']);
  });

  it('a play() rejection is retryable', async () => {
    const host = fakeHost();
    const { events, handlers } = recordEvents();
    const session = createPronunciationPlayback(host, handlers);
    host.play = async () => {
      throw new Error('media unreachable');
    };

    session.start('a');
    await session.applyUrl(session.requestToken, 'a', 'url-a');
    expect(events).toEqual(['retryable:a']);
  });

  it('an older in-flight URL resolution cannot take over playback (race)', async () => {
    const host = fakeHost();
    const { events, handlers } = recordEvents();
    const session = createPronunciationPlayback(host, handlers);

    // Word A starts its URL build (slow); the student selects word B.
    session.start('a');
    const tokenA = session.requestToken;
    session.start('b');
    const tokenB = session.requestToken;

    // B resolves first and starts playing.
    await session.applyUrl(tokenB, 'b', 'url-b');
    expect(events).toEqual(['playing:b']);
    expect(host.src).toBe('url-b');

    // A's delayed URL resolves later — it must be a no-op: the host is
    // never pointed at A, A never plays, no event fires for A.
    await session.applyUrl(tokenA, 'a', 'url-a');
    expect(events).toEqual(['playing:b']);
    expect(host.src).toBe('url-b');
    expect(host.playCalls).toBe(1);

    // Handlers are per-word: the host now only knows B's request, so an
    // A-flavoured event is structurally impossible (the ended/error
    // closures carry B's word and B's token).
    host.onended?.(new Event('ended'));
    expect(events).toEqual(['playing:b', 'idle']);
  });

  it('stop() invalidates in-flight resolutions and silences the host', async () => {
    const host = fakeHost();
    const { events, handlers } = recordEvents();
    const session = createPronunciationPlayback(host, handlers);

    session.start('a');
    const tokenA = session.requestToken;
    session.stop();

    await session.applyUrl(tokenA, 'a', 'url-a');
    expect(host.src).toBeNull();
    expect(host.playCalls).toBe(0);
    expect(events).toEqual([]);
    expect(host.onended).toBeNull();
    expect(host.onerror).toBeNull();
  });

  it('a stale URL-build failure never marks a newer word retryable', () => {
    const host = fakeHost();
    const { events, handlers } = recordEvents();
    const session = createPronunciationPlayback(host, handlers);

    session.start('a');
    const tokenA = session.requestToken;
    session.start('b');
    const tokenB = session.requestToken;

    session.handleBuildFailure(tokenA, 'a');
    expect(events).toEqual([]);
    session.handleBuildFailure(tokenB, 'b');
    expect(events).toEqual(['retryable:b']);
  });
});
