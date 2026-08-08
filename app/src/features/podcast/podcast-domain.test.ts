// app/src/features/podcast/podcast-domain.test.ts
// Podcast Slice 2 — pure-rule unit tests for the Podcast domain contract
// (shared/podcast/domain.ts mirrors server/pb_hooks/podcast_domain.pb.js).

import { describe, expect, it } from 'vitest';
import {
  CEFR_ORDER,
  FALLBACK_ARTWORK_URL,
  getPreferredLevel,
  getRecommendedLevel,
  INITIAL_CONTENT_VERSION,
  isPublicationState,
  legacyContentKey,
  normalizeLevel,
  normalizeVocabularyTerm,
  publicStatusOf,
  resolveArtworkUrl,
} from '../../../../shared/podcast/domain';

describe('CEFR ordering', () => {
  it('is the canonical A1..C2 order', () => {
    expect(CEFR_ORDER).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });
});

describe('normalizeLevel', () => {
  it('accepts canonical levels and rejects everything else', () => {
    for (const level of CEFR_ORDER) expect(normalizeLevel(level)).toBe(level);
    expect(normalizeLevel('')).toBe('');
    expect(normalizeLevel(null)).toBe('');
    expect(normalizeLevel(undefined)).toBe('');
    expect(normalizeLevel('B3')).toBe('');
    expect(normalizeLevel('b1')).toBe('');
    expect(normalizeLevel('B 1')).toBe('');
    expect(normalizeLevel('D2')).toBe('');
    expect(normalizeLevel(42)).toBe('');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeLevel(' B2 ')).toBe('B2');
  });

  it('treats the PocketBase empty-select serialization as invalid', () => {
    // PB serializes null selects as "" (Visual Slice 1 AccountRoute fix).
    expect(normalizeLevel('')).toBe('');
  });
});

describe('recommended / preferred fallback', () => {
  it('recommended comes from the Placement result (suggested_level)', () => {
    expect(getRecommendedLevel({ suggested_level: 'B1' })).toBe('B1');
    expect(getRecommendedLevel({ suggested_level: null })).toBe('');
    expect(getRecommendedLevel({ suggested_level: '' })).toBe('');
    expect(getRecommendedLevel({ suggested_level: 'B9' })).toBe('');
    expect(getRecommendedLevel({})).toBe('');
  });

  it('preferred reuses the existing selected_level when valid', () => {
    expect(getPreferredLevel({ selected_level: 'B2' }, 'B1')).toBe('B2');
    expect(getPreferredLevel({ selected_level: 'B2' }, '')).toBe('B2');
  });

  it('preferred falls back to recommended when selected is invalid/empty', () => {
    expect(getPreferredLevel({ selected_level: '' }, 'B1')).toBe('B1');
    expect(getPreferredLevel({ selected_level: null }, 'B1')).toBe('B1');
    expect(getPreferredLevel({ selected_level: 'B9' }, 'B1')).toBe('B1');
    expect(getPreferredLevel({}, 'C2')).toBe('C2');
  });

  it('neither is affected by browsing (pure functions, no mutation inputs)', () => {
    const student = { selected_level: 'B1', suggested_level: 'C2' };
    expect(getPreferredLevel(student, getRecommendedLevel(student))).toBe('B1');
    expect(student.selected_level).toBe('B1');
    expect(student.suggested_level).toBe('C2');
  });

  it('invalid legacy values produce a safe fallback without crashing', () => {
    expect(
      getPreferredLevel({ selected_level: '' }, getRecommendedLevel({ suggested_level: '' })),
    ).toBe('');
  });
});

describe('vocabulary normalization', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeVocabularyTerm('  Hello   World  ')).toBe('hello world');
    expect(normalizeVocabularyTerm('Hello')).toBe('hello');
    expect(normalizeVocabularyTerm('  a\t b\n c  ')).toBe('a b c');
  });

  it('is deterministic (same input, same output)', () => {
    expect(normalizeVocabularyTerm('The  Quick Brown Fox')).toBe(
      normalizeVocabularyTerm('the quick brown fox'),
    );
  });

  it('retains the original display term separately (no stemming)', () => {
    expect(normalizeVocabularyTerm('Running')).toBe('running');
    expect(normalizeVocabularyTerm('RUNNING')).toBe('running');
  });
});

describe('artwork fallback resolution', () => {
  it('follows thumbnail_override -> topic artwork -> Product fallback', () => {
    expect(resolveArtworkUrl('/override.png', '/topic.png')).toBe('/override.png');
    expect(resolveArtworkUrl(null, '/topic.png')).toBe('/topic.png');
    expect(resolveArtworkUrl('', '/topic.png')).toBe('/topic.png');
    expect(resolveArtworkUrl(null, null)).toBe(FALLBACK_ARTWORK_URL);
    expect(resolveArtworkUrl(undefined, '')).toBe(FALLBACK_ARTWORK_URL);
  });

  it('fallback is a controlled Product asset, not a broken image', () => {
    expect(FALLBACK_ARTWORK_URL).toMatch(/^\/api\/fast-english\/artwork\//);
    expect(FALLBACK_ARTWORK_URL.length).toBeGreaterThan(0);
  });
});

describe('publication-status compatibility', () => {
  it('topics/lessons use the existing status enum (single authoritative source)', () => {
    expect(isPublicationState('draft')).toBe(true);
    expect(isPublicationState('published')).toBe(true);
    expect(isPublicationState('archived')).toBe(true);
    expect(isPublicationState('')).toBe(false);
    expect(isPublicationState('is_published')).toBe(false);
  });

  it('maps both status spellings through one helper', () => {
    expect(publicStatusOf({ status: 'published' })).toBe('published');
    expect(publicStatusOf({ publication_status: 'archived' })).toBe('archived');
    expect(publicStatusOf({ status: null })).toBe('');
  });
});

describe('legacy migration mapping', () => {
  it('derives deterministic content keys from slugs', () => {
    expect(legacyContentKey('hello-world')).toBe('legacy.hello-world');
    expect(legacyContentKey('a')).toBe('legacy.a');
    // deterministic: same slug -> same key; never random
    expect(legacyContentKey('hello-world')).toBe(legacyContentKey('hello-world'));
  });

  it('backfills content version 1', () => {
    expect(INITIAL_CONTENT_VERSION).toBe(1);
  });
});
