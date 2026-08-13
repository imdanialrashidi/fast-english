// app/src/features/progress/useProgressSave.ts
// P3-S2 Closure — Hook for saving lesson progress with bounded strategy.
//
// Server-authoritative duration: the Client no longer sends durationSeconds.
// The Backend loads it from the published Lesson.
//
// Strategy:
//   - Restore saved position after metadata loads
//   - Save approximately every 10-15 seconds during playback
//   - Save on pause
//   - Save after meaningful seek
//   - Save before route change (via beforeunload)
//   - Save when playback ends
//   - Avoid duplicate identical writes
//   - Serialize writes within one tab
//   - Handle HTTP 409 by reloading authoritative progress
//   - Never show "saved" before Backend acknowledgement
//
// Queue invariants (the hook is the only client writer of lesson_progress):
//   1. Latest position wins — a queued payload always supersedes an older one.
//   2. Every write uses the current authoritative revision.
//   3. Clearing a timer (flush/unmount/beforeunload) never discards a payload:
//      the debounce timer only schedules a drain of `pendingRef`, which is the
//      single source of truth for the newest un-sent position.

import { useCallback, useEffect, useRef } from 'react';
import { FUNNEL_EVENTS, shouldFireMilestone, trackFunnel } from '../../lib/telemetry';
import * as progressApi from './api';
import type { LessonProgressResponse } from './types';

interface UseProgressSaveOptions {
  lessonId: string | undefined;
  /** Whether saving is enabled (e.g., user is entitled) */
  enabled: boolean;
  /**
   * Authoritative progress already loaded by the caller (e.g. the lesson
   * route's own fetch). Seeds `revisionRef`/`lastSavedRef` so the first
   * write does not 409 against an existing record.
   */
  initialProgress?: LessonProgressResponse;
  /** Called when a save succeeds with the new authoritative progress */
  onSaved?: (progress: LessonProgressResponse) => void;
  /** Called when a 409 occurs — the hook will auto-reload */
  onStaleRevision?: (authoritativeProgress: LessonProgressResponse) => void;
}

export interface PendingSave {
  positionSeconds: number;
  expectedRevision: number;
  /** Timestamp when this save was queued */
  queuedAt: number;
}

// ---------------------------------------------------------------------------
// Pure queue-transition helpers. Exported for deterministic unit tests
// (this repo has no DOM/testing-library renderer). The hook below is a thin
// adapter that applies these transitions to its refs.
// ---------------------------------------------------------------------------

/** Latest payload wins: a queued save always supersedes any older one. */
export function queueLatest(positionSeconds: number, expectedRevision: number): PendingSave {
  return { positionSeconds, expectedRevision, queuedAt: Date.now() };
}

/**
 * Next write after an in-flight write succeeds: drain the queued payload with
 * the revision the server just returned (never the revision the queued payload
 * was captured with — it may predate the in-flight write).
 */
export function drainAfterSuccess(
  pending: PendingSave | null,
  resultRevision: number,
): { position: number; revision: number } | null {
  if (!pending) return null;
  return { position: pending.positionSeconds, revision: resultRevision };
}

/**
 * Retry after a 409 + authoritative reload: prefer the newest pending position
 * over the position that just failed.
 */
export function retryAfterConflict(
  pending: PendingSave | null,
  failedPosition: number,
  freshRevision: number,
): { position: number; revision: number } {
  return { position: pending ? pending.positionSeconds : failedPosition, revision: freshRevision };
}

/** True when the write duplicates the last acknowledged write (< 0.5s at the same revision). */
export function shouldSkipDuplicateWrite(
  lastSaved: { position: number; revision: number } | null,
  position: number,
  revision: number,
): boolean {
  return (
    lastSaved !== null &&
    Math.abs(lastSaved.position - position) < 0.5 &&
    lastSaved.revision === revision
  );
}

/** Authoritative snapshot of a progress record: the revision to write with next. */
export function snapshotFromProgress(progress: LessonProgressResponse): {
  revision: number;
  lastSaved: { position: number; revision: number };
} {
  return {
    revision: progress.revision,
    lastSaved: { position: progress.positionSeconds, revision: progress.revision },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProgressSave({
  lessonId,
  enabled,
  initialProgress,
  onSaved,
  onStaleRevision,
}: UseProgressSaveOptions) {
  const writeInFlightRef = useRef(false);
  const pendingRef = useRef<PendingSave | null>(null);
  const lastSavedRef = useRef<{ position: number; revision: number } | null>(null);
  const revisionRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTimeUpdateRef = useRef(0);
  // Listening-milestone guard: one 50%-crossing event per lesson session
  // (funnel telemetry — see docs/OBSERVABILITY.md).
  const milestone50FiredRef = useRef(false);
  // Completion guard: one episode_completed event per lesson session
  // (a replayed episode must not re-fire it).
  const completionFiredRef = useRef(false);

  // Reset all save state when switching lessons (a fresh lesson starts clean).
  // Declared before the initialization effect so the reset always wins on a
  // lesson change and the init effect then applies the new lesson's progress.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    revisionRef.current = 0;
    lastSavedRef.current = null;
    lastTimeUpdateRef.current = 0;
    milestone50FiredRef.current = false;
    completionFiredRef.current = false;
  }, [lessonId]);

  // Seed the revision state from authoritative progress once it is known, so
  // the first save of a returning user sends the loaded revision instead of 0.
  useEffect(() => {
    if (!initialProgress || initialProgress.lessonId !== lessonId) return;
    const snap = snapshotFromProgress(initialProgress);
    revisionRef.current = snap.revision;
    lastSavedRef.current = snap.lastSaved;
  }, [initialProgress, lessonId]);

  // Load initial progress (manual alternative to `initialProgress`)
  const loadProgress = useCallback(async () => {
    if (!lessonId || !enabled) return null;
    try {
      const progress = await progressApi.getLessonProgress(lessonId);
      const snap = snapshotFromProgress(progress);
      revisionRef.current = snap.revision;
      lastSavedRef.current = snap.lastSaved;
      return progress;
    } catch {
      return null;
    }
  }, [lessonId, enabled]);

  // Internal save function — serializes writes
  const performSave = useCallback(
    async (position: number, revision: number): Promise<boolean> => {
      if (!lessonId || !enabled) return false;
      if (writeInFlightRef.current) {
        // Queue this save for later (latest payload wins)
        pendingRef.current = queueLatest(position, revision);
        return false;
      }

      writeInFlightRef.current = true;
      try {
        const result = await progressApi.saveLessonProgress(lessonId, {
          positionSeconds: position,
          expectedRevision: revision,
        });
        const snap = snapshotFromProgress(result);
        revisionRef.current = snap.revision;
        lastSavedRef.current = snap.lastSaved;
        onSaved?.(result);
        writeInFlightRef.current = false;

        // Drain the newest queued payload with the returned revision.
        const next = drainAfterSuccess(pendingRef.current, result.revision);
        pendingRef.current = null;
        if (next) {
          void performSave(next.position, next.revision);
        }
        return true;
      } catch (err: unknown) {
        writeInFlightRef.current = false;
        const errObj = err as { status?: number; data?: { code?: string } };
        if (errObj?.status === 409) {
          // Stale revision — reload authoritative progress and retry the
          // newest pending position (falling back to the failed one).
          try {
            const fresh = await progressApi.getLessonProgress(lessonId);
            const snap = snapshotFromProgress(fresh);
            revisionRef.current = snap.revision;
            lastSavedRef.current = snap.lastSaved;
            onStaleRevision?.(fresh);
            const next = retryAfterConflict(pendingRef.current, position, fresh.revision);
            pendingRef.current = null;
            void performSave(next.position, next.revision);
          } catch {
            // Reload failed — nothing more we can do
          }
        }
        return false;
      }
    },
    [lessonId, enabled, onSaved, onStaleRevision],
  );

  // Send the newest queued payload (if any) immediately. Used by the debounce
  // timer, `flush`, and `handleEnded` — the payload survives in `pendingRef`
  // regardless of any timer being cleared, so nothing is ever dropped.
  const drainPending = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    void performSave(pending.positionSeconds, pending.expectedRevision);
  }, [performSave]);

  // Queue a save (debounced). The timer only schedules a drain of `pendingRef`;
  // the payload is stored now so clearing the timer never loses the position.
  const queueSave = useCallback(
    (position: number, revision?: number) => {
      if (!lessonId || !enabled) return;
      const rev = revision ?? revisionRef.current;

      // Skip if identical to last saved
      if (shouldSkipDuplicateWrite(lastSavedRef.current, position, rev)) return;

      // Latest payload wins
      pendingRef.current = queueLatest(position, rev);

      // Debounce — flush pending timer, then drain the queue later
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        drainPending();
      }, 2000); // 2-second debounce
    },
    [lessonId, enabled, drainPending],
  );

  // Flush any pending save immediately
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    drainPending();
  }, [drainPending]);

  // Handle time updates from the player
  const handleTimeUpdate = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      if (!enabled || !lessonId) return;
      // One-shot listening milestone (50% crossed) per lesson session
      // (funnel telemetry — see docs/OBSERVABILITY.md).
      if (shouldFireMilestone(positionSeconds, durationSeconds, milestone50FiredRef.current)) {
        milestone50FiredRef.current = true;
        trackFunnel(FUNNEL_EVENTS.listeningMilestone, {
          lessonId,
          milestone: '50',
          durationSeconds: Math.round(durationSeconds),
        });
      }
      // Save approximately every 10-15 seconds during playback
      const elapsed = positionSeconds - lastTimeUpdateRef.current;
      lastTimeUpdateRef.current = positionSeconds;

      if (elapsed >= 10 || elapsed < 0) {
        queueSave(positionSeconds);
      }
    },
    [enabled, lessonId, queueSave],
  );

  // Handle pause
  const handlePause = useCallback(
    (positionSeconds: number, _durSeconds: number) => {
      if (!enabled || !lessonId) return;
      // Save immediately on pause — the pause position is the newest, so it
      // supersedes anything still queued (pendingRef/timer).
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
      void performSave(positionSeconds, revisionRef.current);
    },
    [enabled, lessonId, performSave],
  );

  // Handle seek
  const handleSeek = useCallback(
    (positionSeconds: number) => {
      if (!enabled || !lessonId) return;
      // Save after meaningful seek (> 0.5s difference)
      const lastPos = lastSavedRef.current?.position ?? 0;
      if (Math.abs(positionSeconds - lastPos) > 0.5) {
        queueSave(positionSeconds);
      }
    },
    [enabled, lessonId, queueSave],
  );

  // Handle end
  const handleEnded = useCallback(() => {
    if (!enabled || !lessonId) return;
    // Funnel telemetry: meaningful listening completion (fires once per
    // lesson session — the element's ended event only belongs to lesson
    // audio; pronunciation clips use their own host).
    if (!completionFiredRef.current) {
      completionFiredRef.current = true;
      trackFunnel(FUNNEL_EVENTS.episodeCompleted, { lessonId });
    }
    // Flush on end
    flush();
  }, [enabled, lessonId, flush]);

  // Save before unload / hide: the newest REAL position is flushed when
  // the tab is backgrounded, page-hidden or unloaded. Clearing a timer
  // never loses the payload (it lives in pendingRef, drained by the
  // unmount flush); the write itself cannot be awaited during unload
  // (documented limitation) — the last acknowledged position is already
  // on the server. Backgrounding never fabricates a position: only the
  // position actually reached by playback is ever queued.
  useEffect(() => {
    if (!enabled || !lessonId) return;

    const drainTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      drainPending();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') drainTimer();
    };
    const handleBeforeUnload = () => {
      drainTimer();
    };
    const handlePageHide = () => {
      drainTimer();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      // Flush on unmount (also runs on lesson change, against the old lesson)
      flush();
    };
  }, [enabled, lessonId, flush, drainPending]);

  return {
    loadProgress,
    handleTimeUpdate,
    handlePause,
    handleSeek,
    handleEnded,
    currentRevision: revisionRef.current,
    lastSaved: lastSavedRef.current,
    flush,
  };
}
