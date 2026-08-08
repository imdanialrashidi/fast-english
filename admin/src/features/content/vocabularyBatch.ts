// admin/src/features/content/vocabularyBatch.ts
// Podcast Slice 4 — fast-entry vocabulary paste parser.
//
// Accepts tab/newline separated rows: `word<TAB>meaning<TAB>definition`.
// The parsed rows are PREVIEWED before saving; the server still enforces
// the 100-word maximum and duplicate normalization.

export interface ParsedVocabRow {
  term: string;
  meaningFa: string;
  definitionEn: string;
}

export interface BatchParseResult {
  rows: ParsedVocabRow[];
  /** Rows skipped because a required column was empty. */
  skipped: number;
  /** Whether any row was truncated to the field limits. */
  truncated: boolean;
}

const TERM_MAX = 200;
const MEANING_MAX = 500;
const DEFINITION_MAX = 500;

/**
 * Parses batch text: one entry per line, columns split on TAB (falling
 * back to 2+ spaces for convenience). Lines with fewer than three
 * columns are skipped. Values are trimmed and truncated to the schema
 * field limits.
 */
export function parseVocabularyBatch(text: string): BatchParseResult {
  const rows: ParsedVocabRow[] = [];
  let skipped = 0;
  let truncated = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\uFEFF/, '');
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const cells = parts.length >= 3 ? parts : line.split(/\s{2,}/);
    if (cells.length < 3) {
      skipped++;
      continue;
    }
    const term = cells[0].trim();
    const meaningFa = cells[1].trim();
    const definitionEn = cells[2].trim();
    if (!term || !meaningFa || !definitionEn) {
      skipped++;
      continue;
    }
    if (
      term.length > TERM_MAX ||
      meaningFa.length > MEANING_MAX ||
      definitionEn.length > DEFINITION_MAX
    ) {
      truncated = true;
    }
    rows.push({
      term: term.slice(0, TERM_MAX),
      meaningFa: meaningFa.slice(0, MEANING_MAX),
      definitionEn: definitionEn.slice(0, DEFINITION_MAX),
    });
  }
  return { rows, skipped, truncated };
}
