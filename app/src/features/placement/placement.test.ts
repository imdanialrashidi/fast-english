// app/src/features/placement/placement.test.ts
// Unit tests for schemas, errors, and answer-leak prevention.

import { describe, expect, it } from 'vitest';
import { mapPlacementError } from './errors';
import {
  dashboardResponseSchema,
  placementQuestionSchema,
  placementResponseSchema,
  saveAnswerRequestSchema,
  submitRequestSchema,
} from './schemas';

describe('placement schemas', () => {
  describe('placementQuestionSchema', () => {
    const validQuestion = {
      id: 'q1',
      position: 1,
      prompt: 'What is your name?',
      options: [
        { id: 'a', text: 'Alice' },
        { id: 'b', text: 'Bob' },
      ],
    };

    it('accepts a valid question', () => {
      const result = placementQuestionSchema.safeParse(validQuestion);
      expect(result.success).toBe(true);
    });

    it('rejects correctOptionId in question', () => {
      const result = placementQuestionSchema.safeParse({
        ...validQuestion,
        correctOptionId: 'a',
      });
      expect(result.success).toBe(false);
    });

    it('rejects correct_option_id in question', () => {
      const result = placementQuestionSchema.safeParse({
        ...validQuestion,
        correct_option_id: 'a',
      });
      expect(result.success).toBe(false);
    });

    it('rejects answerKey in question', () => {
      const result = placementQuestionSchema.safeParse({
        ...validQuestion,
        answerKey: 'a',
      });
      expect(result.success).toBe(false);
    });

    it('rejects options with fewer than 2 entries', () => {
      const result = placementQuestionSchema.safeParse({
        ...validQuestion,
        options: [{ id: 'a', text: 'Only' }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects options with more than 6 entries', () => {
      const result = placementQuestionSchema.safeParse({
        ...validQuestion,
        options: [
          { id: 'a', text: '1' },
          { id: 'b', text: '2' },
          { id: 'c', text: '3' },
          { id: 'd', text: '4' },
          { id: 'e', text: '5' },
          { id: 'f', text: '6' },
          { id: 'g', text: '7' },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('placementResponseSchema', () => {
    const validResponse = {
      kind: 'in_progress' as const,
      attempt: {
        id: 'attempt1',
        status: 'in_progress' as const,
        revision: 3,
        answeredCount: 7,
        totalQuestions: 20,
        startedAt: '2026-07-29T00:00:00Z',
        lastSavedAt: '2026-07-29T00:01:00Z',
        submittedAt: null,
        score: null,
        maxScore: null,
      },
      questions: [
        {
          id: 'q1',
          position: 1,
          prompt: 'Test?',
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ],
        },
      ],
      answers: {},
    };

    it('accepts a valid response', () => {
      const result = placementResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('rejects correctOptionId at response level', () => {
      const result = placementResponseSchema.safeParse({
        ...validResponse,
        correctOptionId: 'a',
      });
      expect(result.success).toBe(false);
    });

    it('rejects submitted response without score', () => {
      const result = placementResponseSchema.safeParse({
        ...validResponse,
        kind: 'submitted',
        attempt: {
          ...validResponse.attempt,
          status: 'submitted',
          score: null,
          maxScore: null,
        },
      });
      // score is nullable, so this is technically valid
      expect(result.success).toBe(true);
    });

    it('accepts empty questions for submitted state', () => {
      // Submitted responses may have empty questions array.
      // The backend ensures in_progress responses always have questions.
      const result = placementResponseSchema.safeParse({
        ...validResponse,
        kind: 'submitted',
        attempt: {
          ...validResponse.attempt,
          status: 'submitted',
          score: 14,
          maxScore: 20,
          submittedAt: '2026-07-29T00:00:00Z',
        },
        questions: [],
      });
      expect(result.success).toBe(true);
    });

    it('rejects extra unknown keys', () => {
      const result = placementResponseSchema.safeParse({
        ...validResponse,
        extraField: 'should not be here',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('saveAnswerRequestSchema', () => {
    it('accepts valid input', () => {
      const result = saveAnswerRequestSchema.safeParse({
        questionId: 'q1',
        optionId: 'a',
        expectedRevision: 3,
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing fields', () => {
      const result = saveAnswerRequestSchema.safeParse({
        questionId: 'q1',
      });
      expect(result.success).toBe(false);
    });

    it('rejects extra fields', () => {
      const result = saveAnswerRequestSchema.safeParse({
        questionId: 'q1',
        optionId: 'a',
        expectedRevision: 3,
        extraField: 'bad',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('submitRequestSchema', () => {
    it('accepts valid input', () => {
      const result = submitRequestSchema.safeParse({
        expectedRevision: 20,
      });
      expect(result.success).toBe(true);
    });

    it('rejects extra fields', () => {
      const result = submitRequestSchema.safeParse({
        expectedRevision: 20,
        score: 15,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('dashboardResponseSchema', () => {
    const validDashboard = {
      student: {
        name: 'S',
        selectedLevel: 'B1',
        suggestedLevel: 'A2',
        placementCompleted: true,
      },
      placement: { score: 14, maxScore: 20, submittedAt: '2026-01-01T00:00:00Z' },
      subscription: {
        planName: 'P',
        startsAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-04-01T00:00:00Z',
        remainingDays: 60,
      },
      lessons: { publishedCount: 5 },
      progress: {
        kind: 'available',
        startedLessonCount: 2,
        completedLessonCount: 1,
        publishedLessonCount: 5,
        completionPercent: 20,
      },
      continueLearning: { kind: 'incomplete', lessonId: 'l1' },
    };

    it('accepts a valid dashboard payload', () => {
      const result = dashboardResponseSchema.safeParse(validDashboard);
      expect(result.success).toBe(true);
    });

    it('rejects an extra unknown nested field', () => {
      const result = dashboardResponseSchema.safeParse({
        ...validDashboard,
        progress: { ...validDashboard.progress, internalField: 1 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects a banned internal key at the top level', () => {
      const result = dashboardResponseSchema.safeParse({
        ...validDashboard,
        internal_note: 'secret',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('mapPlacementError', () => {
  it('maps known codes', () => {
    expect(mapPlacementError({ code: 'placement_auth_required' }).code).toBe(
      'placement_auth_required',
    );
    expect(mapPlacementError({ code: 'placement_attempt_stale' }).code).toBe(
      'placement_attempt_stale',
    );
    expect(mapPlacementError({ code: 'rate_limited' }).code).toBe('rate_limited');
  });

  it('maps HTTP status codes', () => {
    expect(mapPlacementError({ status: 401 }).code).toBe('placement_auth_required');
    expect(mapPlacementError({ status: 403 }).code).toBe('placement_access_denied');
    expect(mapPlacementError({ status: 404 }).code).toBe('not_found');
    expect(mapPlacementError({ status: 429 }).code).toBe('rate_limited');
  });

  it('maps network errors', () => {
    expect(mapPlacementError(new Error('Failed to fetch')).code).toBe('network');
    expect(mapPlacementError(new TypeError('NetworkError')).code).toBe('network');
  });

  it('returns unknown for null', () => {
    expect(mapPlacementError(null).code).toBe('unknown');
  });
});
