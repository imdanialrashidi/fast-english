// app/src/features/placement/schemas.ts
// Zod schemas for Placement API responses.
// These MUST reject any response containing correctOptionId or other
// answer-key fields at runtime.

import { z } from 'zod/v4';

const placementOptionSchema = z
  .object({
    id: z.string().trim().min(1),
    text: z.string().trim().min(1),
  })
  .strict();

// The student-facing question schema explicitly bans all answer-key fields.
export const placementQuestionSchema = z
  .object({
    id: z.string().trim().min(1),
    position: z.number().int().min(1).max(20),
    prompt: z.string().trim().min(1),
    options: z.array(placementOptionSchema).min(2).max(6),
  })
  .strict()
  .refine(
    (q) => {
      // Ban any extra keys that might contain answer data
      const keys = Object.keys(q);
      const banned = [
        'correctOptionId',
        'correct_option_id',
        'correctAnswer',
        'answerKey',
        'isCorrect',
        'gradingKey',
      ];
      for (const k of keys) {
        if (banned.includes(k as string)) return false;
      }
      return true;
    },
    { message: 'Response contains answer-key data' },
  );

export const placementQuestionListSchema = z.array(placementQuestionSchema);

export const placementAttemptSchema = z
  .object({
    id: z.string().trim().min(1),
    status: z.enum(['in_progress', 'submitted']),
    revision: z.number().int().min(0),
    answeredCount: z.number().int().min(0).max(20),
    totalQuestions: z.number().int().min(20).max(20),
    startedAt: z.string().nullable(),
    lastSavedAt: z.string().nullable(),
    submittedAt: z.string().nullable(),
    score: z.number().int().min(0).max(20).nullable(),
    maxScore: z.number().int().min(0).max(20).nullable(),
  })
  .strict();

export const placementAnswerMapSchema = z.record(z.string(), z.string());

export const placementResponseSchema = z
  .object({
    kind: z.enum(['in_progress', 'submitted']),
    attempt: placementAttemptSchema,
    questions: placementQuestionListSchema,
    answers: placementAnswerMapSchema,
  })
  .strict()
  .refine(
    (r) => {
      // Double-check that no answer-key fields exist at response level
      const keys = Object.keys(r);
      const banned = [
        'correctOptionId',
        'correct_option_id',
        'correctAnswer',
        'answerKey',
        'isCorrect',
        'gradingKey',
      ];
      for (const k of keys) {
        if (banned.includes(k as string)) return false;
      }
      return true;
    },
    { message: 'Response contains answer-key data' },
  );

export const saveAnswerRequestSchema = z
  .object({
    questionId: z.string().trim().min(1),
    optionId: z.string().trim().min(1),
    expectedRevision: z.number().int().min(0),
  })
  .strict();

export const submitRequestSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
  })
  .strict();

// P2-S2 Schemas

export const cefrLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

// Level-context response schemas
export const placementRequiredSchema = z
  .object({
    kind: z.literal('placement_required'),
  })
  .strict();

export const placementInProgressSchema = z
  .object({
    kind: z.literal('placement_in_progress'),
    attemptId: z.string().min(1),
    answeredCount: z.number().int().min(0).max(20),
    totalQuestions: z.number().int().min(20).max(20),
  })
  .strict();

export const levelSelectionRequiredSchema = z
  .object({
    kind: z.literal('level_selection_required'),
    attemptId: z.string().min(1),
    score: z.number().int().min(0).max(20),
    maxScore: z.number().int().min(0).max(20),
    suggestedLevel: cefrLevelSchema.nullable(),
    selectedLevel: z.null(),
    placementCompleted: z.literal(false),
  })
  .strict();

export const completedSchema = z
  .object({
    kind: z.literal('completed'),
    attemptId: z.string().min(1),
    score: z.number().int().min(0).max(20),
    maxScore: z.number().int().min(0).max(20),
    suggestedLevel: cefrLevelSchema.nullable(),
    selectedLevel: cefrLevelSchema.nullable(),
    placementCompleted: z.literal(true),
  })
  .strict();

export const levelContextResponseSchema = z.discriminatedUnion('kind', [
  placementRequiredSchema,
  placementInProgressSchema,
  levelSelectionRequiredSchema,
  completedSchema,
]);

// Selected-level request schema — only accepts selectedLevel, no extra fields
export const selectLevelRequestSchema = z
  .object({
    selectedLevel: cefrLevelSchema,
  })
  .strict()
  .refine(
    (r) => {
      const keys = Object.keys(r);
      return keys.length === 1 && keys[0] === 'selectedLevel';
    },
    { message: 'Request must contain only selectedLevel' },
  );

// Selected-level response schema
export const selectLevelResponseSchema = z
  .object({
    kind: z.literal('completed'),
    suggestedLevel: cefrLevelSchema,
    selectedLevel: cefrLevelSchema,
    placementCompleted: z.literal(true),
  })
  .strict();

// Dashboard response schema
export const dashboardResponseSchema = z
  .object({
    student: z
      .object({
        name: z.string(),
        selectedLevel: cefrLevelSchema,
        suggestedLevel: cefrLevelSchema.nullable(),
        placementCompleted: z.literal(true),
      })
      .strict(),
    placement: z
      .object({
        score: z.number().int().nullable(),
        maxScore: z.number().int().nullable(),
        submittedAt: z.string().nullable(),
      })
      .strict(),
    subscription: z
      .object({
        planName: z.string(),
        startsAt: z.string(),
        expiresAt: z.string(),
        remainingDays: z.number().int().min(0),
      })
      .strict(),
    lessons: z
      .object({
        kind: z.literal('not_implemented'),
      })
      .strict(),
    progress: z
      .object({
        kind: z.literal('unavailable_until_phase_3'),
      })
      .strict(),
  })
  .strict()
  .refine(
    (r) => {
      // Ban any answer-key or internal fields
      const keys = Object.keys(r);
      const banned = [
        'correctOptionId',
        'correct_option_id',
        'correctAnswer',
        'answerKey',
        'isCorrect',
        'gradingKey',
        'internal_note',
        'reviewed_by',
        'receipt_file',
      ];
      for (const k of keys) {
        if (banned.includes(k)) return false;
      }
      return true;
    },
    { message: 'Response contains prohibited fields' },
  );
