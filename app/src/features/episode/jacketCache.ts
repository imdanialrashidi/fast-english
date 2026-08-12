// app/src/features/episode/jacketCache.ts
// Slice 7 — session-scoped Episode jacket snapshot.
//
// The app shell's RouteTransition keys route content by pathname, so a
// Variant switch remounts the Episode route. The atomic-switch contract
// (docs/DESIGN.md) says the Episode-level jacket stays rendered while the
// variant-dependent regions swap. This module preserves ONLY the
// Episode-level identity (artwork, meta, published levels, level flags)
// across that remount — never any Variant content (audio, progress,
// summary, vocabulary, transcript always come fresh from the backend).
//
// The snapshot is scoped to the authenticated student session: a different
// user (or logged-out state) can never see another student's preferred/
// recommended markers, even transiently.

import type { AvailableLevelEntry, EpisodeMeta } from '../lessons/types';

export interface EpisodeJacketSnapshot {
  episodeId: string;
  /** null only for legacy responses without Episode metadata. */
  episode: EpisodeMeta | null;
  availableLevels: AvailableLevelEntry[];
  recommendedLevel: string;
  preferredLevel: string;
}

let snapshot: { sessionKey: string; data: EpisodeJacketSnapshot } | null = null;

/** Remember the Episode-level identity of the last successfully loaded
 *  Variant, keyed by the authenticated user id ('' for guests). */
export function rememberJacket(data: EpisodeJacketSnapshot, sessionKey: string | undefined): void {
  snapshot = { sessionKey: sessionKey ?? '', data };
}

/**
 * The cached jacket when `variantId` belongs to the cached Episode AND the
 * session matches; null otherwise (no cache, different Episode, or a
 * different student — all fall back to a full load).
 */
export function jacketForVariant(
  variantId: string | undefined,
  sessionKey: string | undefined,
): EpisodeJacketSnapshot | null {
  if (!variantId || !snapshot) return null;
  if ((snapshot.sessionKey ?? '') !== (sessionKey ?? '')) return null;
  return snapshot.data.availableLevels.some((entry) => entry.variantId === variantId)
    ? snapshot.data
    : null;
}
