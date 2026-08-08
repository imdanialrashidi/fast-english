// app/src/features/home/home.test.ts
// Podcast Slice 5 — deterministic Home composition rules.
//
// The hero decision never fabricates progress: a never-started Student
// gets the intentional first-use experience, real resumable progress gets
// the dominant Continue hero, completed levels get the completion state.
// Section slices come from real Published data via existing sort/featured
// metadata only.

import { describe, expect, it } from 'vitest';
import type { LessonListItem } from '../lessons/types';
import type { ContinueResponse, ProgressSummaryResponse } from '../progress/types';
import type { HomeInputs } from './logic';
import {
  compareEpisodes,
  continueLessonToListItem,
  deriveHeroState,
  deriveSections,
} from './logic';

function episode(overrides: Partial<LessonListItem>): LessonListItem {
  return {
    id: 'l1',
    topicId: 't1',
    topicTitle: 'موضوع',
    topicSlug: 'topic',
    title: 'English Title',
    summary: 's',
    level: 'B1',
    estimatedMinutes: 10,
    audioDurationSeconds: 600,
    publishedAt: '2026-08-01T00:00:00.000Z',
    isPublicSample: false,
    episode: {
      id: 't1',
      slug: 'topic',
      contentKey: 'k',
      title: 'موضوع',
      titleFa: 'عنوان فارسی',
      descriptionFa: 'د',
      category: { id: 'c1', key: 'general', slug: 'general', titleFa: 'عمومی' },
      artwork: '/api/fast-english/artwork/l1',
      heroImage: null,
      featured: false,
    },
    ...overrides,
  };
}

function summary(overrides: Partial<ProgressSummaryResponse>): ProgressSummaryResponse {
  return {
    publishedLessonCount: 4,
    startedLessonCount: 2,
    completedLessonCount: 1,
    completionPercent: 25,
    totalListeningSeconds: 300,
    totalDurationSeconds: 2400,
    selectedLevel: 'B1',
    ...overrides,
  };
}

const continueLesson: ContinueResponse = {
  kind: 'lesson',
  lesson: {
    id: 'l1',
    topicId: 't1',
    topicTitle: 'موضوع',
    topicSlug: 'topic',
    title: 'English Title',
    level: 'B1',
    estimatedMinutes: 10,
  },
  progress: {
    positionSeconds: 150,
    furthestSeconds: 150,
    durationSeconds: 600,
    percent: 25,
    completed: false,
  },
};

const noLessons: ContinueResponse = { kind: 'no_lessons', message: '' };
const allCompleted: ContinueResponse = { kind: 'all_completed', message: '' };

function inputs(overrides: Partial<HomeInputs>): HomeInputs {
  return {
    episodes: [episode({})],
    continueResponse: continueLesson,
    summary: summary({}),
    subscription: null,
    recommendedLevel: 'B1',
    preferredLevel: 'B1',
    ...overrides,
  };
}

describe('deriveHeroState', () => {
  it('real resumable progress yields the Continue hero with the merged Episode', () => {
    const hero = deriveHeroState(inputs({}));
    expect(hero.kind).toBe('continue');
    expect(hero.item?.lesson.id).toBe('l1');
    expect(hero.item?.lesson.episode?.titleFa).toBe('عنوان فارسی');
    expect(hero.item?.progress.positionSeconds).toBe(150);
    expect(hero.hasEpisodes).toBe(true);
  });

  it('a never-started Student gets the first-use experience, never a fake Continue card', () => {
    const hero = deriveHeroState(
      inputs({
        summary: summary({ startedLessonCount: 0, completedLessonCount: 0, completionPercent: 0 }),
      }),
    );
    expect(hero.kind).toBe('first_use');
    expect(hero.item).toBeNull();
    expect(hero.hasEpisodes).toBe(true);
  });

  it('first-use is preserved when the Continue endpoint disagrees with zero progress', () => {
    // The server returns a "next lesson" even for never-started students;
    // the Home must not render a Continue hero for them.
    const hero = deriveHeroState(
      inputs({
        summary: summary({ startedLessonCount: 0 }),
        continueResponse: {
          kind: 'lesson',
          lesson: {
            id: 'l1',
            topicId: 't1',
            topicTitle: 'موضوع',
            topicSlug: 't',
            title: 'T',
            level: 'B1',
            estimatedMinutes: 10,
          },
          progress: {
            positionSeconds: 0,
            furthestSeconds: 0,
            durationSeconds: 600,
            percent: 0,
            completed: false,
          },
        },
      }),
    );
    expect(hero.kind).toBe('first_use');
  });

  it('a Continue lesson missing from the list still renders with a minimal item', () => {
    const hero = deriveHeroState(
      inputs({
        episodes: [],
        continueResponse: continueLesson,
        summary: summary({ startedLessonCount: 1 }),
      }),
    );
    expect(hero.kind).toBe('continue');
    expect(hero.item?.lesson.id).toBe('l1');
    expect(hero.item?.lesson.episode).toBeUndefined();
    expect(hero.hasEpisodes).toBe(false);
  });

  it('all-completed maps to the completion state', () => {
    const hero = deriveHeroState(inputs({ continueResponse: allCompleted }));
    expect(hero.kind).toBe('all_completed');
  });

  it('no published Episodes with no progress maps to first-use (no-episodes copy)', () => {
    const hero = deriveHeroState(
      inputs({
        continueResponse: noLessons,
        episodes: [],
        summary: summary({ startedLessonCount: 0 }),
      }),
    );
    expect(hero.kind).toBe('first_use');
    expect(hero.hasEpisodes).toBe(false);
  });

  it('started Episodes hidden by publication changes map to an honest unavailable state', () => {
    const hero = deriveHeroState(
      inputs({
        continueResponse: noLessons,
        episodes: [],
        summary: summary({ startedLessonCount: 1 }),
      }),
    );
    expect(hero.kind).toBe('unavailable');
  });
});

describe('deriveSections', () => {
  const older = episode({ id: 'older', title: 'Older', publishedAt: '2026-07-01T00:00:00.000Z' });
  const newest = episode({
    id: 'newest',
    title: 'Newest',
    publishedAt: '2026-08-08T00:00:00.000Z',
  });
  const featuredOld = episode({
    id: 'feat',
    title: 'Featured',
    publishedAt: '2026-06-01T00:00:00.000Z',
    episode: { ...older.episode!, id: 'feat', titleFa: 'ویژه', featured: true },
  });
  const noDate = episode({ id: 'nodate', title: 'NoDate', publishedAt: null });

  it('recommended puts featured Episodes first, then newest published', () => {
    const { recommended } = deriveSections([older, newest, featuredOld, noDate]);
    expect(recommended.map((l) => l.id)).toEqual(['feat', 'newest', 'older']);
  });

  it('latest takes the remaining newest without duplicating recommended', () => {
    const { recommended, latest } = deriveSections([older, newest, featuredOld, noDate]);
    const ids = [...recommended.map((l) => l.id), ...latest.map((l) => l.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(latest.map((l) => l.id)).toEqual(['nodate']);
  });

  it('respects the section limits', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      episode({ id: `l${i}`, title: `L${i}`, publishedAt: `2026-08-0${i}T00:00:00.000Z` }),
    );
    const { recommended, latest } = deriveSections(many, 3, 3);
    expect(recommended).toHaveLength(3);
    expect(latest).toHaveLength(3);
  });

  it('empty input produces empty sections', () => {
    expect(deriveSections([])).toEqual({ recommended: [], latest: [] });
  });

  it('sorts deterministically with a title tiebreak for equal publish times', () => {
    const a = episode({ id: 'a', title: 'Alpha', publishedAt: '2026-08-01T00:00:00.000Z' });
    const b = episode({ id: 'b', title: 'Beta', publishedAt: '2026-08-01T00:00:00.000Z' });
    const { recommended } = deriveSections([b, a]);
    expect(recommended.map((l) => l.id)).toEqual(['a', 'b']);
  });
});

describe('compareEpisodes', () => {
  it('orders featured above non-featured regardless of date', () => {
    const feat = episode({
      id: 'f',
      title: 'F',
      episode: { ...episode({}).episode!, featured: true },
    });
    const fresh = episode({ id: 'n', title: 'N', publishedAt: '2026-08-08T00:00:00.000Z' });
    expect(compareEpisodes(feat, fresh)).toBeLessThan(0);
  });
});

describe('continueLessonToListItem', () => {
  it('converts the Continue payload into a minimal list item', () => {
    const item = continueLessonToListItem(continueLesson.lesson);
    expect(item.id).toBe('l1');
    expect(item.title).toBe('English Title');
    expect(item.level).toBe('B1');
    expect(item.episode).toBeUndefined();
  });
});
