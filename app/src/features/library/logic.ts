// app/src/features/library/logic.ts
// Podcast Slice 6 — pure derivations for the Library UI.
//
// The Library reuses the Slice 5 EpisodeCard foundations: each canonical
// Episode result is mapped onto the LessonListItem shape (resolved
// Variant = the lesson) with its own per-Variant Progress, so the card's
// deterministic state derivation (not_started / in_progress / completed)
// and its action copy (شروع گوش‌دادن / ادامه از HH:MM / مرور دوباره) work
// unchanged. Empty-state copy is derived from the active query, never
// generic «no data».

import type { LessonListItem } from '../lessons/types';
import type { LessonProgressResponse } from '../progress/types';
import type { LibraryQuery } from './queryState';
import type { LibraryEpisodeItem, ResolvedVariantProgress } from './types';

/**
 * Map a canonical Episode result onto the LessonListItem shape the
 * EpisodeCard consumes: the card's lesson is the resolved Variant.
 */
export function toCardLesson(item: LibraryEpisodeItem): LessonListItem {
  const variant = item.resolvedVariant;
  return {
    id: variant.id,
    topicId: item.episode.id,
    topicTitle: item.episode.title,
    topicSlug: item.episode.slug,
    title: item.episode.title,
    summary: '',
    level: variant.level,
    estimatedMinutes: 0,
    audioDurationSeconds: variant.durationSeconds,
    publishedAt: null,
    isPublicSample: false,
    episode: item.episode,
  };
}

/** Map the resolved Variant's Progress into the card progress shape. */
export function toCardProgress(progress: ResolvedVariantProgress): LessonProgressResponse {
  return {
    lessonId: '',
    positionSeconds: progress.positionSeconds,
    furthestSeconds: progress.positionSeconds,
    durationSeconds: 0,
    percent: progress.percent,
    completed: progress.completed,
    completedAt: null,
    revision: 0,
    lastPlayedAt: null,
  };
}

/**
 * Which empty-state copy to show when a query returns zero results.
 * Most specific filter first (search, then explicit level, then progress,
 * then category), falling back to the no-published-content state.
 */
export type LibraryEmptyKind = 'search' | 'level' | 'progress' | 'category' | 'library';

export function deriveEmptyKind(query: LibraryQuery): LibraryEmptyKind {
  if (query.q.trim().length > 0) return 'search';
  if (query.level !== 'preferred' && query.level !== 'all') return 'level';
  if (query.progress !== 'all') return 'progress';
  if (query.category) return 'category';
  return 'library';
}

/** Available-levels caption for a card (only when more than one level). */
export function availableLevelsCaption(item: LibraryEpisodeItem): string | null {
  if (item.availableLevels.length <= 1) return null;
  return item.availableLevels.map((l) => l.level).join(' · ');
}
