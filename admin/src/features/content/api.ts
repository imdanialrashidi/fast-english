// admin/src/features/content/api.ts
// Podcast Slice 4 — Staff Content Studio API client. Every request uses
// the Staff session token; the server enforces requireStaffAdmin.

import { getPocketBase } from '../../auth/pocketbase';
import { ApiError } from './errors';
import type {
  CategorySummary,
  EpisodeDetail,
  EpisodeListItem,
  ImportAuditItem,
  ImportPlanResponse,
  OverviewData,
  PreviewEpisode,
  VariantDetail,
  VariantListItem,
  VocabularyEntry,
} from './types';

function pbUrl(path: string): string {
  const pb = getPocketBase();
  const base = pb.baseUrl ?? '';
  return `${base}${path}`;
}

async function request<T>(
  path: string,
  init: { method?: string; body?: string | FormData; signal?: AbortSignal } = {},
): Promise<T> {
  const pb = getPocketBase();
  const token = pb.authStore.token ?? '';
  const headers: Record<string, string> = { authorization: token };
  if (typeof init.body === 'string') headers['content-type'] = 'application/json';
  const res = await fetch(pbUrl(path), {
    method: init.method ?? 'GET',
    headers,
    body: init.body,
    signal: init.signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.code ?? 'unexpected_error',
      body.message ?? 'Request failed',
      {
        issues: Array.isArray(body.issues) ? body.issues : undefined,
        errorJson: body.errorJson,
        auditId: body.auditId,
      },
    );
  }
  return res.json() as Promise<T>;
}

// --- Overview --------------------------------------------------------------

export function fetchOverview(signal?: AbortSignal): Promise<OverviewData> {
  return request<OverviewData>('/api/fast-english/staff/content/overview', { signal });
}

// --- Categories ------------------------------------------------------------

export function fetchCategories(
  params: { search?: string; status?: string } = {},
  signal?: AbortSignal,
): Promise<{ items: CategorySummary[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  return request(`/api/fast-english/staff/categories?${qs.toString()}`, { signal });
}

export function createCategory(input: {
  title_fa: string;
  title_en: string;
  slug: string;
  description_fa: string;
}): Promise<{ category: CategorySummary }> {
  return request('/api/fast-english/staff/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCategory(
  id: string,
  input: Record<string, string | number | boolean>,
): Promise<{ category: CategorySummary }> {
  return request(`/api/fast-english/staff/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function publishCategory(id: string): Promise<{ category: CategorySummary }> {
  return request(`/api/fast-english/staff/categories/${id}/publish`, {
    method: 'POST',
    body: '{}',
  });
}

export function archiveCategory(id: string): Promise<{ category: CategorySummary }> {
  return request(`/api/fast-english/staff/categories/${id}/archive`, {
    method: 'POST',
    body: '{}',
  });
}

export function toggleCategoryFeatured(id: string): Promise<{ category: CategorySummary }> {
  return request(`/api/fast-english/staff/categories/${id}/feature`, {
    method: 'POST',
    body: '{}',
  });
}

export function reorderCategories(ids: string[]): Promise<{ ok: boolean }> {
  return request('/api/fast-english/staff/categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

// --- Episodes --------------------------------------------------------------

export interface EpisodeListParams {
  search?: string;
  category?: string;
  status?: string;
  missing?: string;
  sort?: string;
}

export function fetchEpisodes(
  params: EpisodeListParams = {},
  signal?: AbortSignal,
): Promise<{ items: EpisodeListItem[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.category) qs.set('category', params.category);
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.missing) qs.set('missing', params.missing);
  if (params.sort) qs.set('sort', params.sort);
  return request(`/api/fast-english/staff/episodes?${qs.toString()}`, { signal });
}

export function fetchEpisode(
  id: string,
  signal?: AbortSignal,
): Promise<{ episode: EpisodeDetail }> {
  return request(`/api/fast-english/staff/episodes/${id}`, { signal });
}

export function createEpisode(input: {
  title_fa: string;
  title: string;
  slug: string;
  description_fa: string;
  category: string;
  episode_number?: number;
  is_featured?: boolean;
}): Promise<{ episode: EpisodeListItem }> {
  return request('/api/fast-english/staff/episodes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEpisode(
  id: string,
  input: Record<string, string | number | boolean | null>,
): Promise<{ episode: EpisodeListItem }> {
  return request(`/api/fast-english/staff/episodes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function publishEpisode(id: string): Promise<{ episode: EpisodeListItem }> {
  return request(`/api/fast-english/staff/episodes/${id}/publish`, { method: 'POST', body: '{}' });
}

export function archiveEpisode(id: string): Promise<{ episode: EpisodeListItem }> {
  return request(`/api/fast-english/staff/episodes/${id}/archive`, { method: 'POST', body: '{}' });
}

export function toggleEpisodeFeatured(id: string): Promise<{ episode: EpisodeListItem }> {
  return request(`/api/fast-english/staff/episodes/${id}/feature`, { method: 'POST', body: '{}' });
}

export function uploadEpisodeMedia(
  id: string,
  field: 'artwork' | 'hero',
  file: File,
): Promise<{ episode: EpisodeListItem }> {
  const fd = new FormData();
  fd.append('media', file);
  return request(`/api/fast-english/staff/episodes/${id}/${field}`, { method: 'POST', body: fd });
}

export function removeEpisodeMedia(
  id: string,
  field: 'artwork' | 'hero',
): Promise<{ episode: EpisodeListItem }> {
  return request(`/api/fast-english/staff/episodes/${id}/${field}`, { method: 'DELETE' });
}

// --- Variants --------------------------------------------------------------

export function createVariant(
  episodeId: string,
  level: string,
): Promise<{ variant: VariantListItem }> {
  return request(`/api/fast-english/staff/episodes/${episodeId}/variants`, {
    method: 'POST',
    body: JSON.stringify({ level }),
  });
}

export function fetchVariant(
  id: string,
  signal?: AbortSignal,
): Promise<{ variant: VariantDetail }> {
  return request(`/api/fast-english/staff/variants/${id}`, { signal });
}

export function updateVariant(
  id: string,
  input: { summary_fa?: string },
): Promise<{ variant: VariantListItem }> {
  return request(`/api/fast-english/staff/variants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function uploadVariantAudio(id: string, file: File): Promise<{ variant: VariantListItem }> {
  const fd = new FormData();
  fd.append('audio', file);
  return request(`/api/fast-english/staff/variants/${id}/audio`, { method: 'POST', body: fd });
}

export function removeVariantAudio(id: string): Promise<{ variant: VariantListItem }> {
  return request(`/api/fast-english/staff/variants/${id}/audio`, { method: 'DELETE' });
}

export function saveTranscript(
  id: string,
  transcript: string,
): Promise<{ variant: VariantListItem }> {
  return request(`/api/fast-english/staff/variants/${id}/transcript`, {
    method: 'PUT',
    body: JSON.stringify({ transcript }),
  });
}

export function publishVariant(id: string): Promise<{ variant: VariantListItem }> {
  return request(`/api/fast-english/staff/variants/${id}/publish`, { method: 'POST', body: '{}' });
}

export function archiveVariant(id: string): Promise<{ variant: VariantListItem }> {
  return request(`/api/fast-english/staff/variants/${id}/archive`, { method: 'POST', body: '{}' });
}

// --- Vocabulary ------------------------------------------------------------

export function fetchVocabulary(
  variantId: string,
  signal?: AbortSignal,
): Promise<{ items: VocabularyEntry[]; total: number }> {
  return request(`/api/fast-english/staff/variants/${variantId}/vocabulary`, { signal });
}

export function createVocabularyEntry(
  variantId: string,
  input: {
    term: string;
    meaning_fa: string;
    definition_en: string;
    phonetic?: string;
    part_of_speech?: string;
    example_sentence?: string;
  },
): Promise<{ vocabulary: VocabularyEntry }> {
  return request(`/api/fast-english/staff/variants/${variantId}/vocabulary`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateVocabularyEntry(
  id: string,
  input: Record<string, string>,
): Promise<{ vocabulary: VocabularyEntry }> {
  return request(`/api/fast-english/staff/vocabulary/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteVocabularyEntry(id: string): Promise<{ ok: boolean }> {
  return request(`/api/fast-english/staff/vocabulary/${id}`, { method: 'DELETE' });
}

export function reorderVocabulary(ids: string[]): Promise<{ ok: boolean }> {
  return request('/api/fast-english/staff/vocabulary/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

export function uploadPronunciation(
  id: string,
  file: File,
): Promise<{ vocabulary: VocabularyEntry }> {
  const fd = new FormData();
  fd.append('pronunciation', file);
  return request(`/api/fast-english/staff/vocabulary/${id}/pronunciation`, {
    method: 'POST',
    body: fd,
  });
}

export function removePronunciation(id: string): Promise<{ vocabulary: VocabularyEntry }> {
  return request(`/api/fast-english/staff/vocabulary/${id}/pronunciation`, { method: 'DELETE' });
}

// --- Preview + media -------------------------------------------------------

export function fetchPreview(episodeId: string, signal?: AbortSignal): Promise<PreviewEpisode> {
  return request(`/api/fast-english/staff/preview/episodes/${episodeId}`, { signal });
}

export function artworkUrl(episodeId: string, kind: 'square' | 'hero' = 'square'): string {
  return pbUrl(`/api/fast-english/staff/media/artwork/${episodeId}?kind=${kind}`);
}

export function audioUrl(variantId: string): string {
  return pbUrl(`/api/fast-english/staff/media/audio/${variantId}`);
}

export function pronunciationUrl(vocabId: string): string {
  return pbUrl(`/api/fast-english/staff/media/pronunciation/${vocabId}`);
}

/** Authorized media bytes as a Blob (used for metadata + previews). */
export async function fetchMediaBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const pb = getPocketBase();
  const token = pb.authStore.token ?? '';
  const res = await fetch(pbUrl(path), { headers: { authorization: token }, signal });
  if (!res.ok) throw new ApiError(res.status, 'media_unavailable', 'رسانه در دسترس نیست.');
  return res.blob();
}

// --- Import ----------------------------------------------------------------

export interface PlanPayloadAsset {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export function requestImportPlan(
  manifest: unknown,
  assets: PlanPayloadAsset[],
  signal?: AbortSignal,
): Promise<ImportPlanResponse> {
  return request('/api/fast-english/staff/content-import/plan', {
    method: 'POST',
    body: JSON.stringify({ manifest: JSON.stringify(manifest), assets }),
    signal,
  });
}

export async function executeImport(
  manifest: unknown,
  assets: Array<{ path: string; bytes: Uint8Array; mimeType: string }>,
  planStateHash: string,
  signal?: AbortSignal,
): Promise<{
  result: string;
  status?: string;
  auditId?: string;
  createdIds?: { episodeId: string; variants: Record<string, { id: string; action: string }> };
  summary?: unknown;
  message?: string;
}> {
  const pb = getPocketBase();
  const token = pb.authStore.token ?? '';
  const fd = new FormData();
  fd.append('manifest', JSON.stringify(manifest));
  for (const asset of assets) {
    const name = asset.path.split('/').pop() ?? 'asset';
    const blob = new Blob([asset.bytes.slice(0)], { type: asset.mimeType });
    fd.append(asset.path, blob, name);
  }
  const res = await fetch(
    pbUrl(
      `/api/fast-english/staff/content-import/execute?planStateHash=${encodeURIComponent(planStateHash)}`,
    ),
    {
      method: 'POST',
      headers: { authorization: token },
      body: fd,
      signal,
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body.code ?? 'unexpected_error',
      body.message ?? 'Request failed',
      {
        issues: Array.isArray(body.issues) ? body.issues : undefined,
        errorJson: body.errorJson,
        auditId: body.auditId,
      },
    );
  }
  return body;
}

export function fetchImportHistory(
  limit = 20,
  signal?: AbortSignal,
): Promise<{ items: ImportAuditItem[]; total: number }> {
  return request(`/api/fast-english/staff/imports?limit=${limit}`, { signal });
}
