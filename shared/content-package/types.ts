// shared/content-package/types.ts
// Podcast Slice 3 — wire types for the Episode Content Package pipeline.
// These types are shared between the CLI pipeline (Node), the future
// Admin Console (browser) and the plan/execute API contract. The
// PocketBase hooks re-implement the same shapes in plain JS.

import type { CefrLevel } from '../podcast/domain.ts';

/** Severity of a content diagnostic. */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * One structured diagnostic. `code` is a stable, documented error code
 * suitable for machine handling (and the future Admin UI); `path` is a
 * dotted path into the manifest (e.g. `variants[0].audio`) or an asset
 * path; `suggestion` is optional actionable guidance.
 */
export interface ContentDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  path: string;
  message: string;
  suggestion?: string;
}

/** Manifest shape (validated by schemas/episode-package.schema.json). */
export interface EpisodeManifest {
  $schema?: string;
  schemaVersion: string;
  contentKey: string;
  contentVersion: number;
  categoryKey: string;
  episode: EpisodeManifestEpisode;
  variants: EpisodeManifestVariant[];
}

export interface EpisodeManifestEpisode {
  slug: string;
  titleEn: string;
  titleFa: string;
  descriptionFa: string;
  artworkSquare: string;
  heroImageWide?: string;
  artworkAltFa: string;
  episodeNumber?: number;
  featured?: boolean;
}

export interface EpisodeManifestVariant {
  level: CefrLevel;
  summaryFa: string;
  audio: string;
  transcript: string;
  vocabulary: EpisodeManifestVocabulary[];
}

export interface EpisodeManifestVocabulary {
  term: string;
  phonetic?: string;
  partOfSpeech?: string;
  meaningFa: string;
  definitionEn: string;
  exampleSentence?: string;
  pronunciationAudio?: string;
}

/** Inspected asset metadata (kind, size, geometry, duration, checksum). */
export interface AssetInfo {
  /** Package-relative path as declared in the manifest. */
  path: string;
  kind: 'artworkSquare' | 'heroImageWide' | 'audio' | 'transcript' | 'pronunciationAudio';
  sizeBytes: number;
  sha256: string;
  mimeType: string;
  /** Images only. */
  width?: number;
  height?: number;
  /** Audio only (authoritative duration in whole seconds). */
  durationSeconds?: number;
}

/** Validated package: manifest + assets + fingerprint. */
export interface ValidatedContentPackage {
  manifest: EpisodeManifest;
  manifestText: string;
  manifestCanonical: string;
  /** Deterministic package fingerprint (see checksums.ts). */
  fingerprint: string;
  assets: AssetInfo[];
  /** Normalized transcript text per variant level. */
  transcripts: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ContentDiagnostic[];
  warnings: ContentDiagnostic[];
  package?: ValidatedContentPackage;
}

/** Version-state decision for an import. */
export type ImportDecision = 'new' | 'no_change' | 'conflict' | 'update' | 'stale' | 'rejected';

/** Per-record planned action inside a diff plan. */
export type PlanAction = 'create' | 'update' | 'none' | 'remove';

/** Authoritative server state the diff plan is computed against. */
export interface ServerContentState {
  contentKey: string;
  /** Existing Episode (topics) state; null when the key is new. */
  episode: {
    id: string;
    status: string;
    contentVersion: number;
    /** Fingerprint of the last completed import of this key. */
    previousFingerprint: string;
  } | null;
  /** Existing Variants (lessons) keyed by CEFR level. */
  variants: Record<string, { id: string; status: string; contentVersion: number }>;
  /** Whether the requested category exists. */
  categoryExists: boolean;
}

/** Deterministic diff plan (pure; built from package + server state). */
export interface ImportPlan {
  decision: ImportDecision;
  contentKey: string;
  contentVersion: number;
  fingerprint: string;
  category: { key: string; action: 'reuse' | 'missing' };
  episode: { action: PlanAction; reason?: string };
  variants: Array<{ level: CefrLevel; action: PlanAction; reason?: string }>;
  vocabulary: Array<{ level: CefrLevel; count: number }>;
  media: { uploads: string[] };
  publication: { targetState: 'draft' };
  summary: {
    episodesCreate: number;
    episodesUpdate: number;
    variantsCreate: number;
    variantsUpdate: number;
    vocabularyCreate: number;
    mediaUpload: number;
  };
}
