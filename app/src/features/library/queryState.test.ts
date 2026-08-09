// app/src/features/library/queryState.test.ts
// Podcast Slice 6 — URL-backed discovery state (pure parser/serializer).

import { describe, expect, it } from 'vitest';
import {
  clampPage,
  DEFAULT_LIBRARY_QUERY,
  LIBRARY_QUERY_LIMITS,
  libraryQueryToSearch,
  normalizeLevelFilter,
  normalizeProgressFilter,
  normalizeSort,
  parseLibraryQuery,
  sameLibraryBase,
  withLibraryPatch,
} from './queryState';

describe('parseLibraryQuery', () => {
  it('parses a full discovery URL', () => {
    const q = parseLibraryQuery(
      'q=hello&category=cat1&level=B2&progress=in_progress&sort=latest&page=3',
    );
    expect(q).toEqual({
      q: 'hello',
      category: 'cat1',
      level: 'B2',
      progress: 'in_progress',
      sort: 'latest',
      page: 3,
    });
  });

  it('falls back to defaults for empty and unknown input', () => {
    expect(parseLibraryQuery('')).toEqual(DEFAULT_LIBRARY_QUERY);
    const q = parseLibraryQuery('level=XYZ&progress=weird&sort=popular&page=abc&category=%20%20');
    expect(q.level).toBe('preferred');
    expect(q.progress).toBe('all');
    expect(q.sort).toBe('suggested');
    expect(q.page).toBe(1);
    expect(q.category).toBe('');
  });

  it('trims the query and truncates it to the shared bound', () => {
    const long = `${'a'.repeat(80)}`;
    const q = parseLibraryQuery(`q=%20${long}%20`);
    expect(q.q).toBe('a'.repeat(LIBRARY_QUERY_LIMITS.q));
    expect(q.q.length).toBe(60);
  });

  it('clamps page numbers into the bounded range', () => {
    expect(parseLibraryQuery('page=999').page).toBe(LIBRARY_QUERY_LIMITS.page);
    expect(parseLibraryQuery('page=0').page).toBe(1);
    expect(parseLibraryQuery('page=-4').page).toBe(1);
  });

  it('normalizes level values', () => {
    expect(normalizeLevelFilter('preferred')).toBe('preferred');
    expect(normalizeLevelFilter('all')).toBe('all');
    expect(normalizeLevelFilter('A1')).toBe('A1');
    expect(normalizeLevelFilter('C2')).toBe('C2');
    expect(normalizeLevelFilter('c1')).toBe('preferred');
    expect(normalizeLevelFilter('')).toBe('preferred');
  });

  it('normalizes progress and sort values', () => {
    expect(normalizeProgressFilter('completed')).toBe('completed');
    expect(normalizeProgressFilter('nope')).toBe('all');
    expect(normalizeSort('latest')).toBe('latest');
    expect(normalizeSort('trending')).toBe('suggested');
  });
});

describe('libraryQueryToSearch', () => {
  it('omits every default so URLs stay calm', () => {
    expect(libraryQueryToSearch(DEFAULT_LIBRARY_QUERY)).toBe('');
  });

  it('round-trips a full query', () => {
    const query = {
      q: 'گوش دادن',
      category: 'cat-9',
      level: 'B1' as const,
      progress: 'completed' as const,
      sort: 'latest' as const,
      page: 2,
    };
    const search = libraryQueryToSearch(query);
    expect(parseLibraryQuery(search)).toEqual(query);
  });

  it('serializes explicit level filters but not the default resolution', () => {
    expect(libraryQueryToSearch({ ...DEFAULT_LIBRARY_QUERY, level: 'A2' })).toBe('level=A2');
    expect(libraryQueryToSearch({ ...DEFAULT_LIBRARY_QUERY, level: 'all' })).toBe('level=all');
    expect(libraryQueryToSearch({ ...DEFAULT_LIBRARY_QUERY, level: 'preferred' })).toBe('');
  });
});

describe('withLibraryPatch', () => {
  it('resets the page when a discovery field changes', () => {
    const base = { ...DEFAULT_LIBRARY_QUERY, page: 4 };
    expect(withLibraryPatch(base, { level: 'B1' }).page).toBe(1);
    expect(withLibraryPatch(base, { q: 'x' }).page).toBe(1);
    expect(withLibraryPatch(base, { sort: 'latest' }).page).toBe(1);
  });

  it('keeps the page when only paging changes', () => {
    expect(withLibraryPatch(DEFAULT_LIBRARY_QUERY, { page: 3 }).page).toBe(3);
  });

  it('bounds and trims patches', () => {
    const patched = withLibraryPatch(DEFAULT_LIBRARY_QUERY, { q: '  big  ' });
    expect(patched.q).toBe('big');
    const paged = withLibraryPatch(DEFAULT_LIBRARY_QUERY, { page: 999 });
    expect(paged.page).toBe(LIBRARY_QUERY_LIMITS.page);
  });

  it('normalizes loose patch values', () => {
    const patched = withLibraryPatch(DEFAULT_LIBRARY_QUERY, {
      level: 'ZZ' as never,
      progress: 'zz' as never,
      sort: 'zz' as never,
    });
    expect(patched.level).toBe('preferred');
    expect(patched.progress).toBe('all');
    expect(patched.sort).toBe('suggested');
  });
});

describe('sameLibraryBase', () => {
  it('ignores the page when comparing result sets', () => {
    expect(
      sameLibraryBase({ ...DEFAULT_LIBRARY_QUERY, page: 1 }, { ...DEFAULT_LIBRARY_QUERY, page: 9 }),
    ).toBe(true);
    expect(
      sameLibraryBase({ ...DEFAULT_LIBRARY_QUERY, level: 'B1' }, { ...DEFAULT_LIBRARY_QUERY }),
    ).toBe(false);
  });
});

describe('clampPage', () => {
  it('clamps non-finite and out-of-range values', () => {
    expect(clampPage(Number.NaN)).toBe(1);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(1.9)).toBe(1);
    expect(clampPage(999)).toBe(LIBRARY_QUERY_LIMITS.page);
  });
});
