// app/src/features/progress/useProgressSave.test.ts
// Deterministic unit tests for the progress-save queue logic. This repo has
// no DOM/testing-library renderer, so the hook's pure queue-transition
// helpers are tested directly and the timer/flush/init wiring is pinned by
// source-contract assertions (same style as receiptPreview.contract.test.ts).
// Real-browser integration is covered by e2e/p3-s2.spec.ts (stall scenario).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LessonProgressResponse } from './types';
import {
  drainAfterSuccess,
  queueLatest,
  retryAfterConflict,
  shouldSkipDuplicateWrite,
  snapshotFromProgress,
} from './useProgressSave';

const hookSource = readFileSync(resolve(__dirname, 'useProgressSave.ts'), 'utf8');

function makeProgress(revision: number, positionSeconds: number): LessonProgressResponse {
  return {
    lessonId: 'l1',
    positionSeconds,
    furthestSeconds: positionSeconds,
    durationSeconds: 600,
    percent: Math.round((positionSeconds / 600) * 100),
    completed: false,
    completedAt: null,
    revision,
    lastPlayedAt: null,
  };
}

describe('queue transitions (pure helpers)', () => {
  it('drains the queued position with the returned revision after an in-flight success', () => {
    // In-flight write started at revision 4; position 50 queued; the response
    // returns revision 5 -> the next request sends position 50 with
    // expectedRevision 5.
    const next = drainAfterSuccess(queueLatest(50, 4), 5);
    expect(next).toEqual({ position: 50, revision: 5 });
  });

  it('drains a queued payload even when its captured revision differs from the started write (bug 1 regression)', () => {
    // The queued payload was captured with revision 6 (e.g. after a 409
    // reload) while the in-flight write used 4. The old code dropped this
    // payload via `queued.expectedRevision === revision`; the drain must fire
    // unconditionally, using the returned revision.
    const next = drainAfterSuccess(queueLatest(50, 6), 5);
    expect(next).toEqual({ position: 50, revision: 5 });
  });

  it('sends nothing when there is no queued payload', () => {
    expect(drainAfterSuccess(null, 5)).toBeNull();
  });

  it('keeps the queued payload intact until a drain consumes it (clearing the timer never discards it)', () => {
    // The debounce timer only schedules a drain; the payload lives in
    // pendingRef independently of the timer, so flush/unmount can still send it.
    const queued = queueLatest(120, 3);
    expect(drainAfterSuccess(queued, 4)).toEqual({ position: 120, revision: 4 });
    expect(drainAfterSuccess(queued, 5)).toEqual({ position: 120, revision: 5 });
  });

  it('retries the newest pending position after a 409, with the reloaded revision', () => {
    const next = retryAfterConflict(queueLatest(200, 4), 50, 9);
    expect(next).toEqual({ position: 200, revision: 9 });
  });

  it('falls back to the failed position after a 409 when nothing newer is pending', () => {
    expect(retryAfterConflict(null, 50, 9)).toEqual({ position: 50, revision: 9 });
  });

  it('snapshots the authoritative revision from loaded progress (first save no longer 409s)', () => {
    const progress = makeProgress(3, 45);
    expect(snapshotFromProgress(progress)).toEqual({
      revision: 3,
      lastSaved: { position: 45, revision: 3 },
    });
  });

  it('skips writes duplicating the last acknowledged write, sends everything else', () => {
    const lastSaved = { position: 100, revision: 2 };
    expect(shouldSkipDuplicateWrite(lastSaved, 100.2, 2)).toBe(true);
    expect(shouldSkipDuplicateWrite(lastSaved, 101, 2)).toBe(false); // >= 0.5s
    expect(shouldSkipDuplicateWrite(lastSaved, 100, 3)).toBe(false); // new revision
    expect(shouldSkipDuplicateWrite(null, 100, 0)).toBe(false); // nothing acknowledged yet
  });
});

describe('hook wiring (source contract — no renderer available in this repo)', () => {
  it('stores the queued position in pendingRef at queue time; the timer only drains', () => {
    // Bug 2 guard: the scheduled position must not live only in the timer
    // closure — it survives in pendingRef, so clearing the timer never loses it.
    expect(hookSource).toContain('pendingRef.current = queueLatest(position, rev);');
    expect(hookSource).toMatch(
      /setTimeout\(\(\) => \{\s*timerRef\.current = null;\s*drainPending\(\);\s*\}, 2000\)/,
    );
  });

  it('flush clears the timer and drains pendingRef without discarding the payload', () => {
    const flushBlock =
      hookSource
        .match(/const flush = useCallback\([\s\S]*?\n\s{2}\}, \[drainPending\]\);/)
        ?.at(0) ?? '';
    expect(flushBlock).toContain('clearTimeout(timerRef.current);');
    expect(flushBlock).toContain('drainPending();');
  });

  it('drains the queued payload with the returned revision on success (no revision comparison)', () => {
    // Bug 1 guard: the drain must never be gated on the queued payload's
    // expectedRevision matching the started write.
    expect(hookSource).toContain('drainAfterSuccess(pendingRef.current, result.revision)');
    expect(hookSource).not.toContain('queued.expectedRevision === revision');
  });

  it('seeds revision state from initialProgress in an effect, guarded per lesson', () => {
    // Bug 3 guard: returning users must not start with revision 0.
    expect(hookSource).toContain('initialProgress?: LessonProgressResponse');
    expect(hookSource).toContain(
      'if (!initialProgress || initialProgress.lessonId !== lessonId) return;',
    );
    expect(hookSource).toContain('revisionRef.current = snap.revision;');
  });

  it('resets all save state when the lesson changes', () => {
    const resetBlock =
      hookSource.match(/switching lessons[\s\S]*?\n\s{2}\}, \[lessonId\]\);/)?.at(0) ?? '';
    expect(resetBlock).toContain('revisionRef.current = 0;');
    expect(resetBlock).toContain('pendingRef.current = null;');
    expect(resetBlock).toContain('lastSavedRef.current = null;');
    expect(resetBlock).toContain('lastTimeUpdateRef.current = 0;');
  });
});
