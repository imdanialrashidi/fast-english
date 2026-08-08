// shared/content-package/editorial.ts
// Podcast Slice 3 — deterministic editorial and copy diagnostics.
//
// These checks are intentionally explicit and threshold-based (documented
// in docs/CONTENT_PIPELINE.md). They never judge writing style and never
// use AI; they only catch empty/placeholder content, format violations
// and clearly documented thresholds. Helpful feedback, not censorship.

import {
  DESCRIPTION_FA_MIN_WARN,
  GENERIC_ART_ALT_PATTERNS,
  PLACEHOLDER_PATTERNS,
  TITLE_EN_MAX_WARN,
  TITLE_FA_MAX_WARN,
  TITLE_WORD_REPEAT_MAX,
  TRANSCRIPT_MIN_CHARS_WARN,
  VOCABULARY_COUNT_HIGH_WARN,
} from './constants.ts';
import { normalizeVocabularyTerm, transcriptIsEffectivelyEmpty } from './normalize.ts';
import type { ContentDiagnostic, EpisodeManifest } from './types.ts';

const d = (
  code: string,
  severity: ContentDiagnostic['severity'],
  path: string,
  message: string,
  suggestion?: string,
): ContentDiagnostic => ({ code, severity, path, message, suggestion });

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(value));
}

function titleRepeatedWords(title: string): string[] {
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06FF]+/)
    .filter((w) => w.length > 1);
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n > TITLE_WORD_REPEAT_MAX).map(([w]) => w);
}

/**
 * Copy checks against the manifest only (no filesystem access).
 * Blocking errors: empty/placeholder copy, empty meanings/definitions,
 * unsupported levels, duplicate levels, duplicate normalized vocabulary.
 * Warnings: documented length thresholds, missing optional values,
 * generic alt text, high vocabulary counts, repeated title words.
 */
export function editorialDiagnostics(manifest: EpisodeManifest): ContentDiagnostic[] {
  const out: ContentDiagnostic[] = [];
  const ep = manifest.episode;

  // --- Episode copy ---
  if (!ep.titleEn.trim()) {
    out.push(d('TITLE_EN_EMPTY', 'error', 'episode.titleEn', 'English title is empty.'));
  } else if (ep.titleEn.length > TITLE_EN_MAX_WARN) {
    out.push(
      d(
        'TITLE_EN_TOO_LONG',
        'warning',
        'episode.titleEn',
        `English title is longer than ${TITLE_EN_MAX_WARN} characters.`,
      ),
    );
  } else if (isPlaceholder(ep.titleEn)) {
    out.push(
      d('PLACEHOLDER_VALUE', 'error', 'episode.titleEn', 'English title is still a placeholder.'),
    );
  }
  if (!ep.titleFa.trim()) {
    out.push(d('TITLE_FA_EMPTY', 'error', 'episode.titleFa', 'Persian title is empty.'));
  } else if (ep.titleFa.length > TITLE_FA_MAX_WARN) {
    out.push(
      d(
        'TITLE_FA_TOO_LONG',
        'warning',
        'episode.titleFa',
        `Persian title is longer than ${TITLE_FA_MAX_WARN} characters.`,
      ),
    );
  } else if (isPlaceholder(ep.titleFa)) {
    out.push(
      d('PLACEHOLDER_VALUE', 'error', 'episode.titleFa', 'Persian title is still a placeholder.'),
    );
  }
  if (!ep.descriptionFa.trim()) {
    out.push(
      d('DESCRIPTION_FA_EMPTY', 'error', 'episode.descriptionFa', 'Persian description is empty.'),
    );
  } else if (ep.descriptionFa.trim().length < DESCRIPTION_FA_MIN_WARN) {
    out.push(
      d(
        'DESCRIPTION_FA_TOO_SHORT',
        'warning',
        'episode.descriptionFa',
        `Persian description is shorter than ${DESCRIPTION_FA_MIN_WARN} characters.`,
      ),
    );
  } else if (isPlaceholder(ep.descriptionFa)) {
    out.push(
      d(
        'PLACEHOLDER_VALUE',
        'error',
        'episode.descriptionFa',
        'Persian description is still a placeholder.',
      ),
    );
  }
  if (!ep.artworkAltFa.trim()) {
    out.push(d('ARTWORK_ALT_EMPTY', 'error', 'episode.artworkAltFa', 'Artwork alt text is empty.'));
  } else if (GENERIC_ART_ALT_PATTERNS.some((p) => p.test(ep.artworkAltFa.trim()))) {
    out.push(
      d(
        'ARTWORK_ALT_GENERIC',
        'warning',
        'episode.artworkAltFa',
        'Artwork alt text looks generic.',
      ),
    );
  } else if (isPlaceholder(ep.artworkAltFa)) {
    out.push(
      d(
        'PLACEHOLDER_VALUE',
        'error',
        'episode.artworkAltFa',
        'Artwork alt text is still a placeholder.',
      ),
    );
  }
  const repeated = titleRepeatedWords(`${ep.titleEn} ${ep.titleFa}`);
  for (const w of repeated) {
    out.push(
      d(
        'TITLE_REPEATED_WORDS',
        'warning',
        'episode.titleEn',
        `Word "${w}" is repeated more than ${TITLE_WORD_REPEAT_MAX} times in the title.`,
      ),
    );
  }

  // --- Variants ---
  const seenLevels = new Set<string>();
  for (let i = 0; i < manifest.variants.length; i++) {
    const v = manifest.variants[i];
    const vPath = `variants[${i}]`;
    if (seenLevels.has(v.level)) {
      out.push(
        d(
          'DUPLICATE_VARIANT_LEVEL',
          'error',
          `${vPath}.level`,
          `Level ${v.level} appears more than once.`,
        ),
      );
    }
    seenLevels.add(v.level);
    if (!v.summaryFa.trim()) {
      out.push(
        d('SUMMARY_FA_EMPTY', 'error', `${vPath}.summaryFa`, 'Persian variant summary is empty.'),
      );
    } else if (isPlaceholder(v.summaryFa)) {
      out.push(
        d(
          'PLACEHOLDER_VALUE',
          'error',
          `${vPath}.summaryFa`,
          'Persian variant summary is still a placeholder.',
        ),
      );
    }
    if (v.vocabulary.length === 0) {
      out.push(
        d('VARIANT_NO_VOCABULARY', 'warning', `${vPath}.vocabulary`, 'Variant has no vocabulary.'),
      );
    } else if (v.vocabulary.length > VOCABULARY_COUNT_HIGH_WARN) {
      out.push(
        d(
          'VOCABULARY_COUNT_HIGH',
          'warning',
          `${vPath}.vocabulary`,
          `Variant has more than ${VOCABULARY_COUNT_HIGH_WARN} vocabulary entries.`,
        ),
      );
    }
    const seenTerms = new Set<string>();
    for (let j = 0; j < v.vocabulary.length; j++) {
      const entry = v.vocabulary[j];
      const ePath = `${vPath}.vocabulary[${j}]`;
      if (!entry.term.trim()) {
        out.push(d('VOCAB_TERM_EMPTY', 'error', `${ePath}.term`, 'Vocabulary term is empty.'));
      }
      if (!entry.meaningFa.trim()) {
        out.push(
          d('VOCAB_MEANING_EMPTY', 'error', `${ePath}.meaningFa`, 'Persian meaning is empty.'),
        );
      } else if (isPlaceholder(entry.meaningFa)) {
        out.push(
          d(
            'PLACEHOLDER_VALUE',
            'error',
            `${ePath}.meaningFa`,
            'Persian meaning is still a placeholder.',
          ),
        );
      }
      if (!entry.definitionEn.trim()) {
        out.push(
          d(
            'VOCAB_DEFINITION_EMPTY',
            'error',
            `${ePath}.definitionEn`,
            'English definition is empty.',
          ),
        );
      } else if (isPlaceholder(entry.definitionEn)) {
        out.push(
          d(
            'PLACEHOLDER_VALUE',
            'error',
            `${ePath}.definitionEn`,
            'English definition is still a placeholder.',
          ),
        );
      }
      if (entry.term.trim()) {
        const norm = normalizeVocabularyTerm(entry.term);
        if (seenTerms.has(norm)) {
          out.push(
            d(
              'DUPLICATE_VOCABULARY_TERM',
              'error',
              `${ePath}.term`,
              `Duplicate vocabulary term "${entry.term}" (normalized: "${norm}").`,
            ),
          );
        }
        seenTerms.add(norm);
      }
      if (!entry.exampleSentence) {
        out.push(
          d(
            'VOCAB_NO_EXAMPLE',
            'warning',
            `${ePath}.exampleSentence`,
            'Vocabulary entry has no example sentence.',
          ),
        );
      }
      if (!entry.phonetic) {
        out.push(
          d(
            'VOCAB_NO_PHONETIC',
            'warning',
            `${ePath}.phonetic`,
            'Vocabulary entry has no phonetic.',
          ),
        );
      }
    }
  }
  return out;
}

/**
 * Transcript-level diagnostics (after file normalization). Pure function
 * so it can be unit-tested without the filesystem.
 */
export function transcriptDiagnostics(
  level: string,
  normalized: string,
  rawLength: number,
): ContentDiagnostic[] {
  const out: ContentDiagnostic[] = [];
  const path = `transcripts/${level}`;
  if (rawLength === 0) {
    out.push(d('TRANSCRIPT_EMPTY', 'error', path, 'Transcript file is empty.'));
  } else if (transcriptIsEffectivelyEmpty(normalized)) {
    out.push(
      d(
        'TRANSCRIPT_ONLY_HEADINGS',
        'error',
        path,
        'Transcript contains only headings or whitespace.',
      ),
    );
  } else if (normalized.length < TRANSCRIPT_MIN_CHARS_WARN) {
    out.push(
      d(
        'TRANSCRIPT_TOO_SHORT',
        'warning',
        path,
        `Transcript is shorter than ${TRANSCRIPT_MIN_CHARS_WARN} characters.`,
      ),
    );
  }
  return out;
}
