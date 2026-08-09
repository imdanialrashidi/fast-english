// app/src/features/library/logic.test.ts
// Podcast Slice 6 — pure Library derivations: card mapping, per-Variant
// Progress isolation and empty-state selection.

import { describe, expect, it } from 'vitest';
import { lessonCardState } from '../lessons/components/LessonCard';
import { availableLevelsCaption, deriveEmptyKind, toCardLesson, toCardProgress } from './logic';
import { DEFAULT_LIBRARY_QUERY } from './queryState';
import type { LibraryEpisodeItem } from './types';

const EPISODE: LibraryEpisodeItem['episode'] = {
  id: 'ep-1',
  slug: 'ep-1',
  contentKey: 'cat.ep-1',
  title: 'Morning Coffee',
  titleFa: 'قهوه صبح',
  descriptionFa: 'توضیح',
  category: { id: 'cat-1', key: 'cat-1', slug: 'cat-1', titleFa: 'روزمره' },
  artwork: '/api/fast-english/artwork/v-1',
  heroImage: null,
  featured: false,
};

function item(overrides: Partial<LibraryEpisodeItem> = {}): LibraryEpisodeItem {
  return {
    episode: EPISODE,
    availableLevels: [
      { level: 'A1', variantId: 'v-a1', isRecommended: false, isPreferred: true },
      { level: 'B1', variantId: 'v-b1', isRecommended: false, isPreferred: false },
    ],
    resolvedVariant: {
      id: 'v-a1',
      level: 'A1',
      durationSeconds: 600,
      isRecommended: false,
      isPreferred: true,
      progress: { state: 'not_started', percent: 0, positionSeconds: 0, completed: false },
    },
    ...overrides,
  };
}

describe('toCardLesson', () => {
  it('maps the resolved Variant onto the EpisodeCard lesson shape', () => {
    const lesson = toCardLesson(item());
    expect(lesson.id).toBe('v-a1');
    expect(lesson.level).toBe('A1');
    expect(lesson.audioDurationSeconds).toBe(600);
    expect(lesson.episode).toBe(EPISODE);
    expect(lesson.topicId).toBe('ep-1');
    expect(lesson.estimatedMinutes).toBe(0);
  });
});

describe('toCardProgress + lessonCardState', () => {
  it('not started -> شروع گوش‌دادن state', () => {
    const progress = toCardProgress(item().resolvedVariant.progress);
    expect(lessonCardState(progress).status).toBe('not_started');
    expect(lessonCardState(progress).position).toBe(0);
  });

  it('in progress keeps the saved position of the resolved Variant', () => {
    const progress = toCardProgress({
      state: 'in_progress',
      percent: 25,
      positionSeconds: 150,
      completed: false,
    });
    const state = lessonCardState(progress);
    expect(state.status).toBe('in_progress');
    expect(state.position).toBe(150);
    expect(state.percent).toBe(25);
  });

  it('completed wins and is never color-only', () => {
    const progress = toCardProgress({
      state: 'completed',
      percent: 100,
      positionSeconds: 600,
      completed: true,
    });
    expect(lessonCardState(progress).status).toBe('completed');
  });
});

describe('deriveEmptyKind', () => {
  it('search wins as the most specific filter', () => {
    expect(deriveEmptyKind({ ...DEFAULT_LIBRARY_QUERY, q: 'x' })).toBe('search');
    expect(
      deriveEmptyKind({ ...DEFAULT_LIBRARY_QUERY, q: 'x', level: 'C2', progress: 'completed' }),
    ).toBe('search');
  });

  it('explicit level beats progress and category', () => {
    expect(
      deriveEmptyKind({
        ...DEFAULT_LIBRARY_QUERY,
        level: 'C2',
        progress: 'in_progress',
        category: 'cat-1',
      }),
    ).toBe('level');
  });

  it('progress filter, then category, then library fallback', () => {
    expect(deriveEmptyKind({ ...DEFAULT_LIBRARY_QUERY, progress: 'completed' })).toBe('progress');
    expect(deriveEmptyKind({ ...DEFAULT_LIBRARY_QUERY, category: 'cat-1' })).toBe('category');
    expect(deriveEmptyKind(DEFAULT_LIBRARY_QUERY)).toBe('library');
  });

  it('preferred/all levels are not treated as explicit filters', () => {
    expect(deriveEmptyKind({ ...DEFAULT_LIBRARY_QUERY, level: 'all' })).toBe('library');
    expect(deriveEmptyKind({ ...DEFAULT_LIBRARY_QUERY, level: 'preferred' })).toBe('library');
  });
});

describe('availableLevelsCaption', () => {
  it('shows the levels only when more than one exists', () => {
    expect(availableLevelsCaption(item())).toBe('A1 · B1');
    expect(availableLevelsCaption(item({ availableLevels: [] }))).toBeNull();
    expect(
      availableLevelsCaption(
        item({
          availableLevels: [
            { level: 'A1', variantId: 'v-a1', isRecommended: false, isPreferred: true },
          ],
        }),
      ),
    ).toBeNull();
  });
});
