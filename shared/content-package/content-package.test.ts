// shared/content-package/content-package.test.ts
// Podcast Slice 3 — unit tests for the pure content-package core:
// checksums/fingerprint, normalization, editorial diagnostics, version
// rules, plan building, safe serialization and transcript handling.

import { describe, expect, it } from 'vitest';
import { canonicalJson, packageFingerprint, planStateHash, sha256Hex } from './checksums.ts';
import { ARTWORK_MAX_BYTES, AUDIO_MAX_BYTES, isUnsafeAssetPath } from './constants.ts';
import { editorialDiagnostics, transcriptDiagnostics } from './editorial.ts';
import {
  contentKeyFromParts,
  isValidSlug,
  normalizeTranscriptText,
  normalizeVocabularyTerm,
} from './normalize.ts';
import { validateManifestSchema } from './schema.ts';
import { sanitizeDiagnostics } from './serialize.ts';
import type { EpisodeManifest } from './types.ts';
import { buildPlan, decideImport } from './versioning.ts';

const validManifest: EpisodeManifest = {
  $schema: '../../schemas/episode-package.schema.json',
  schemaVersion: '1.0.0',
  contentKey: 'history.pyramids-of-egypt',
  contentVersion: 1,
  categoryKey: 'history',
  episode: {
    slug: 'pyramids-of-egypt',
    titleEn: 'The Pyramids of Egypt',
    titleFa: 'اهرام مصر',
    descriptionFa: 'روایتی سطح‌بندی‌شده درباره تاریخ و معماری اهرام مصر.',
    artworkSquare: 'artwork/square.webp',
    heroImageWide: 'artwork/hero.webp',
    artworkAltFa: 'نمای اهرام مصر در نور غروب',
    episodeNumber: 1,
    featured: false,
  },
  variants: [
    {
      level: 'B1',
      summaryFa: 'در این اپیزود با تاریخچه و معماری اهرام آشنا می‌شوید.',
      audio: 'audio/b1.mp3',
      transcript: 'transcripts/b1.md',
      vocabulary: [
        {
          term: 'pyramid',
          phonetic: '/ˈpɪrəmɪd/',
          partOfSpeech: 'noun',
          meaningFa: 'هرم',
          definitionEn: 'A large structure with triangular sides.',
          exampleSentence: 'The pyramid was built thousands of years ago.',
        },
      ],
    },
  ],
};

function packageFor(manifest: EpisodeManifest, assets: string[] = []) {
  return {
    manifest,
    fingerprint: packageFingerprint(
      canonicalJson(manifest),
      assets.map((p) => ({ path: p, sizeBytes: 10, sha256: 'a'.repeat(64) })),
    ),
  };
}

describe('sha256Hex (NIST vectors)', () => {
  const cases: Array<[string, string]> = [
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    [
      'The quick brown fox jumps over the lazy dog',
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    ],
  ];
  it.each(cases)('sha256(%j) matches the NIST vector', (input, expected) => {
    expect(sha256Hex(new TextEncoder().encode(input))).toBe(expected);
  });
});

describe('packageFingerprint', () => {
  it('is stable for identical content (sorted assets, canonical manifest)', () => {
    const a = packageFingerprint(canonicalJson(validManifest), [
      { path: 'audio/b1.mp3', sizeBytes: 100, sha256: 'x'.repeat(64) },
      { path: 'artwork/square.webp', sizeBytes: 50, sha256: 'y'.repeat(64) },
    ]);
    const b = packageFingerprint(canonicalJson(validManifest), [
      { path: 'artwork/square.webp', sizeBytes: 50, sha256: 'y'.repeat(64) },
      { path: 'audio/b1.mp3', sizeBytes: 100, sha256: 'x'.repeat(64) },
    ]);
    expect(a).toBe(b);
  });
  it('changes when an asset checksum changes', () => {
    const base = {
      path: 'audio/b1.mp3',
      sizeBytes: 100,
      sha256: 'x'.repeat(64),
    };
    const a = packageFingerprint(canonicalJson(validManifest), [base]);
    const b = packageFingerprint(canonicalJson(validManifest), [
      { ...base, sha256: 'z'.repeat(64) },
    ]);
    expect(a).not.toBe(b);
  });
  it('changes when the manifest content changes', () => {
    const modified = { ...validManifest, contentVersion: 2 };
    const a = packageFingerprint(canonicalJson(validManifest), []);
    const b = packageFingerprint(canonicalJson(modified), []);
    expect(a).not.toBe(b);
  });
  it('is independent of manifest property ordering', () => {
    const reordered = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    // Move variants first, then episode — canonical form must be identical.
    const keys = Object.keys(reordered);
    const rebuilt: Record<string, unknown> = {};
    for (const k of [...keys].reverse())
      rebuilt[k] = (reordered as unknown as Record<string, unknown>)[k];
    const a = canonicalJson(validManifest);
    const b = canonicalJson(rebuilt);
    expect(a).toBe(b);
  });
});

describe('planStateHash', () => {
  const state = {
    contentKey: 'history.pyramids-of-egypt',
    episode: { status: 'published', contentVersion: 1, previousFingerprint: 'f1' },
    variants: { B1: { status: 'published', contentVersion: 1 } },
    categoryExists: true,
  };
  it('is deterministic', () => {
    expect(planStateHash(state)).toBe(planStateHash(state));
  });
  it('changes when the episode version changes (stale-plan detection)', () => {
    expect(planStateHash(state)).not.toBe(
      planStateHash({ ...state, episode: { ...state.episode, contentVersion: 2 } }),
    );
  });
});

describe('isUnsafeAssetPath', () => {
  it('accepts normal package-relative paths', () => {
    expect(isUnsafeAssetPath('artwork/square.webp')).toBe(false);
    expect(isUnsafeAssetPath('audio/b1.mp3')).toBe(false);
    expect(isUnsafeAssetPath('transcripts/b1.md')).toBe(false);
  });
  it('rejects traversal, absolute, drive, UNC and encoded paths', () => {
    expect(isUnsafeAssetPath('../secret.txt')).toBe(true);
    expect(isUnsafeAssetPath('a/../../b.mp3')).toBe(true);
    expect(isUnsafeAssetPath('/etc/passwd')).toBe(true);
    expect(isUnsafeAssetPath('C:\\windows\\x')).toBe(true);
    expect(isUnsafeAssetPath('\\\\server\\share')).toBe(true);
    expect(isUnsafeAssetPath('a%2e%2eb')).toBe(true);
    expect(isUnsafeAssetPath('a\u0000b')).toBe(true);
    expect(isUnsafeAssetPath('a\\b.mp3')).toBe(true);
    expect(isUnsafeAssetPath('')).toBe(true);
  });
});

describe('normalizeVocabularyTerm (Slice 2 canonical rule)', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeVocabularyTerm('  PyraMid  of   Giza ')).toBe('pyramid of giza');
  });
});

describe('isValidSlug / contentKeyFromParts', () => {
  it('accepts kebab-case slugs and rejects others', () => {
    expect(isValidSlug('pyramids-of-egypt')).toBe(true);
    expect(isValidSlug('pyramids_of_egypt')).toBe(false);
    expect(isValidSlug('Pyramids')).toBe(false);
    expect(isValidSlug('--x')).toBe(false);
    expect(isValidSlug('x-')).toBe(false);
  });
  it('builds the canonical contentKey', () => {
    expect(contentKeyFromParts('history', 'pyramids-of-egypt')).toBe('history.pyramids-of-egypt');
  });
});

describe('normalizeTranscriptText', () => {
  it('strips BOM, normalizes line endings and trailing whitespace', () => {
    const raw = '\uFEFF# Title\r\nLine one  \r\nLine two\r\n\r\n\r\n\r\nEnd  \n';
    expect(normalizeTranscriptText(raw)).toBe('# Title\nLine one\nLine two\n\nEnd');
  });
  it('preserves punctuation, emphasis and paragraphs', () => {
    const raw = 'It\'s "fine" — really.\n\n*Emphasis* and **strong**.\n\nNew paragraph.';
    expect(normalizeTranscriptText(raw)).toBe(raw);
  });
  it('collapses excessive blank lines to a single blank line', () => {
    expect(normalizeTranscriptText('a\n\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('validateManifestSchema', () => {
  it('accepts the valid example manifest', () => {
    const { valid, diagnostics } = validateManifestSchema(validManifest);
    expect(valid).toBe(true);
    expect(diagnostics).toEqual([]);
  });
  it('rejects unknown root properties', () => {
    const bad = { ...validManifest, randomField: 1 };
    const { valid, diagnostics } = validateManifestSchema(bad);
    expect(valid).toBe(false);
    expect(diagnostics.some((d) => d.code === 'SCHEMA_UNKNOWN_PROPERTY')).toBe(true);
  });
  it('rejects unknown variant properties', () => {
    const bad = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    (bad.variants[0] as unknown as Record<string, unknown>).extra = 1;
    const { valid } = validateManifestSchema(bad);
    expect(valid).toBe(false);
  });
  it('rejects duplicate levels via schema? no — via editorial; schema rejects invalid level enum', () => {
    const bad = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    bad.variants[0].level = 'B9' as EpisodeManifest['variants'][0]['level'];
    const { valid, diagnostics } = validateManifestSchema(bad);
    expect(valid).toBe(false);
    expect(diagnostics.some((d) => d.code.includes('ENUM'))).toBe(true);
  });
  it('rejects unsupported schemaVersion', () => {
    const bad = { ...validManifest, schemaVersion: '2.0.0' };
    const { valid } = validateManifestSchema(bad);
    expect(valid).toBe(false);
  });
  it('rejects empty variants', () => {
    const bad = { ...validManifest, variants: [] };
    const { valid } = validateManifestSchema(bad);
    expect(valid).toBe(false);
  });
  it('rejects non-positive contentVersion', () => {
    const bad = { ...validManifest, contentVersion: 0 };
    const { valid } = validateManifestSchema(bad);
    expect(valid).toBe(false);
  });
  it('rejects unknown vocabulary fields', () => {
    const bad = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    (bad.variants[0].vocabulary[0] as unknown as Record<string, unknown>).translation = 'x';
    const { valid } = validateManifestSchema(bad);
    expect(valid).toBe(false);
  });
});

describe('editorialDiagnostics', () => {
  it('produces no errors for the valid manifest', () => {
    const errors = editorialDiagnostics(validManifest).filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
  });
  it('blocks placeholder values', () => {
    const bad = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    bad.episode.titleEn = 'TODO_REPLACE';
    const errors = editorialDiagnostics(bad).filter((d) => d.severity === 'error');
    expect(errors.some((d) => d.code === 'PLACEHOLDER_VALUE')).toBe(true);
  });
  it('blocks empty Persian description', () => {
    const bad = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    bad.episode.descriptionFa = '   ';
    const errors = editorialDiagnostics(bad).filter((d) => d.severity === 'error');
    expect(errors.some((d) => d.code === 'DESCRIPTION_FA_EMPTY')).toBe(true);
  });
  it('blocks duplicate levels', () => {
    const bad = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    bad.variants.push({ ...bad.variants[0], summaryFa: 'second' });
    const errors = editorialDiagnostics(bad).filter((d) => d.severity === 'error');
    expect(errors.some((d) => d.code === 'DUPLICATE_VARIANT_LEVEL')).toBe(true);
  });
  it('blocks duplicate normalized vocabulary terms', () => {
    const bad = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    bad.variants[0].vocabulary.push({
      term: '  Pyramid ',
      meaningFa: 'هرم',
      definitionEn: 'structure',
    });
    const errors = editorialDiagnostics(bad).filter((d) => d.severity === 'error');
    expect(errors.some((d) => d.code === 'DUPLICATE_VOCABULARY_TERM')).toBe(true);
  });
  it('warns for missing example/phonetic and short descriptions', () => {
    const bad = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    bad.episode.descriptionFa = 'کوتاه';
    delete bad.variants[0].vocabulary[0].exampleSentence;
    delete bad.variants[0].vocabulary[0].phonetic;
    const warnings = editorialDiagnostics(bad).filter((d) => d.severity === 'warning');
    const codes = warnings.map((w) => w.code);
    expect(codes.some((c) => c === 'DESCRIPTION_FA_TOO_SHORT')).toBe(true);
    expect(codes.some((c) => c === 'VOCAB_NO_EXAMPLE')).toBe(true);
    expect(codes.some((c) => c === 'VOCAB_NO_PHONETIC')).toBe(true);
  });
  it('warns for long titles and generic alt text', () => {
    const bad = JSON.parse(JSON.stringify(validManifest)) as EpisodeManifest;
    bad.episode.titleEn = 'A'.repeat(90);
    bad.episode.artworkAltFa = 'artwork';
    const warnings = editorialDiagnostics(bad).filter((d) => d.severity === 'warning');
    const codes = warnings.map((w) => w.code);
    expect(codes.some((c) => c === 'TITLE_EN_TOO_LONG')).toBe(true);
    expect(codes.some((c) => c === 'ARTWORK_ALT_GENERIC')).toBe(true);
  });
});

describe('transcriptDiagnostics', () => {
  it('rejects an effectively empty transcript (headings only)', () => {
    const errors = transcriptDiagnostics('B1', '# Title\n\n## Sub', 20).filter(
      (d) => d.severity === 'error',
    );
    expect(errors.some((d) => d.code === 'TRANSCRIPT_ONLY_HEADINGS')).toBe(true);
  });
  it('rejects an empty file', () => {
    const errors = transcriptDiagnostics('B1', '', 0).filter((d) => d.severity === 'error');
    expect(errors.some((d) => d.code === 'TRANSCRIPT_EMPTY')).toBe(true);
  });
  it('warns for very short transcripts', () => {
    const warnings = transcriptDiagnostics('B1', 'short', 5).filter(
      (d) => d.severity === 'warning',
    );
    expect(warnings.some((d) => d.code === 'TRANSCRIPT_TOO_SHORT')).toBe(true);
  });
});

describe('version rules', () => {
  const pkg = packageFor(validManifest);
  const baseState = {
    contentKey: 'history.pyramids-of-egypt',
    episode: null,
    variants: {},
    categoryExists: true,
  };

  it('new content key → new', () => {
    expect(decideImport(pkg, baseState)).toBe('new');
  });
  it('same key/version/fingerprint → no_change', () => {
    const state = {
      ...baseState,
      episode: {
        id: 't1',
        status: 'draft',
        contentVersion: 1,
        previousFingerprint: pkg.fingerprint,
      },
    };
    expect(decideImport(pkg, state)).toBe('no_change');
  });
  it('same key/version/different fingerprint → conflict', () => {
    const state = {
      ...baseState,
      episode: {
        id: 't1',
        status: 'draft',
        contentVersion: 1,
        previousFingerprint: 'other',
      },
    };
    expect(decideImport(pkg, state)).toBe('conflict');
  });
  it('higher version → update', () => {
    const state = {
      ...baseState,
      episode: { id: 't1', status: 'published', contentVersion: 1, previousFingerprint: 'f' },
    };
    expect(decideImport({ ...pkg, manifest: { ...validManifest, contentVersion: 2 } }, state)).toBe(
      'update',
    );
  });
  it('lower version → stale', () => {
    const state = {
      ...baseState,
      episode: { id: 't1', status: 'draft', contentVersion: 5, previousFingerprint: 'f' },
    };
    expect(decideImport({ ...pkg, manifest: { ...validManifest, contentVersion: 2 } }, state)).toBe(
      'stale',
    );
  });
  it('missing category → rejected', () => {
    expect(decideImport(pkg, { ...baseState, categoryExists: false })).toBe('rejected');
  });
});

describe('buildPlan', () => {
  it('plans a full create with deterministic ordering', () => {
    const pkg = packageFor(validManifest);
    const plan = buildPlan(
      {
        ...pkg,
        manifest: validManifest,
        manifestText: '',
        manifestCanonical: '',
        assets: [],
        transcripts: {},
      },
      {
        contentKey: 'history.pyramids-of-egypt',
        episode: null,
        variants: {},
        categoryExists: true,
      },
    );
    expect(plan.decision).toBe('new');
    expect(plan.episode.action).toBe('create');
    expect(plan.variants).toEqual([{ level: 'B1', action: 'create' }]);
    expect(plan.summary.episodesCreate).toBe(1);
    expect(plan.summary.variantsCreate).toBe(1);
    expect(plan.summary.vocabularyCreate).toBe(1);
    expect(plan.summary.mediaUpload).toBe(3); // artwork + audio + hero
    expect(plan.publication.targetState).toBe('draft');
  });
  it('plans no-change with no writes', () => {
    const pkg = packageFor(validManifest);
    const plan = buildPlan(
      {
        ...pkg,
        manifest: validManifest,
        manifestText: '',
        manifestCanonical: '',
        assets: [],
        transcripts: {},
      },
      {
        contentKey: 'history.pyramids-of-egypt',
        episode: {
          id: 't1',
          status: 'draft',
          contentVersion: 1,
          previousFingerprint: pkg.fingerprint,
        },
        variants: { B1: { id: 'l1', status: 'draft', contentVersion: 1 } },
        categoryExists: true,
      },
    );
    expect(plan.decision).toBe('no_change');
    expect(plan.episode.action).toBe('none');
    expect(plan.summary.mediaUpload).toBe(0);
  });
  it('plans variant updates for existing levels on update', () => {
    const pkg = packageFor({ ...validManifest, contentVersion: 2 });
    const plan = buildPlan(
      {
        ...pkg,
        manifest: { ...validManifest, contentVersion: 2 },
        manifestText: '',
        manifestCanonical: '',
        assets: [],
        transcripts: {},
      },
      {
        contentKey: 'history.pyramids-of-egypt',
        episode: { id: 't1', status: 'published', contentVersion: 1, previousFingerprint: 'f' },
        variants: { B1: { id: 'l1', status: 'published', contentVersion: 1 } },
        categoryExists: true,
      },
    );
    expect(plan.decision).toBe('update');
    expect(plan.variants).toEqual([{ level: 'B1', action: 'update' }]);
    expect(plan.summary.variantsUpdate).toBe(1);
    expect(plan.summary.episodesUpdate).toBe(1);
  });
});

describe('sanitizeDiagnostics', () => {
  it('redacts secrets and paths and bounds message length', () => {
    const out = sanitizeDiagnostics([
      {
        code: 'X',
        severity: 'error',
        path: 'variants[0]',
        message: `failed with password=secret123 and token=abc123def456ghi and /var/pb_data/storage/x`,
      },
      { code: 'Y', severity: 'warning', path: 'a', message: 'm'.repeat(2000) },
    ]);
    expect(out[0].message).toBe('[REDACTED]');
    expect(out[1].message.length).toBeLessThanOrEqual(500);
    expect(out).toHaveLength(2);
  });
  it('drops entries beyond the bound', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      code: `C${i}`,
      severity: 'error' as const,
      path: 'p',
      message: 'm',
    }));
    expect(sanitizeDiagnostics(many)).toHaveLength(50);
  });
});

describe('limit constants', () => {
  it('align artwork with the Slice 2 contract (5 MB)', () => {
    expect(ARTWORK_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
  it('align audio with the lessons field contract (10 MB)', () => {
    expect(AUDIO_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});
