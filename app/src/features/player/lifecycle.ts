// app/src/features/player/lifecycle.ts
// Slice 8 — pure player-lifecycle derivations (no React, no DOM).
//
// Everything here is deterministic and unit-tested; PlayerProvider stays a
// thin adapter (repo pattern: useProgressSave queue helpers,
// pronunciationPlayback). These functions own the reliability contracts:
//   - bind transitions: a same-Variant source refresh (token rebuild,
//     retry) is a SOFT refresh that preserves the practical position,
//     session identity and playback preferences — only a genuinely new
//     lesson resets the session;
//   - the retry-restore guard: after a recoverable failure the practical
//     position wins over an older saved resume point, while explicit
//     user intent (restart at 0, forward seek) is always honored;
//   - user seeks supersede any pending restore (a scrub is intent);
//   - visibility reconciliation maps real element state into player
//     state and never invents values (no fabricated Progress).

// ---------------------------------------------------------------------------
// Bind transitions
// ---------------------------------------------------------------------------

export interface BindTransitionInput {
  sessionLessonId: string;
  src: string;
}

export type BindTransition = 'fresh' | 'same' | 'soft-refresh';

/**
 * Classify a bind() call against the current player state:
 *   - 'fresh':        no session or a different lesson — full reset;
 *   - 'same':         identical lesson AND source — callbacks refresh only;
 *   - 'soft-refresh': same lesson, NEW source (token rebuild / retry) —
 *                     keep session, practical position and preferences.
 */
export function resolveBindTransition(
  prevSessionLessonId: string | null,
  prevSrc: string | null,
  next: BindTransitionInput,
): BindTransition {
  if (prevSessionLessonId === null || prevSessionLessonId !== next.sessionLessonId) {
    return 'fresh';
  }
  return prevSrc === next.src ? 'same' : 'soft-refresh';
}

/** True when a practical position is worth restoring after a source refresh. */
export function isRestorablePosition(position: number): boolean {
  return Number.isFinite(position) && position > 0.5;
}

// ---------------------------------------------------------------------------
// Retry-restore guard (resume decisions)
// ---------------------------------------------------------------------------

export type ResumeDecision = { kind: 'apply'; target: number } | { kind: 'ignore' };

/**
 * Decide what `applyInitialPosition` may do while a retry restore is armed.
 * The retry restore holds the PRACTICAL position (where playback actually
 * stopped when the source failed); an older saved resume point must not
 * regress it. Explicit user intent always wins:
 *   - seconds <= 0 → honor the restart-from-zero intent;
 *   - seconds >= restore target → the user's resume point is at least as
 *     far as the practical position — honor it;
 *   - otherwise → ignore (keep the practical restore; it lands when
 *     metadata arrives).
 */
export function decideResumeTarget(retryRestore: number | null, seconds: number): ResumeDecision {
  if (retryRestore === null) {
    return { kind: 'apply', target: Math.max(0, seconds) };
  }
  if (seconds <= 0) {
    return { kind: 'apply', target: 0 };
  }
  if (seconds >= retryRestore) {
    return { kind: 'apply', target: seconds };
  }
  return { kind: 'ignore' };
}

export interface UserSeekDecision {
  /** Pending seek to arm (applied when metadata arrives); null = none. */
  pendingSeek: number | null;
  /** Retry-restore target after the user's seek (a scrub is intent). */
  retryRestore: number | null;
  /** Whether the seek can be applied to the element immediately. */
  applyToElement: boolean;
}

/**
 * A user seek (timeline scrub or ±10s skip) always supersedes a pending
 * retry restore — the student's explicit intent is the truth. When the
 * element has a known duration the seek applies immediately; otherwise it
 * becomes the pending position applied once metadata loads.
 */
export function resolveUserSeek(opts: {
  pendingSeek: number | null;
  retryRestore: number | null;
  durationKnown: boolean;
  target: number;
}): UserSeekDecision {
  if (opts.durationKnown) {
    return { pendingSeek: null, retryRestore: null, applyToElement: true };
  }
  return { pendingSeek: opts.target, retryRestore: null, applyToElement: false };
}

// ---------------------------------------------------------------------------
// Visibility reconciliation
// ---------------------------------------------------------------------------

export interface ElementSnapshot {
  paused: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
}

export interface ReconcilePrev {
  isPlaying: boolean;
  /** True while a pending seek is armed (element position is transient). */
  pendingSeekArmed: boolean;
}

export interface ReconcileResult {
  /** State patch to apply (fields present = changed). */
  patch: Partial<{ isPlaying: boolean; currentTime: number; duration: number }>;
}

/**
 * Map real element state into player state after a background/foreground
 * transition. Rules:
 *   - never invents values: every output field is read from the element;
 *   - while a pending seek is armed the element position is transient
 *     (a source refresh is in flight) — position/duration are NOT trusted;
 *   - the play/pause flag always mirrors the element's real state;
 *   - this function deliberately does NOT emit a progress save: the
 *     element's own `pause` event (dispatched when the platform paused
 *     playback, delivered on resume) is the single writer of pause saves,
 *     so a reconcile can never double-write Progress.
 */
export function reconcileSnapshot(snapshot: ElementSnapshot, prev: ReconcilePrev): ReconcileResult {
  const patch: ReconcileResult['patch'] = {};

  const playing = !snapshot.paused && !snapshot.ended;
  if (playing !== prev.isPlaying) {
    patch.isPlaying = playing;
  }

  if (!prev.pendingSeekArmed) {
    if (Number.isFinite(snapshot.currentTime) && snapshot.currentTime >= 0) {
      patch.currentTime = snapshot.currentTime;
    }
    if (Number.isFinite(snapshot.duration) && snapshot.duration > 0) {
      patch.duration = snapshot.duration;
    }
  }

  return { patch };
}

// ---------------------------------------------------------------------------
// Media Session position helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a playback position into [0, duration] for Media Session
 * positionState (the OS lock screen must never see a position beyond the
 * track or a negative value).
 */
export function clampPosition(position: number, duration: number): number {
  if (!Number.isFinite(position) || position < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(position, duration);
}
