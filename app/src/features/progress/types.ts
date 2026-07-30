// app/src/features/progress/types.ts
// P3-S2 — Lesson progress types.

export interface LessonProgressResponse {
  lessonId: string;
  positionSeconds: number;
  furthestSeconds: number;
  durationSeconds: number;
  audioDurationSeconds?: number;
  percent: number;
  completed: boolean;
  completedAt: string | null;
  revision: number;
  lastPlayedAt: string | null;
}

export interface SaveProgressRequest {
  positionSeconds: number;
  expectedRevision: number;
}

export interface ProgressSummaryResponse {
  publishedLessonCount: number;
  startedLessonCount: number;
  completedLessonCount: number;
  completionPercent: number;
  totalListeningSeconds: number;
  totalDurationSeconds: number;
  selectedLevel: string;
}

export interface ContinueLessonItem {
  id: string;
  topicId: string;
  topicTitle: string;
  topicSlug: string;
  title: string;
  level: string;
  estimatedMinutes: number;
}

export interface ContinueLessonProgress {
  positionSeconds: number;
  furthestSeconds: number;
  durationSeconds: number;
  percent: number;
  completed: boolean;
}

export type ContinueResponse =
  | {
      kind: 'lesson';
      lesson: ContinueLessonItem;
      progress: ContinueLessonProgress;
    }
  | {
      kind: 'no_lessons';
      message: string;
    }
  | {
      kind: 'all_completed';
      message: string;
    };
