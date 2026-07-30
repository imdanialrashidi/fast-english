// app/src/features/lessons/api.ts
// Typed API wrappers for lesson custom routes.

import { getPocketBase } from '../../lib/pocketbase';
import type { LessonDetailResponse, LessonListResponse, PublicSampleResponse } from './types';

const API_BASE = '/api/fast-english';

function pb() {
  return getPocketBase();
}

export async function getLessonList(page = 1, perPage = 50): Promise<LessonListResponse> {
  const raw = await pb().send<Record<string, unknown>>(
    `${API_BASE}/lessons?page=${page}&perPage=${perPage}`,
    { method: 'GET' },
  );
  return raw as unknown as LessonListResponse;
}

export async function getLessonDetail(lessonId: string): Promise<LessonDetailResponse> {
  const raw = await pb().send<Record<string, unknown>>(`${API_BASE}/lessons/${lessonId}`, {
    method: 'GET',
  });
  return raw as unknown as LessonDetailResponse;
}

export async function getPublicSample(): Promise<PublicSampleResponse> {
  const raw = await fetch(`${API_BASE}/public/sample`, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  return (await raw.json()) as PublicSampleResponse;
}

/**
 * Build a premium audio URL for an <audio> element.
 * Obtains a short-lived PB file token and appends it as a query param.
 * The premium audio proxy route validates the file token and checks
 * entitlement at request time.
 */
export async function buildProtectedAudioUrl(audioUrl: string): Promise<string> {
  const pbClient = pb();
  const fileToken = await pbClient.files.getToken();
  return `${audioUrl}?token=${fileToken}`;
}
