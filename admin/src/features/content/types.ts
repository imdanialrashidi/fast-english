// admin/src/features/content/types.ts
// Podcast Slice 4 — wire types for the Staff Content Studio API.
// The server shapes are authoritative; these are the documented mirrors
// (camelCase, no storage names, no raw records).

import type { CefrLevel } from '../../../../shared/podcast/domain';

export type PublicationState = 'draft' | 'published' | 'archived';

export interface CategorySummary {
  id: string;
  key: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  sortOrder: number;
  isFeatured: boolean;
  publicationStatus: PublicationState;
  publishedAt: string | null;
  archivedAt: string | null;
  coverPresent: boolean;
  episodeCounts: { total: number; published: number; draft: number; archived: number };
}

export interface CategoryRef {
  id: string;
  key: string;
  slug: string;
  titleFa: string;
  publicationStatus: PublicationState;
}

export interface ReadinessIssue {
  code: string;
  message: string;
}

export interface VariantReadiness {
  present: boolean;
  status: string;
  ready: boolean;
  legacy: boolean;
  errors: ReadinessIssue[];
  warnings: ReadinessIssue[];
  preconditions: ReadinessIssue[];
}

export interface EpisodeReadiness {
  status: string;
  ready: boolean;
  legacy: boolean;
  errors: ReadinessIssue[];
  warnings: ReadinessIssue[];
}

export interface EpisodeListItem {
  id: string;
  slug: string;
  contentKey: string;
  contentVersion: number;
  title: string;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  status: PublicationState;
  episodeNumber: number | null;
  isFeatured: boolean;
  artworkPresent: boolean;
  heroPresent: boolean;
  category: CategoryRef | null;
  variantCounts: { published: number; draft: number; archived: number; total: number };
  levels: Record<string, string>;
  hasIncompleteVariant: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  updatedAt: string | null;
}

export interface VariantListItem {
  id: string;
  level: CefrLevel;
  status: PublicationState;
  title: string;
  summaryFa: string;
  audioPresent: boolean;
  audioDurationSeconds: number;
  contentVersion: number;
  publishedAt: string | null;
  archivedAt: string | null;
  thumbnailPresent: boolean;
  vocabularyCount?: number;
  readiness?: VariantReadiness;
}

export interface EpisodeDetail extends EpisodeListItem {
  variants: VariantListItem[];
  readiness: { episode: EpisodeReadiness; variants: Record<string, VariantReadiness> };
}

export interface VocabularyEntry {
  id: string;
  term: string;
  phonetic: string;
  partOfSpeech: string;
  meaningFa: string;
  definitionEn: string;
  exampleSentence: string;
  pronunciationPresent: boolean;
  sortOrder: number;
}

export interface VariantDetail {
  id: string;
  level: CefrLevel;
  status: PublicationState;
  title: string;
  summaryFa: string;
  audioPresent: boolean;
  audioDurationSeconds: number;
  contentVersion: number;
  publishedAt: string | null;
  archivedAt: string | null;
  thumbnailPresent: boolean;
  body: string;
  vocabulary: VocabularyEntry[];
  vocabularyCount: number;
  episodeId: string;
  episodeTitleFa: string;
  readiness: VariantReadiness | null;
}

export interface OverviewData {
  episodes: { draft: number; published: number; archived: number; total: number };
  variantsMissingRequired: number;
  recentImports: ImportAuditItem[];
}

export interface ImportAuditItem {
  id: string;
  contentKey: string;
  contentVersion: number;
  schemaVersion: string;
  status: 'planned' | 'running' | 'completed' | 'failed' | 'no_change';
  startedAt: string | null;
  completedAt: string | null;
  summary: {
    episodeId?: string;
    variants?: Record<string, { id: string; action: string }>;
    summary?: {
      episodesCreate: number;
      episodesUpdate: number;
      variantsCreate: number;
      variantsUpdate: number;
      vocabularyCreate: number;
      mediaUpload: number;
    };
  } | null;
  error: unknown;
}

export interface ImportPlanResponse {
  result: 'new' | 'no_change' | 'conflict' | 'update' | 'stale' | 'rejected';
  planStateHash: string;
  contentKey: string;
  contentVersion: number;
  fingerprint: string;
  category: { key: string; action: 'reuse' | 'missing' };
  episode: { action: 'create' | 'update' | 'none'; reason?: string };
  variants: Array<{ level: CefrLevel; action: 'create' | 'update' | 'none'; reason?: string }>;
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

export interface PreviewEpisode {
  episode: {
    id: string;
    slug: string;
    contentKey: string;
    title: string;
    titleFa: string;
    descriptionFa: string;
    episodeNumber: number | null;
    isFeatured: boolean;
    status: string;
    artworkPresent: boolean;
    heroPresent: boolean;
    category: { key: string; slug: string; titleFa: string; publicationStatus: string } | null;
  };
  variants: Array<{
    id: string;
    level: CefrLevel;
    status: string;
    summaryFa: string;
    transcript: string;
    audioPresent: boolean;
    audioDurationSeconds: number;
    vocabulary: VocabularyEntry[];
  }>;
}

export interface ServerDiagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  path: string;
  message: string;
  suggestion?: string;
}

export interface ZipValidationReport {
  ok: boolean;
  errors: ServerDiagnostic[];
  warnings: ServerDiagnostic[];
  manifest: unknown;
  contentKey?: string;
  contentVersion?: number;
  categoryKey?: string;
  schemaVersion?: string;
  levels?: string[];
  assetCount?: number;
  vocabularyCount?: number;
}
