// app/src/features/library/api.ts
// Podcast Slice 6 — typed wrapper for the Library discovery route.
//
// GET /api/fast-english/library returns the bounded server-side discovery
// contract: published Categories, canonical Episode results with the
// resolved Variant + per-Variant Progress, a Continue Listening rail and
// deterministic pagination. All filtering/sorting/pagination happen on the
// server; this module only serializes the validated query.

import { getPocketBase } from '../../lib/pocketbase';
import type { LibraryParams, LibraryResponse } from './types';

const API_BASE = '/api/fast-english';

/**
 * Fetch one page of the Library discovery contract.
 * `level` defaults to the server-side preferred resolution when omitted;
 * browsing is read-only (never mutates recommended/preferred levels).
 */
export async function getLibrary(params: LibraryParams): Promise<LibraryResponse> {
  const qp = new URLSearchParams();
  if (params.q) qp.set('q', params.q);
  if (params.category) qp.set('category', params.category);
  if (params.level && params.level !== 'preferred') qp.set('level', params.level);
  if (params.progress && params.progress !== 'all') qp.set('progress', params.progress);
  if (params.sort && params.sort !== 'suggested') qp.set('sort', params.sort);
  if (params.page && params.page > 1) qp.set('page', String(params.page));
  if (params.perPage) qp.set('perPage', String(params.perPage));
  const raw = await getPocketBase().send<Record<string, unknown>>(
    `${API_BASE}/library?${qp.toString()}`,
    { method: 'GET' },
  );
  return raw as unknown as LibraryResponse;
}
