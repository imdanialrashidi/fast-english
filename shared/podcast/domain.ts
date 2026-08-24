// shared/podcast/domain.ts
// Podcast Slice 2 — client-side mirror of the server Podcast domain rules
// (server/pb_hooks/podcast_domain.pb.js).
//
// This module is the documented contract for the pure normalization rules:
// CEFR ordering, level normalization, recommended/preferred fallback,
// vocabulary normalization, artwork fallback resolution and legacy
// migration mapping. The PocketBase hooks remain authoritative at runtime;
// this mirror is what unit tests and the future Library/Episode UI build on.
//
// Level semantics (docs/PODCAST_DOMAIN.md):
//   recommendedLevel — Placement result (educational guidance; never
//                      changed by browsing).
//   preferredLevel    — default browsing level (selected_level when valid,
//                      else recommendedLevel).
//   browsingLevel     — temporary per-request state, never persisted.

// Keep in sync with shared/podcast/domain.ts (tests/cefr-consistency.test.mjs).
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type CefrLevel = (typeof CEFR_ORDER)[number];

const CEFR_SET: ReadonlySet<string> = new Set(CEFR_ORDER);

/** Canonical level from any input; '' when not a valid CEFR level. */
export function normalizeLevel(level: unknown): CefrLevel | '' {
  const s = typeof level === 'string' ? level : String(level ?? '');
  const trimmed = s.trim();
  return CEFR_SET.has(trimmed) ? (trimmed as CefrLevel) : '';
}

/**
 * recommendedLevel from a Placement-aware Student payload.
 * Source of truth: user.suggested_level; fallback: attempt.suggested_level.
 * Invalid legacy values produce '' (safe fallback, never a crash).
 */
export function getRecommendedLevel(student: { suggested_level?: string | null }): CefrLevel | '' {
  return normalizeLevel(student.suggested_level ?? '');
}

/**
 * preferredLevel: the existing selected/default-level field when it holds a
 * valid CEFR level, otherwise recommendedLevel. This mapping is the reason
 * no new preferred-level field is added.
 */
export function getPreferredLevel(
  student: { selected_level?: string | null },
  recommendedLevel: CefrLevel | '',
): CefrLevel | '' {
  const selected = normalizeLevel(student.selected_level ?? '');
  return selected || recommendedLevel;
}

/**
 * Default Variant resolution for an Episode (Podcast Slice 6 Library rule,
 * mirror of the server hook):
 *   1. preferredLevel when published for the Episode;
 *   2. recommendedLevel when published;
 *   3. first published Variant in canonical CEFR order.
 * `availableLevels` must be the Episode's published levels. The server
 * route remains authoritative; this pure mirror is what unit tests and
 * the Library contract build on.
 */
export function resolveVariantLevel(
  preferredLevel: CefrLevel | '',
  recommendedLevel: CefrLevel | '',
  availableLevels: readonly string[],
): CefrLevel | '' {
  if (preferredLevel && availableLevels.includes(preferredLevel)) return preferredLevel;
  if (recommendedLevel && availableLevels.includes(recommendedLevel)) return recommendedLevel;
  for (const level of CEFR_ORDER) {
    if (availableLevels.includes(level)) return level;
  }
  return '';
}

/**
 * Deterministic vocabulary term normalization: trim, collapse repeated
 * whitespace, lowercase for uniqueness. No stemming or linguistic
 * transformation; the original display term is stored separately.
 */
export function normalizeVocabularyTerm(term: string): string {
  return term.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Controlled Product fallback artwork URL (served by the artwork proxy). */
export const FALLBACK_ARTWORK_URL = '/api/fast-english/artwork/fallback';

/**
 * Artwork fallback resolution order (mirror of the server chain):
 *   lesson.thumbnail_override -> topic.artwork_square -> Product fallback.
 * The server exposes the already-resolved `episode.artwork`; this function
 * documents and tests the order the Product relies on.
 */
export function resolveArtworkUrl(
  thumbnailOverride: string | null | undefined,
  topicArtwork: string | null | undefined,
): string {
  if (thumbnailOverride) return thumbnailOverride;
  if (topicArtwork) return topicArtwork;
  return FALLBACK_ARTWORK_URL;
}

/** Legacy migration mapping: deterministic content key derived from slug. */
export function legacyContentKey(slug: string): string {
  return `legacy.${slug}`;
}

/** Initial content version for migrated content. */
export const INITIAL_CONTENT_VERSION = 1;

/** Publication states shared by topics/lessons/categories. */
export const PUBLICATION_STATES = ['draft', 'published', 'archived'] as const;

export type PublicationState = (typeof PUBLICATION_STATES)[number];

export function isPublicationState(value: string): value is PublicationState {
  return (PUBLICATION_STATES as readonly string[]).includes(value);
}

/**
 * Publication-status compatibility: the existing `status` enum is the single
 * authoritative publication source for topics/lessons (no Boolean, no
 * duplicate `publication_status` field). `categories` uses
 * `publication_status` (new collection, recommended field name).
 */
export function publicStatusOf(record: {
  status?: string | null;
  publication_status?: string | null;
}): PublicationState | '' {
  const s = String(record.status ?? record.publication_status ?? '');
  return isPublicationState(s) ? s : '';
}

// ---------------------------------------------------------------------------
// Deep Podcast Domain — Episode / Variant / Category anti-corruption layer
// ---------------------------------------------------------------------------
// The DB keeps legacy names `topics` / `lessons` / `categories`; callers
// must speak `Episode` / `Variant` / `Category`. This seam hides the legacy
// names forever — no rename migration needed (see PODCAST_DOMAIN.md).
// ---------------------------------------------------------------------------

export interface CategoryRef {
  id: string;
  key: string;
  slug: string;
  titleFa: string;
}

export interface EpisodeVariantInfo {
  level: CefrLevel;
  variantId: string;
  isRecommended?: boolean;
  isPreferred?: boolean;
}

export interface EpisodeDomain {
  id: string;
  slug: string;
  contentKey: string;
  title: string;
  titleFa: string;
  descriptionFa: string;
  category: CategoryRef | null;
  artwork: string;
  featured: boolean;
  contentVersion: number;
  sortOrder: number;
}

export interface VariantDomain {
  id: string;
  level: CefrLevel;
  summaryFa: string;
  transcript: string;
  audioDurationSeconds: number;
  contentVersion: number;
}

/**
 * Build a domain Episode from raw PB records. Hides `topics` / `lessons`
 * naming — callers never see the DB names. The server remains the
 * authority for publication filtering; this helper only shapes already-
 * filtered records.
 */
export function toEpisodeDomain(
  topic: {
    id: string;
    slug: string;
    content_key?: string;
    title?: string;
    title_fa?: string;
    description_fa?: string;
    artwork_square?: string | null;
    is_featured?: boolean;
    content_version?: number;
    sort_order?: number;
  },
  category: CategoryRef | null,
  artworkUrl: string,
): EpisodeDomain {
  return {
    id: String(topic.id || ''),
    slug: String(topic.slug || ''),
    contentKey: String(topic.content_key || ''),
    title: String(topic.title || ''),
    titleFa: String(topic.title_fa || ''),
    descriptionFa: String(topic.description_fa || ''),
    category,
    artwork: artworkUrl || FALLBACK_ARTWORK_URL,
    featured: Boolean(topic.is_featured),
    contentVersion: Number(topic.content_version || 1),
    sortOrder: Number(topic.sort_order || 0),
  };
}

/**
 * Podcast catalog helper — one call hides the topics→lessons→category
 * bulk-load and CEFR-order stitching that library, home, and episode
 * callers previously duplicated. Pure and testable (no I/O).
 */
export function buildAvailableLevels(
  lessons: Array<{ level: string; id: string }>,
  recommendedLevel: CefrLevel | '',
  preferredLevel: CefrLevel | '',
): EpisodeVariantInfo[] {
  const byLevel: Record<string, string> = {};
  for (const l of lessons) {
    const norm = normalizeLevel(l.level);
    if (norm && !byLevel[norm]) byLevel[norm] = l.id;
  }
  const out: EpisodeVariantInfo[] = [];
  for (const lvl of CEFR_ORDER) {
    if (byLevel[lvl]) {
      out.push({
        level: lvl,
        variantId: byLevel[lvl],
        isRecommended: lvl === recommendedLevel,
        isPreferred: lvl === preferredLevel,
      });
    }
  }
  return out;
}
