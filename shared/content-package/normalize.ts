// shared/content-package/normalize.ts
// Podcast Slice 3 — deterministic normalization and format rules shared by
// the CLI pipeline and the server hooks (mirrored in
// content_import_core.pb.js). Vocabulary normalization is the canonical
// Slice 2 function (shared/podcast/domain.ts) — never duplicated.

import type { CefrLevel } from '../podcast/domain.ts';
import { normalizeLevel, normalizeVocabularyTerm } from '../podcast/domain.ts';
import { ASSET_PATH_PATTERN } from './constants.ts';

export { normalizeVocabularyTerm };

/** Episode slug rule: lowercase letters/digits, single hyphens between. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** contentKey rule: starts with a lowercase letter/digit, then [a-z0-9._-]. */
export const CONTENT_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

/** categoryKey rule: lowercase letters/digits, single underscores/hyphens. */
export const CATEGORY_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/** Normalized CEFR level from any input; '' when not a valid level. */
export function normalizeLevelStrict(level: unknown): CefrLevel | '' {
  return normalizeLevel(level);
}

/** Valid Episode slug? */
export function isValidSlug(slug: unknown): boolean {
  return (
    typeof slug === 'string' && slug.length >= 2 && slug.length <= 120 && SLUG_PATTERN.test(slug)
  );
}

/**
 * The stable contentKey contract: `<categoryKey>.<episode.slug>`. The
 * pipeline rejects manifests that diverge from this deterministic form.
 */
export function contentKeyFromParts(categoryKey: string, slug: string): string {
  return `${categoryKey}.${slug}`;
}

/** Structural asset-path safety (mirror of constants.isUnsafeAssetPath). */
export function isSafeAssetPath(path: unknown): boolean {
  if (typeof path !== 'string') return false;
  return ASSET_PATH_PATTERN.test(path) && !path.includes('..');
}

/**
 * Transcript normalization (documented in docs/CONTENT_PIPELINE.md):
 *   - strips a UTF-8 BOM;
 *   - normalizes CRLF / CR to LF;
 *   - trims trailing whitespace on every line;
 *   - collapses runs of 3+ blank lines to a single blank line;
 *   - trims leading/trailing blank lines.
 * Editorial meaning, punctuation, headings, emphasis and paragraph
 * structure are preserved.
 */
export function normalizeTranscriptText(raw: string): string {
  let text = raw.replace(/^\uFEFF/, '');
  text = text.replace(/\r\n?/g, '\n');
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/^\n+|\n+$/g, '');
  return text;
}

/** Is the transcript effectively empty (blank or only headings)? */
export function transcriptIsEffectivelyEmpty(normalized: string): boolean {
  const text = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^#{1,6}\s+/.test(line));
  return text.length === 0;
}
