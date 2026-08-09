// app/src/features/library/types.ts
// Podcast Slice 6 — Library & Discovery types (Student surface).
//
// Mirror of the server contract of GET /api/fast-english/library:
// one canonical Episode result per Topic (never per Level Variant),
// the resolved Variant for the Student, per-Variant Progress, published
// Categories and a bounded Continue Listening rail.

import type { CefrLevel } from '../../../../shared/podcast/domain';
import type { EpisodeMeta } from '../lessons/types';

/** Level filter choices. `preferred` (default) and `all` resolve each
 *  Episode through the canonical chain (preferred -> recommended -> first
 *  published CEFR Variant); explicit A1–C2 filters to that Variant. */
export type LibraryLevelFilter = 'preferred' | 'all' | CefrLevel;

/** Progress filter over the resolved Variant (existing Progress
 *  semantics — no new state machine). */
export type LibraryProgressFilter = 'all' | 'not_started' | 'in_progress' | 'completed';

/** Deterministic sort keys. `suggested` uses real metadata only
 *  (featured, preferred compatibility, sort order, published date);
 *  `latest` uses the authoritative published date. */
export type LibrarySort = 'suggested' | 'latest';

/** Per-Variant Progress state (derived from lesson_progress). */
export type ProgressState = 'not_started' | 'in_progress' | 'completed';

/** Published Podcast Library Category with its Episode count. */
export interface LibraryCategory {
  id: string;
  key: string;
  slug: string;
  titleFa: string;
  episodeCount: number;
}

/** One published Variant of the Episode (canonical CEFR order). */
export interface LibraryAvailableLevel {
  level: string;
  variantId: string;
  isRecommended: boolean;
  isPreferred: boolean;
}

/** Progress of the resolved Variant (never another level's Progress). */
export interface ResolvedVariantProgress {
  state: ProgressState;
  percent: number;
  positionSeconds: number;
  completed: boolean;
}

/** The resolved Variant for this Student and its Progress. */
export interface ResolvedVariant {
  id: string;
  level: string;
  durationSeconds: number;
  isRecommended: boolean;
  isPreferred: boolean;
  progress: ResolvedVariantProgress;
}

/** One canonical Episode discovery result. */
export interface LibraryEpisodeItem {
  episode: EpisodeMeta;
  availableLevels: LibraryAvailableLevel[];
  resolvedVariant: ResolvedVariant;
}

/** One Continue Listening rail entry (real resumable Progress only). */
export interface ContinueListeningItem {
  episode: EpisodeMeta;
  variant: {
    id: string;
    level: string;
    durationSeconds: number;
  };
  progress: ResolvedVariantProgress;
}

export interface LibraryResponse {
  categories: LibraryCategory[];
  items: LibraryEpisodeItem[];
  continueListening: ContinueListeningItem[];
  page: number;
  perPage: number;
  totalItems: number;
  recommendedLevel: string;
  preferredLevel: string;
}

/** Wire parameters (validated/bounded by the server). */
export interface LibraryParams {
  q?: string;
  category?: string;
  level?: LibraryLevelFilter;
  progress?: LibraryProgressFilter;
  sort?: LibrarySort;
  page?: number;
  perPage?: number;
}
