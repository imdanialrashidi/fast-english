// app/src/features/progress/api.ts
// P3-S2 — Typed API wrappers for progress custom routes.

import { getPocketBase } from '../../lib/pocketbase';
import type {
  ContinueResponse,
  LessonProgressResponse,
  ProgressSummaryResponse,
  SaveProgressRequest,
} from './types';

const API_BASE = '/api/fast-english';

function pb() {
  return getPocketBase();
}

export async function getLessonProgress(lessonId: string): Promise<LessonProgressResponse> {
  const raw = await pb().send<Record<string, unknown>>(`${API_BASE}/lessons/${lessonId}/progress`, {
    method: 'GET',
  });
  return raw as unknown as LessonProgressResponse;
}

export async function saveLessonProgress(
  lessonId: string,
  input: SaveProgressRequest,
): Promise<LessonProgressResponse> {
  const raw = await pb().send<Record<string, unknown>>(`${API_BASE}/lessons/${lessonId}/progress`, {
    method: 'PUT',
    body: input,
  });
  return raw as unknown as LessonProgressResponse;
}

export async function getProgressSummary(): Promise<ProgressSummaryResponse> {
  const raw = await pb().send<Record<string, unknown>>(`${API_BASE}/progress/summary`, {
    method: 'GET',
  });
  return raw as unknown as ProgressSummaryResponse;
}

export async function getContinueLearning(): Promise<ContinueResponse> {
  const raw = await pb().send<Record<string, unknown>>(`${API_BASE}/progress/continue`, {
    method: 'GET',
  });
  return raw as unknown as ContinueResponse;
}
