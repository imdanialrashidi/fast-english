// app/src/features/library/queryState.ts
// Podcast Slice 6 — URL-backed Library discovery state.
//
// The Library reads and writes its discovery state through the URL:
//   /library?q=...&category=...&level=...&progress=...&sort=...&page=...
// so Refresh and Back preserve meaningful state without a state library.
//
// Parsing is tolerant (unknown values fall back to defaults so stale or
// hand-edited URLs degrade safely); serialization omits defaults so URLs
// stay calm. All values are bounded here and re-validated server-side.

import { CEFR_ORDER, normalizeLevel } from '../../../../shared/podcast/domain';
import type { LibraryLevelFilter, LibraryProgressFilter, LibrarySort } from './types';

/** Shared bounds (mirror of the server contract). */
export const LIBRARY_QUERY_LIMITS = {
  /** Max search query length (chars, after trim). */
  q: 60,
  /** Max page number. */
  page: 50,
  /** Max page size. */
  perPage: 50,
} as const;

export const DEFAULT_LIBRARY_PER_PAGE = 12;

export interface LibraryQuery {
  q: string;
  category: string;
  level: LibraryLevelFilter;
  progress: LibraryProgressFilter;
  sort: LibrarySort;
  page: number;
}

export const DEFAULT_LIBRARY_QUERY: LibraryQuery = {
  q: '',
  category: '',
  level: 'preferred',
  progress: 'all',
  sort: 'suggested',
  page: 1,
};

const PROGRESS_FILTERS: readonly LibraryProgressFilter[] = [
  'all',
  'not_started',
  'in_progress',
  'completed',
];

const SORTS: readonly LibrarySort[] = ['suggested', 'latest'];

export function normalizeLevelFilter(value: string | null | undefined): LibraryLevelFilter {
  if (value === 'all' || value === 'preferred') return value;
  const level = normalizeLevel(value);
  if (level) return level;
  return 'preferred';
}

export function normalizeProgressFilter(value: string | null | undefined): LibraryProgressFilter {
  return PROGRESS_FILTERS.includes(value as LibraryProgressFilter)
    ? (value as LibraryProgressFilter)
    : 'all';
}

export function normalizeSort(value: string | null | undefined): LibrarySort {
  return SORTS.includes(value as LibrarySort) ? (value as LibrarySort) : 'suggested';
}

export function clampPage(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(LIBRARY_QUERY_LIMITS.page, Math.max(1, Math.floor(value)));
}

function parsePositiveInt(raw: string | null): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 1;
}

/**
 * Tolerant parse of the current URL search into a bounded LibraryQuery.
 * Unknown/invalid values fall back to defaults; the query string is
 * trimmed and truncated to the shared bound.
 */
export function parseLibraryQuery(search: string): LibraryQuery {
  const params = new URLSearchParams(search);
  const rawQ = (params.get('q') ?? '').trim();
  return {
    q: rawQ.slice(0, LIBRARY_QUERY_LIMITS.q),
    category: (params.get('category') ?? '').trim().slice(0, 100),
    level: normalizeLevelFilter(params.get('level')),
    progress: normalizeProgressFilter(params.get('progress')),
    sort: normalizeSort(params.get('sort')),
    page: clampPage(parsePositiveInt(params.get('page'))),
  };
}

/**
 * Serialize a LibraryQuery to a URL search string, omitting defaults.
 * Explicit level filters (A1–C2) are preserved; `preferred`/`all` are the
 * server-side default resolution and are omitted.
 */
export function libraryQueryToSearch(query: LibraryQuery): string {
  const params = new URLSearchParams();
  const q = query.q.trim().slice(0, LIBRARY_QUERY_LIMITS.q);
  if (q) params.set('q', q);
  if (query.category) params.set('category', query.category);
  if (query.level !== 'preferred') params.set('level', query.level);
  if (query.progress !== 'all') params.set('progress', query.progress);
  if (query.sort !== 'suggested') params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(clampPage(query.page)));
  return params.toString();
}

/** True when two queries select the same result set (ignores page). */
export function sameLibraryBase(a: LibraryQuery, b: LibraryQuery): boolean {
  return (
    a.q === b.q &&
    a.category === b.category &&
    a.level === b.level &&
    a.progress === b.progress &&
    a.sort === b.sort
  );
}

/**
 * Apply a patch to a query. Changing any discovery field resets the page
 * to 1 (the results set changed); the page is bounded and the query
 * trimmed. `level` omits are normalized to the default.
 */
export function withLibraryPatch(query: LibraryQuery, patch: Partial<LibraryQuery>): LibraryQuery {
  const baseChanged =
    patch.q !== undefined ||
    patch.category !== undefined ||
    patch.level !== undefined ||
    patch.progress !== undefined ||
    patch.sort !== undefined;
  const next: LibraryQuery = {
    q: (patch.q ?? query.q).trim().slice(0, LIBRARY_QUERY_LIMITS.q),
    category: (patch.category ?? query.category).trim().slice(0, 100),
    level: normalizeLevelFilter(patch.level ?? query.level),
    progress: normalizeProgressFilter(patch.progress ?? query.progress),
    sort: normalizeSort(patch.sort ?? query.sort),
    page: baseChanged ? 1 : clampPage(patch.page ?? query.page),
  };
  return next;
}

/** The canonical CEFR order used by the Level filter labels. */
export const CEFR_LEVEL_FILTERS: readonly string[] = [...CEFR_ORDER];
