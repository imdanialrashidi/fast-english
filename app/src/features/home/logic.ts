// app/src/features/home/logic.ts
// Podcast Slice 5 — pure Home composition rules (unit-tested, no I/O).
//
// Decides:
//   - the Continue Listening hero state (continue / first-use / completed /
//     unavailable) from real progress data — never fabricated;
//   - the Recommended (مناسب سطح شما) and Latest (تازه منتشر شده) section
//     slices from the preferred-level published Episode list using only
//     existing sort/featured metadata (no recommendation algorithm);
//   - preferred/recommended level presentation without changing either
//     value (browsing never mutates the preferred level).

import type { LessonListItem } from '../lessons/types';
import type { DashboardResponse } from '../placement/types';
import type {
  ContinueLessonItem,
  ContinueLessonProgress,
  ContinueResponse,
  ProgressSummaryResponse,
} from '../progress/types';

export interface HomeInputs {
  episodes: LessonListItem[];
  continueResponse: ContinueResponse;
  summary: ProgressSummaryResponse | null;
  subscription: DashboardResponse['subscription'] | null;
  /** Normalized Placement result (user.suggested_level); '' when absent. */
  recommendedLevel: string;
  /** Preferred level fallback (summary.selectedLevel when available). */
  preferredLevel: string;
}

export type HomeHeroKind = 'continue' | 'first_use' | 'all_completed' | 'unavailable';

export interface HomeHeroState {
  kind: HomeHeroKind;
  /** Present only for kind === 'continue'. */
  item: { lesson: LessonListItem; progress: ContinueLessonProgress } | null;
  /** Whether the preferred level has any published Episode. */
  hasEpisodes: boolean;
}

/** Minimal LessonListItem from the Continue endpoint payload (no episode meta). */
export function continueLessonToListItem(item: ContinueLessonItem): LessonListItem {
  return {
    id: item.id,
    topicId: item.topicId,
    topicTitle: item.topicTitle,
    topicSlug: item.topicSlug,
    title: item.title,
    summary: '',
    level: item.level,
    estimatedMinutes: item.estimatedMinutes,
    publishedAt: null,
    isPublicSample: false,
  };
}

/**
 * Continue Listening hero decision:
 *   - never-started student → first-use start experience (no empty card);
 *   - real resumable progress → dominant Continue hero;
 *   - everything completed → completion state;
 *   - started episodes hidden by publication changes → honest unavailable.
 */
export function deriveHeroState(inputs: HomeInputs): HomeHeroState {
  const started = inputs.summary?.startedLessonCount ?? 0;
  const response = inputs.continueResponse;
  const hasEpisodes = inputs.episodes.length > 0;

  if (response.kind === 'lesson') {
    const found = inputs.episodes.find((e) => e.id === response.lesson.id);
    const lesson = found ?? continueLessonToListItem(response.lesson);
    if (started > 0) {
      return {
        kind: 'continue',
        item: { lesson, progress: response.progress },
        hasEpisodes,
      };
    }
    // Progress never started: the Continue card would be fake — show the
    // intentional starting experience instead.
    return { kind: 'first_use', item: null, hasEpisodes };
  }

  if (response.kind === 'all_completed') {
    return { kind: 'all_completed', item: null, hasEpisodes };
  }

  // no_lessons: no published Episode at the preferred level.
  if (started > 0) {
    return { kind: 'unavailable', item: null, hasEpisodes };
  }
  return { kind: 'first_use', item: null, hasEpisodes };
}

function publishedTime(lesson: LessonListItem): number {
  return lesson.publishedAt ? new Date(lesson.publishedAt).getTime() : 0;
}

/**
 * Deterministic Episode order: featured first, then newest published,
 * then title (stable tiebreak). This is the only "recommendation" the
 * slice makes — never marketed as smart/personalized.
 */
export function compareEpisodes(a: LessonListItem, b: LessonListItem): number {
  const featuredA = a.episode?.featured ? 1 : 0;
  const featuredB = b.episode?.featured ? 1 : 0;
  if (featuredA !== featuredB) return featuredB - featuredA;
  const timeDiff = publishedTime(b) - publishedTime(a);
  if (timeDiff !== 0) return timeDiff;
  return a.title.localeCompare(b.title);
}

export interface HomeSections {
  recommended: LessonListItem[];
  latest: LessonListItem[];
}

/** Section slices without duplicates; limits keep the page calm. */
export function deriveSections(
  episodes: LessonListItem[],
  recommendedCount = 3,
  latestCount = 3,
): HomeSections {
  const sorted = [...episodes].sort(compareEpisodes);
  const recommended = sorted.slice(0, recommendedCount);
  const latest = sorted
    .slice(recommendedCount)
    .sort((a, b) => publishedTime(b) - publishedTime(a))
    .slice(0, latestCount);
  return { recommended, latest };
}
