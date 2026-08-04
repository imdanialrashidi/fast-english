// app/src/features/lessons/components/LessonCard.test.ts
// Deterministic state derivation for the shared lesson card: all three real
// progress states map exactly, completed wins over position, and nothing is
// fabricated from missing data.

import { describe, expect, it } from 'vitest';
import type { LessonProgressResponse } from '../../progress/types';
import { lessonCardState } from './LessonCard';

function progress(overrides: Partial<LessonProgressResponse>): LessonProgressResponse {
  return {
    lessonId: 'l1',
    positionSeconds: 0,
    furthestSeconds: 0,
    durationSeconds: 600,
    percent: 0,
    completed: false,
    completedAt: null,
    revision: 0,
    lastPlayedAt: null,
    ...overrides,
  };
}

describe('lessonCardState', () => {
  it('maps no progress to not_started', () => {
    expect(lessonCardState(undefined)).toEqual({ status: 'not_started', position: 0, percent: 0 });
  });

  it('maps a saved position to in_progress with the furthest position', () => {
    expect(
      lessonCardState(progress({ furthestSeconds: 150, positionSeconds: 42, percent: 25 })),
    ).toEqual({ status: 'in_progress', position: 150, percent: 25 });
  });

  it('maps completed to completed even when position is present', () => {
    expect(
      lessonCardState(progress({ completed: true, furthestSeconds: 600, percent: 100 })),
    ).toEqual({ status: 'completed', position: 600, percent: 100 });
  });

  it('zero-furthest with completed=false stays not_started', () => {
    expect(lessonCardState(progress({ positionSeconds: 0, furthestSeconds: 0 }))).toEqual({
      status: 'not_started',
      position: 0,
      percent: 0,
    });
  });
});
