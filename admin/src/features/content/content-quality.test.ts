// admin/src/features/content/content-quality.test.ts
// Podcast Slice 4 — focused unit tests for the Content Studio helpers:
// readiness presentation, error-copy mapping, completeness, import-plan
// presentation, no_change/stale copy, unsaved-state transitions, CEFR
// order reuse and absence of duplicated validation constants.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CEFR_ORDER } from '../../../../shared/podcast/domain';
import { ApiError, contentErrorCopy, resolveContentError, safeErrorMessage } from './errors';
import {
  formatDuration,
  importCounts,
  LEVELS,
  planRows,
  readinessSummary,
  statusLabel,
  validationStatus,
  variantCompleteness,
} from './presentation';
import type { ImportPlanResponse, VariantReadiness } from './types';
import { unsavedReducer } from './unsaved';
import { parseVocabularyBatch } from './vocabularyBatch';

const repoRoot = process.cwd();
const contentDir = resolve(repoRoot, 'admin', 'src', 'features', 'content');

function readFeatureSources(): string {
  const files = [
    'presentation.ts',
    'components/LevelMatrix.tsx',
    'components/VocabularyEditor.tsx',
    'components/AudioWorkspace.tsx',
    'components/ArtworkWorkspace.tsx',
    'routes/ImportRoute.tsx',
    'routes/EpisodeEditorRoute.tsx',
    'routes/VariantEditorRoute.tsx',
  ];
  return files.map((f) => readFileSync(resolve(contentDir, f), 'utf8')).join('\n');
}

describe('CEFR order reuse (no duplicated constants)', () => {
  it('LEVELS is the canonical shared CEFR_ORDER', () => {
    expect(LEVELS).toEqual([...CEFR_ORDER]);
    expect(LEVELS).toHaveLength(6);
  });

  it('no feature source defines its own CEFR level array literal', () => {
    const src = readFeatureSources();
    // Canonical order spelled out again would be a duplication; the
    // canonical array lives in shared/podcast/domain.ts.
    expect(src).not.toMatch(/\[['"](A1|A2|B1|B2|C1|C2)['"],\s*['"](A1|A2|B1|B2|C1|C2)['"]/);
  });

  it('asset limits are not re-declared as magic numbers in feature code', () => {
    const src = readFeatureSources();
    // Limits come from the shared pipeline constants (server + CLI).
    // The components may reference documented client-side preview
    // checks; those must not silently diverge from the canonical values.
    expect(src).not.toMatch(/50_000/);
    expect(src).not.toMatch(/5 \* 1024 \* 1024/);
  });
});

describe('statusLabel / formatDuration', () => {
  it('maps publication states to Persian copy', () => {
    expect(statusLabel('draft')).toBe('پیشنویس');
    expect(statusLabel('published')).toBe('منتشر شده');
    expect(statusLabel('archived')).toBe('آرشیو شده');
  });

  it('formats durations as m:ss', () => {
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(61)).toBe('01:01');
  });
});

describe('variant completeness', () => {
  const ready: VariantReadiness = {
    present: true,
    status: 'draft',
    ready: false,
    legacy: false,
    errors: [],
    warnings: [],
    preconditions: [],
  };
  const missingTranscript: VariantReadiness = {
    ...ready,
    errors: [{ code: 'VARIANT_TRANSCRIPT_MISSING', message: 'متن تنظیم نشده' }],
  };

  it('reports indicators from the server payload', () => {
    const c = variantCompleteness({
      audioPresent: true,
      audioDurationSeconds: 60,
      summaryFa: 'خلاصه',
      vocabularyCount: 8,
      readiness: ready,
    });
    expect(c.audio).toBe(true);
    expect(c.transcript).toBe(true);
    expect(c.summary).toBe(true);
    expect(c.duration).toBe(true);
    expect(c.vocabularyCount).toBe(8);
  });

  it('treats a transcript-missing readiness error as incomplete', () => {
    const c = variantCompleteness({
      audioPresent: false,
      audioDurationSeconds: 0,
      summaryFa: '',
      vocabularyCount: 0,
      readiness: missingTranscript,
    });
    expect(c.transcript).toBe(false);
    expect(c.audio).toBe(false);
  });

  it('readinessSummary distinguishes created states', () => {
    expect(readinessSummary(null)).toBe('ایجاد نشده');
    expect(readinessSummary({ ...ready, status: 'published' })).toBe('منتشر شده');
    expect(readinessSummary({ ...ready, status: 'archived' })).toBe('آرشیو شده');
    expect(readinessSummary({ ...ready, errors: [{ code: 'X', message: 'x' }] })).toBe('پیشنویس');
    expect(
      readinessSummary({
        ...ready,
        preconditions: [{ code: 'EPISODE_NOT_PUBLISHED', message: 'x' }],
      }),
    ).toContain('ابتدا اپیزود را منتشر کنید');
  });
});

describe('error copy mapping', () => {
  it('maps known content codes to Persian copy', () => {
    expect(contentErrorCopy('VOCAB_TERM_DUPLICATE', 'raw')).toBe(
      'این واژه قبلاً در این نسخه ثبت شده است.',
    );
    expect(contentErrorCopy('plan_stale', 'raw')).toContain('محتوا از زمان بررسی تغییر کرده');
    expect(contentErrorCopy('published_media_locked', 'raw')).toContain('منتشرشده ممکن نیست');
  });

  it('resolveContentError keeps the internal code for the support area', () => {
    const err = new ApiError(409, 'VOCAB_TERM_DUPLICATE', 'raw message');
    const resolved = resolveContentError(err);
    expect(resolved.message).toBe('این واژه قبلاً در این نسخه ثبت شده است.');
    expect(resolved.code).toBe('VOCAB_TERM_DUPLICATE');
  });

  it('resolveContentError surfaces server issues arrays', () => {
    const err = new ApiError(400, 'not_ready', 'raw', { issues: ['صوت ندارد', 'متن ندارد'] });
    const resolved = resolveContentError(err);
    expect(resolved.issues).toEqual(['صوت ندارد', 'متن ندارد']);
  });

  it('never leaks internal details into the safe message', () => {
    const resolved = resolveContentError(new Error('SELECT * FROM topics; stack trace'));
    expect(resolved.message).toBe('خطایی رخ داد؛ دوباره تلاش کنید.');
    expect(safeErrorMessage('anything')).toBe('خطایی رخ داد؛ دوباره تلاش کنید.');
  });
});

describe('import plan presentation', () => {
  const plan: ImportPlanResponse = {
    result: 'update',
    planStateHash: 'a'.repeat(64),
    contentKey: 'general.pyramids',
    contentVersion: 2,
    fingerprint: 'f'.repeat(64),
    category: { key: 'general', action: 'reuse' },
    episode: { action: 'update' },
    variants: [
      { level: 'C1', action: 'none', reason: 'no_change' },
      { level: 'B1', action: 'update' },
      { level: 'B2', action: 'create' },
    ],
    vocabulary: [
      { level: 'C1', count: 6 },
      { level: 'B1', count: 8 },
      { level: 'B2', count: 5 },
    ],
    media: { uploads: ['audio/b2.mp3'] },
    publication: { targetState: 'draft' },
    summary: {
      episodesCreate: 0,
      episodesUpdate: 1,
      variantsCreate: 1,
      variantsUpdate: 1,
      vocabularyCreate: 19,
      mediaUpload: 4,
    },
  };

  it('planRows order the variants canonically (B1, B2, C1)', () => {
    const rows = planRows(plan);
    expect(rows.map((r) => r.level)).toEqual(['B1', 'B2', 'C1']);
    expect(rows[0].actionCopy).toBe('بهروزرسانی');
    expect(rows[1].actionCopy).toBe('ایجاد');
    expect(rows[2].actionCopy).toBe('بدون تغییر');
    expect(rows[0].vocabularyCount).toBe(8);
  });

  it('importCounts totals created/updated/no-change without inventing data', () => {
    const counts = importCounts(plan);
    expect(counts.created).toBe(1); // B2 variant
    expect(counts.updated).toBe(2); // episode + B1
    expect(counts.noChange).toBe(1); // C1
    expect(counts.importedLevels).toEqual(['B1', 'B2']);
  });

  it('validationStatus maps error/warning counts to report states', () => {
    expect(validationStatus([{ code: 'X' }], []).label).toBe('نامعتبر');
    expect(validationStatus([], [{ code: 'Y' }]).label).toBe('دارای هشدار');
    expect(validationStatus([], []).label).toBe('معتبر');
  });
});

describe('vocabulary batch paste', () => {
  it('parses tab-separated rows and skips incomplete lines', () => {
    const result = parseVocabularyBatch(
      'pyramid\tهرم\tA large structure.\ntomb\tمقبره\tA burial place.\nbroken line\n',
    );
    expect(result.rows).toHaveLength(2);
    expect(result.skipped).toBe(1);
    expect(result.rows[0]).toEqual({
      term: 'pyramid',
      meaningFa: 'هرم',
      definitionEn: 'A large structure.',
    });
  });

  it('falls back to two-space separators', () => {
    const result = parseVocabularyBatch('monument  یادمان  A structure built to remember.');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].term).toBe('monument');
  });

  it('truncates over-long values and flags it', () => {
    const result = parseVocabularyBatch(`w\t${'م'.repeat(600)}\td`);
    expect(result.truncated).toBe(true);
    expect(result.rows[0].meaningFa).toHaveLength(500);
  });

  it('handles CRLF and BOM', () => {
    const result = parseVocabularyBatch('\uFEFFa\tب\tc\r\nd\tه\te\r\n');
    expect(result.rows).toHaveLength(2);
  });
});

describe('unsaved-state transitions', () => {
  it('dirty marks unsaved; save_ok clears after server ack', () => {
    let model = { isDirty: false, isSaving: false, saveState: null as 'saved' | 'error' | null };
    model = unsavedReducer(model, 'dirty');
    expect(model.isDirty).toBe(true);
    model = unsavedReducer(model, 'save_start');
    expect(model.isSaving).toBe(true);
    // dirty during save is ignored (no double marking)
    model = unsavedReducer(model, 'dirty');
    expect(model.isDirty).toBe(true);
    model = unsavedReducer(model, 'save_ok');
    expect(model).toEqual({ isDirty: false, isSaving: false, saveState: 'saved' });
  });

  it('save_error keeps the edits dirty', () => {
    let model = { isDirty: true, isSaving: true, saveState: null as 'saved' | 'error' | null };
    model = unsavedReducer(model, 'save_error');
    expect(model.isDirty).toBe(true);
    expect(model.isSaving).toBe(false);
    expect(model.saveState).toBe('error');
  });

  it('reset clears without claiming a save', () => {
    const model = unsavedReducer({ isDirty: true, isSaving: false, saveState: null }, 'reset');
    expect(model).toEqual({ isDirty: false, isSaving: false, saveState: null });
  });
});
