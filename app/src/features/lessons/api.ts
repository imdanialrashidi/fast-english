// app/src/features/lessons/api.ts
// Typed API wrappers for lesson custom routes.

import { getPocketBase } from '../../lib/pocketbase';
import type {
  LessonDetailResponse,
  LessonListResponse,
  PublicSampleResponse,
  VocabularyResponse,
} from './types';

const API_BASE = '/api/fast-english';

function pb() {
  return getPocketBase();
}

/**
 * Resolve a root-relative `/api/...` path to an absolute URL through the
 * SDK origin. On native (Capacitor) builds the WebView origin
 * (`https://localhost`) is not the API origin, so every network sink in
 * this module must resolve paths before use. Only call with paths that
 * start with `/api/` — never pass arbitrary external URLs through it.
 */
function resolveApiUrl(path: string): string {
  return pb().buildURL(path);
}

/**
 * Resolve a server-returned public media path (e.g.
 * `/api/fast-english/public/sample/audio`) to an absolute URL for
 * `<audio>`/`<source>` elements. Public media only — never attaches a
 * file token; use `buildProtectedAudioUrl` for premium audio.
 */
export function resolveMediaUrl(path: string): string {
  return resolveApiUrl(path);
}

/**
 * Premium lesson list. `level` is the temporary browsing level (defaults to
 * the server-side preferred level when omitted). Browsing another level is
 * read-only: it never changes the Placement result, the preferred level,
 * Progress, or the Subscription.
 */
export async function getLessonList(
  page = 1,
  perPage = 50,
  level?: string,
): Promise<LessonListResponse> {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  if (level) params.set('level', level);
  const raw = await pb().send<Record<string, unknown>>(`${API_BASE}/lessons?${params.toString()}`, {
    method: 'GET',
  });
  return raw as unknown as LessonListResponse;
}

export async function getLessonDetail(lessonId: string): Promise<LessonDetailResponse> {
  const raw = await pb().send<Record<string, unknown>>(`${API_BASE}/lessons/${lessonId}`, {
    method: 'GET',
  });
  return raw as unknown as LessonDetailResponse;
}

/**
 * Slice 7 — per-Variant Student vocabulary (ordered by the authoritative
 * server sort order; pronunciation paths are the protected proxy routes).
 */
export async function getLessonVocabulary(lessonId: string): Promise<VocabularyResponse> {
  const raw = await pb().send<Record<string, unknown>>(
    `${API_BASE}/lessons/${lessonId}/vocabulary`,
    { method: 'GET' },
  );
  return raw as unknown as VocabularyResponse;
}

export async function getPublicSample(): Promise<PublicSampleResponse> {
  const raw = await fetch(resolveApiUrl(`${API_BASE}/public/sample`), {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  // Minimal guard: non-2xx (e.g. 5xx from the proxy) must not be parsed
  // as a valid sample; it falls through the existing catch → error phase.
  // `sample_unavailable` arrives with HTTP 200 and keeps its path.
  if (!raw.ok) {
    throw new Error(`public sample request failed: ${raw.status}`);
  }
  return (await raw.json()) as PublicSampleResponse;
}

/**
 * Build a premium audio URL for an <audio> element.
 * Obtains a short-lived PB file token and appends it as a query param.
 * The premium audio proxy route validates the file token and checks
 * entitlement at request time. The server-relative path is resolved
 * against the SDK origin first (native builds have no shared browser
 * origin), and the token is appended via URLSearchParams so reserved
 * characters are encoded and an existing query string is preserved.
 * The URL/token are never logged.
 */
export async function buildProtectedAudioUrl(audioUrl: string): Promise<string> {
  const pbClient = pb();
  const fileToken = await pbClient.files.getToken();
  const url = new URL(resolveApiUrl(audioUrl));
  url.searchParams.set('token', fileToken);
  return url.toString();
}
