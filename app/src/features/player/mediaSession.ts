// app/src/features/player/mediaSession.ts
// Slice 8 — Media Session integration as progressive enhancement.
//
// The OS/browser media surface (lock screen, hardware keys, media
// notifications) mirrors the SINGLE authoritative PlayerProvider session:
//   - metadata (title, artist, artwork) is derived from the active
//     Variant session and cleared when playback stops or is invalid;
//   - playbackState and positionState track the real element;
//   - action handlers are pure closures over the player controller
//     (unit-tested with a fake controller), registered per action with
//     per-action capability capture — an unsupported action on one
//     platform never breaks the others and never breaks in-app playback;
//   - pronunciation playback never touches this module: the Episode's
//     pause flips playbackState to 'paused', which is the honest
//     exclusive state while a pronunciation clip plays.
//
// The repo has no DOM renderer; the host interface + closures keep every
// meaningful decision unit-testable. The provider constructs real
// `MediaMetadata` instances from `buildMediaMetadataPayload`.

/** The podcast identity shown as the artist on OS media surfaces. */
export const MEDIA_SESSION_ARTIST = 'Fast English Podcast';

/**
 * The minimal Media Session surface the player needs. `navigator.mediaSession`
 * satisfies this structurally; tests provide a fake host.
 */
export interface MediaSessionHost {
  metadata: MediaMetadata | null;
  playbackState: MediaSessionPlaybackState;
  setPositionState(state?: MediaPositionState): void;
  setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null): void;
}

/** Structural session subset needed for metadata (avoids React imports). */
export interface MediaSessionSource {
  title: string;
  artwork?: string | null;
}

/** True when the current runtime exposes Media Session (progressive enhancement). */
export function isMediaSessionSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
}

export function getMediaSessionHost(): MediaSessionHost | null {
  if (!isMediaSessionSupported()) return null;
  return navigator.mediaSession as MediaSessionHost;
}

/**
 * Build the `MediaMetadataInit` payload for the active Variant. Artwork is
 * the resolved Episode artwork URL (public, cacheable proxy path — the
 * accepted artwork policy); it is included only when present so a
 * missing artwork never poisons the metadata.
 */
export function buildMediaMetadataPayload(session: MediaSessionSource): MediaMetadataInit {
  const artwork = session.artwork ? [{ src: session.artwork }] : undefined;
  return {
    title: session.title,
    artist: MEDIA_SESSION_ARTIST,
    artwork,
  };
}

/**
 * Clear every piece of Media Session state: stale metadata is removed and
 * the playback state returns to 'none' so OS surfaces stop advertising a
 * track that is no longer valid. `setPositionState()` without an argument
 * resets the position state per spec; older engines throw — ignored.
 */
export function clearMediaSession(host: MediaSessionHost): void {
  host.metadata = null;
  host.playbackState = 'none';
  try {
    host.setPositionState();
  } catch {
    // Older engines do not accept the no-argument reset — position state
    // will simply be replaced on the next valid playback.
  }
}

/** Controller surface the Media Session actions drive (the PlayerProvider). */
export interface MediaSessionController {
  /** Start playback when paused (no-op otherwise). */
  resume(): void;
  /** Pause playback (no-op when already paused). */
  pause(): void;
  /** Seek by a signed delta in seconds (clamped to the track). */
  skipBy(deltaSeconds: number): void;
  /** Seek to an absolute position in seconds. */
  seekTo(seconds: number): void;
  /** Stop the session: save the practical position and clear the player. */
  stop(): void;
}

/**
 * Build the action handlers for the current platform. `seekbackward` /
 * `seekforward` honor the OS-provided offset and fall back to the ±10s
 * product skip (same step as the Deck controls). `seekto` uses the
 * OS-provided absolute target. Every handler routes to the SAME
 * authoritative controller, so external controls obey the existing
 * Progress semantics (seek → onSeek save; pause → onPause save).
 */
export function createMediaSessionHandlers(
  controller: MediaSessionController,
): Partial<Record<MediaSessionAction, MediaSessionActionHandler>> {
  return {
    play: () => controller.resume(),
    pause: () => controller.pause(),
    seekbackward: (details) => controller.skipBy(-(details.seekOffset ?? 10)),
    seekforward: (details) => controller.skipBy(details.seekOffset ?? 10),
    seekto: (details) => controller.seekTo(details.seekTime ?? 0),
    stop: () => controller.stop(),
  };
}

/**
 * Register handlers one action at a time, capturing per-action capability:
 * a platform that rejects one action (e.g. `seekto` on an older engine)
 * keeps every other action working. Returns the actions actually
 * registered. Unsupported Media Session as a whole is handled by callers
 * (host null → nothing registered, in-app playback unaffected).
 */
export function registerMediaSessionActions(
  host: MediaSessionHost,
  handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>>,
): MediaSessionAction[] {
  const supported: MediaSessionAction[] = [];
  for (const action of Object.keys(handlers) as MediaSessionAction[]) {
    try {
      host.setActionHandler(action, handlers[action] ?? null);
      supported.push(action);
    } catch {
      // Action unsupported on this platform — keep the rest.
    }
  }
  return supported;
}
