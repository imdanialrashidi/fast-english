// app/src/features/placement/types.ts
// Type definitions for the Placement feature.

export interface PlacementOption {
  id: string;
  text: string;
}

export interface PlacementQuestion {
  id: string;
  position: number;
  prompt: string;
  options: PlacementOption[];
}

export interface PlacementAttempt {
  id: string;
  status: 'in_progress' | 'submitted';
  revision: number;
  answeredCount: number;
  totalQuestions: number;
  startedAt: string | null;
  lastSavedAt: string | null;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
}

export type PlacementAnswerMap = Record<string, string>;

export interface PlacementResponse {
  kind: 'in_progress' | 'submitted';
  attempt: PlacementAttempt;
  questions: PlacementQuestion[];
  answers: PlacementAnswerMap;
}

export interface PlacementError {
  code: string;
  message: string;
  data?: PlacementResponse;
}

// --- API request types ---

export interface SaveAnswerInput {
  questionId: string;
  optionId: string;
  expectedRevision: number;
}

export interface SubmitInput {
  expectedRevision: number;
}

// P2-S2 types

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type LevelContextKind =
  | 'placement_required'
  | 'placement_in_progress'
  | 'level_selection_required'
  | 'completed';

export interface LevelContextBase {
  kind: LevelContextKind;
}

export interface PlacementRequired extends LevelContextBase {
  kind: 'placement_required';
}

export interface PlacementInProgress extends LevelContextBase {
  kind: 'placement_in_progress';
  attemptId: string;
  answeredCount: number;
  totalQuestions: number;
}

export interface LevelSelectionRequired extends LevelContextBase {
  kind: 'level_selection_required';
  attemptId: string;
  score: number;
  maxScore: number;
  suggestedLevel: string | null;
  selectedLevel: null;
  placementCompleted: boolean;
}

export interface Completed extends LevelContextBase {
  kind: 'completed';
  attemptId: string;
  score: number;
  maxScore: number;
  suggestedLevel: string | null;
  selectedLevel: string | null;
  placementCompleted: boolean;
}

export type LevelContextResponse =
  | PlacementRequired
  | PlacementInProgress
  | LevelSelectionRequired
  | Completed;

export interface SelectLevelRequest {
  selectedLevel: string;
}

export interface SelectLevelResponse {
  kind: 'completed';
  suggestedLevel: string;
  selectedLevel: string;
  placementCompleted: boolean;
}

export interface DashboardResponse {
  student: {
    name: string;
    selectedLevel: string;
    suggestedLevel: string | null;
    placementCompleted: boolean;
  };
  placement: {
    score: number | null;
    maxScore: number | null;
    submittedAt: string | null;
  };
  subscription: {
    planName: string;
    startsAt: string;
    expiresAt: string;
    remainingDays: number;
  };
  lessons: {
    publishedCount: number;
  };
  progress: {
    kind: string;
    startedLessonCount: number;
    completedLessonCount: number;
    publishedLessonCount: number;
    completionPercent: number;
  };
  continueLearning: {
    kind: string;
    lessonId: string;
  };
}
