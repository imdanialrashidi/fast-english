// app/src/features/player/lifecycle.test.ts
// Slice 8 — the reliability contracts of the shared player lifecycle:
//   - bind transitions (fresh / same / soft-refresh) never lose the
//     practical position on a same-Variant source refresh;
//   - the retry-restore guard never lets an older saved resume point
//     regress the practical position, while explicit user intent
//     (restart at 0, forward seeks) always wins;
//   - user seeks supersede pending restores;
//   - visibility reconciliation only ever maps real element state
//     (no fabricated progress writes; no double pause-save signal).

import { describe, expect, it } from 'vitest';
import {
  clampPosition,
  decideResumeTarget,
  isRestorablePosition,
  reconcileSnapshot,
  resolveBindTransition,
  resolveUserSeek,
} from './lifecycle';

describe('resolveBindTransition', () => {
  it('resets for a genuinely new lesson (fresh)', () => {
    expect(resolveBindTransition(null, null, { sessionLessonId: 'b1', src: 'u1' })).toBe('fresh');
    expect(resolveBindTransition('b1', 'u1', { sessionLessonId: 'b2', src: 'u2' })).toBe('fresh');
    // Same src cannot happen with a different lesson, but the lesson is
    // the authoritative identity — still fresh.
    expect(resolveBindTransition('b1', 'u1', { sessionLessonId: 'b2', src: 'u1' })).toBe('fresh');
  });

  it('keeps everything for the identical lesson + source (same)', () => {
    expect(resolveBindTransition('b1', 'u1', { sessionLessonId: 'b1', src: 'u1' })).toBe('same');
  });

  it('soft-refreshes for the same lesson with a new source (retry/token rebuild)', () => {
    expect(resolveBindTransition('b1', 'u1', { sessionLessonId: 'b1', src: 'u2' })).toBe(
      'soft-refresh',
    );
    // Token rotation changes the URL string while the Variant stays the same.
    expect(
      resolveBindTransition('b1', 'u1?token=old', { sessionLessonId: 'b1', src: 'u1?token=new' }),
    ).toBe('soft-refresh');
  });
});

describe('isRestorablePosition', () => {
  it('only restores meaningful positions', () => {
    expect(isRestorablePosition(0)).toBe(false);
    expect(isRestorablePosition(0.5)).toBe(false);
    expect(isRestorablePosition(0.6)).toBe(true);
    expect(isRestorablePosition(95)).toBe(true);
    expect(isRestorablePosition(Number.NaN)).toBe(false);
  });
});

describe('decideResumeTarget', () => {
  it('applies the requested target when no retry restore is armed', () => {
    expect(decideResumeTarget(null, 150)).toEqual({ kind: 'apply', target: 150 });
    expect(decideResumeTarget(null, -5)).toEqual({ kind: 'apply', target: 0 });
  });

  it('honors an explicit restart-at-zero intent even with a restore armed', () => {
    expect(decideResumeTarget(95, 0)).toEqual({ kind: 'apply', target: 0 });
  });

  it('honors a resume point at least as far as the practical position', () => {
    expect(decideResumeTarget(95, 95)).toEqual({ kind: 'apply', target: 95 });
    expect(decideResumeTarget(95, 120)).toEqual({ kind: 'apply', target: 120 });
  });

  it('ignores an older saved resume point that would regress the practical position', () => {
    expect(decideResumeTarget(95, 90)).toEqual({ kind: 'ignore' });
    expect(decideResumeTarget(95, 0.5)).toEqual({ kind: 'ignore' });
  });
});

describe('resolveUserSeek', () => {
  it('applies immediately and clears pending state when the duration is known', () => {
    expect(
      resolveUserSeek({ pendingSeek: 95, retryRestore: 95, durationKnown: true, target: 60 }),
    ).toEqual({ pendingSeek: null, retryRestore: null, applyToElement: true });
  });

  it('becomes the pending position when metadata is not loaded yet', () => {
    expect(
      resolveUserSeek({ pendingSeek: 95, retryRestore: 95, durationKnown: false, target: 60 }),
    ).toEqual({ pendingSeek: 60, retryRestore: null, applyToElement: false });
  });
});

describe('reconcileSnapshot', () => {
  const playing = { paused: false, ended: false, currentTime: 95, duration: 600 };
  const pausedAt = (t: number) => ({ paused: true, ended: false, currentTime: t, duration: 600 });

  it('maps a real browser-paused transition without emitting a save signal', () => {
    const result = reconcileSnapshot(pausedAt(95), { isPlaying: true, pendingSeekArmed: false });
    expect(result.patch.isPlaying).toBe(false);
    expect(result.patch.currentTime).toBe(95);
    expect(result.patch.duration).toBe(600);
    // No save field exists: the element's own pause event is the single
    // writer of pause saves (no duplicate progress writes).
    expect(Object.keys(result.patch).sort()).toEqual(['currentTime', 'duration', 'isPlaying']);
  });

  it('leaves the play state untouched for an already-paused player (no duplicate write signal)', () => {
    const result = reconcileSnapshot(pausedAt(95), {
      isPlaying: false,
      pendingSeekArmed: false,
    });
    // Position/duration still sync from real element state (coherent UI on
    // foreground return), but isPlaying is NOT flipped and there is no
    // pause-save signal — the already-delivered pause event stays the
    // single progress write.
    expect(result.patch).toEqual({ currentTime: 95, duration: 600 });
    expect('isPlaying' in result.patch).toBe(false);
  });

  it('reflects a resumed element truthfully', () => {
    expect(reconcileSnapshot(playing, { isPlaying: false, pendingSeekArmed: false }).patch).toEqual(
      { isPlaying: true, currentTime: 95, duration: 600 },
    );
  });

  it('never trusts the element position while a pending seek is armed', () => {
    const result = reconcileSnapshot(pausedAt(0), { isPlaying: true, pendingSeekArmed: true });
    expect(result.patch).toEqual({ isPlaying: false });
  });

  it('ignores invalid element values instead of writing them', () => {
    const result = reconcileSnapshot(
      { paused: true, ended: false, currentTime: Number.NaN, duration: Number.NaN },
      { isPlaying: true, pendingSeekArmed: false },
    );
    expect(result.patch).toEqual({ isPlaying: false });
    // Invalid currentTime is skipped; the valid duration still syncs.
    expect(reconcileSnapshot(pausedAt(-1), { isPlaying: true, pendingSeekArmed: false })).toEqual({
      patch: { isPlaying: false, duration: 600 },
    });
  });

  it('treats an ended element as not playing', () => {
    const result = reconcileSnapshot(
      { paused: true, ended: true, currentTime: 600, duration: 600 },
      { isPlaying: true, pendingSeekArmed: false },
    );
    expect(result.patch.isPlaying).toBe(false);
  });
});

describe('clampPosition', () => {
  it('bounds the OS media position to the track', () => {
    expect(clampPosition(95, 600)).toBe(95);
    expect(clampPosition(700, 600)).toBe(600);
    expect(clampPosition(-3, 600)).toBe(0);
    expect(clampPosition(Number.NaN, 600)).toBe(0);
    expect(clampPosition(95, 0)).toBe(0);
    expect(clampPosition(95, Number.NaN)).toBe(0);
  });
});
