// app/src/features/player/mediaSession.test.ts
// Slice 8 — Media Session adapter contracts with a fake host:
//   - metadata payloads derive from the active Variant session only
//     (title/artist/artwork; no stale fields when artwork is absent);
//   - clearing removes metadata, playbackState and position state;
//   - action handlers route to the SAME authoritative controller and obey
//     the product skip/seek semantics;
//   - per-action capability capture keeps unsupported actions from
//     breaking the rest; an absent host degrades to no-ops.

import { describe, expect, it, vi } from 'vitest';
import {
  buildMediaMetadataPayload,
  clearMediaSession,
  createMediaSessionHandlers,
  getMediaSessionHost,
  MEDIA_SESSION_ARTIST,
  type MediaSessionHost,
  registerMediaSessionActions,
} from './mediaSession';

function createFakeHost(): MediaSessionHost & {
  metadata: MediaMetadata | null;
  positions: (MediaPositionState | undefined)[];
  actions: { action: string; handler: MediaSessionActionHandler | null }[];
  throwOn: Set<string>;
} {
  const host = {
    metadata: null as MediaMetadata | null,
    playbackState: 'none' as MediaSessionPlaybackState,
    positions: [] as (MediaPositionState | undefined)[],
    actions: [] as { action: string; handler: MediaSessionActionHandler | null }[],
    throwOn: new Set<string>(),
    setPositionState(state?: MediaPositionState) {
      host.positions.push(state);
    },
    setActionHandler(action: string, handler: MediaSessionActionHandler | null) {
      if (host.throwOn.has(action)) throw new Error(`unsupported action: ${action}`);
      host.actions.push({ action, handler });
    },
  };
  return host;
}

function createFakeController() {
  const calls: string[] = [];
  return {
    calls,
    resume: () => calls.push('resume'),
    pause: () => calls.push('pause'),
    skipBy: (d: number) => calls.push(`skipBy:${d}`),
    seekTo: (s: number) => calls.push(`seekTo:${s}`),
    stop: () => calls.push('stop'),
  };
}

describe('buildMediaMetadataPayload', () => {
  it('derives title/artist and the resolved artwork from the session', () => {
    const payload = buildMediaMetadataPayload({
      title: 'اپیزود آزمایشی',
      artwork: 'https://app.example/api/fast-english/artwork/abc',
    });
    expect(payload.title).toBe('اپیزود آزمایشی');
    expect(payload.artist).toBe(MEDIA_SESSION_ARTIST);
    expect(payload.artwork).toEqual([{ src: 'https://app.example/api/fast-english/artwork/abc' }]);
  });

  it('omits artwork when the Variant has none (never a broken image URL)', () => {
    const payload = buildMediaMetadataPayload({ title: 'بدون تصویر' });
    expect(payload.artwork).toBeUndefined();
    expect(buildMediaMetadataPayload({ title: 'x', artwork: null }).artwork).toBeUndefined();
    expect(buildMediaMetadataPayload({ title: 'x', artwork: '' }).artwork).toBeUndefined();
  });
});

describe('clearMediaSession', () => {
  it('removes metadata, resets playback state and clears the position state', () => {
    const host = createFakeHost();
    host.metadata = {} as MediaMetadata;
    host.playbackState = 'playing';
    clearMediaSession(host);
    expect(host.metadata).toBeNull();
    expect(host.playbackState).toBe('none');
    expect(host.positions).toEqual([undefined]);
  });

  it('still clears everything when the engine rejects the position reset', () => {
    const host = createFakeHost();
    host.metadata = {} as MediaMetadata;
    host.playbackState = 'playing';
    host.setPositionState = () => {
      throw new Error('no-arg reset unsupported');
    };
    clearMediaSession(host);
    expect(host.metadata).toBeNull();
    expect(host.playbackState).toBe('none');
  });
});

describe('createMediaSessionHandlers', () => {
  it('routes play/pause to the same controller', () => {
    const controller = createFakeController();
    const handlers = createMediaSessionHandlers(controller);
    handlers.play?.({} as MediaSessionActionDetails);
    handlers.pause?.({} as MediaSessionActionDetails);
    expect(controller.calls).toEqual(['resume', 'pause']);
  });

  it('skips the product ±10s when the OS supplies a seek offset', () => {
    const controller = createFakeController();
    const handlers = createMediaSessionHandlers(controller);
    handlers.seekbackward?.({ seekOffset: 30 } as MediaSessionActionDetails);
    handlers.seekforward?.({ seekOffset: 15 } as MediaSessionActionDetails);
    expect(controller.calls).toEqual(['skipBy:-30', 'skipBy:15']);
  });

  it('falls back to ±10s when no offset is provided', () => {
    const controller = createFakeController();
    const handlers = createMediaSessionHandlers(controller);
    handlers.seekbackward?.({} as MediaSessionActionDetails);
    handlers.seekforward?.({} as MediaSessionActionDetails);
    expect(controller.calls).toEqual(['skipBy:-10', 'skipBy:10']);
  });

  it('seeks to the OS-provided absolute target (obeying onSeek semantics)', () => {
    const controller = createFakeController();
    const handlers = createMediaSessionHandlers(controller);
    handlers.seekto?.({ seekTime: 42 } as MediaSessionActionDetails);
    expect(controller.calls).toEqual(['seekTo:42']);
  });

  it('stops the authoritative session on the stop action', () => {
    const controller = createFakeController();
    const handlers = createMediaSessionHandlers(controller);
    handlers.stop?.({} as MediaSessionActionDetails);
    expect(controller.calls).toEqual(['stop']);
  });
});

describe('registerMediaSessionActions', () => {
  it('registers every supported action and reports them', () => {
    const host = createFakeHost();
    const controller = createFakeController();
    const handlers = createMediaSessionHandlers(controller);
    const supported = registerMediaSessionActions(host, handlers);
    expect(supported).toEqual(['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'stop']);
    expect(host.actions.map((a) => a.action)).toEqual(supported);
  });

  it('captures capability per action: one unsupported action never breaks the rest', () => {
    const host = createFakeHost();
    host.throwOn.add('seekto');
    const controller = createFakeController();
    const supported = registerMediaSessionActions(host, createMediaSessionHandlers(controller));
    expect(supported).toEqual(['play', 'pause', 'seekbackward', 'seekforward', 'stop']);
    expect(host.actions.some((a) => a.action === 'seekto')).toBe(false);
  });

  it('registered handlers exercise the real closures against the controller', () => {
    const host = createFakeHost();
    const controller = createFakeController();
    registerMediaSessionActions(host, createMediaSessionHandlers(controller));
    const byAction = new Map(host.actions.map((a) => [a.action, a.handler]));
    byAction.get('play')?.({} as MediaSessionActionDetails);
    byAction.get('seekto')?.({ seekTime: 7 } as MediaSessionActionDetails);
    byAction.get('stop')?.({} as MediaSessionActionDetails);
    expect(controller.calls).toEqual(['resume', 'seekTo:7', 'stop']);
  });
});

describe('getMediaSessionHost', () => {
  it('returns null where Media Session is unavailable (progressive enhancement)', () => {
    // Vitest runs in Node: no navigator.mediaSession — the host must be
    // null so the provider's integration degrades to no-ops.
    expect(getMediaSessionHost()).toBeNull();
  });

  it('returns the navigator surface when present', () => {
    const fake = { mediaSession: { metadata: null } };
    vi.stubGlobal('navigator', fake);
    try {
      expect(getMediaSessionHost()).toBe(fake.mediaSession);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
