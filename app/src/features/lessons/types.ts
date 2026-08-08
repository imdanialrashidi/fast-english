// app/src/features/lessons/types.ts
// Types for the lessons feature (Podcast Slice 2: Episode/Variant metadata).

import type { CefrLevel } from '../../../../shared/podcast/domain';

export interface TopicMeta {
  id: string;
  title: string;
  slug: string;
}

/** Podcast Library Category (sanitized). */
export interface EpisodeCategoryMeta {
  id: string;
  key: string;
  slug: string;
  titleFa: string;
}

/** Canonical Episode metadata (a Topic shared across levels). */
export interface EpisodeMeta {
  id: string;
  slug: string;
  contentKey: string;
  title: string;
  titleFa: string;
  descriptionFa: string;
  category: EpisodeCategoryMeta | null;
  artwork: string;
  heroImage: string | null;
  featured: boolean;
}

export interface LessonListItem {
  id: string;
  topicId: string;
  topicTitle: string;
  topicSlug: string;
  title: string;
  summary: string;
  level: string;
  estimatedMinutes: number;
  audioDurationSeconds?: number;
  publishedAt: string | null;
  isPublicSample: boolean;
  /** Podcast Slice 2: canonical Episode metadata for the Variant. */
  episode?: EpisodeMeta;
}

export interface LessonListResponse {
  lessons: LessonListItem[];
  page: number;
  perPage: number;
  totalItems: number;
  /** Browsing level used for this response (defaults to preferredLevel). */
  level?: string;
  recommendedLevel?: string;
  preferredLevel?: string;
}

export interface AudioDescriptor {
  url: string;
  contentType: string;
  estimatedMinutes: number;
}

/** One selectable Variant of the same Episode (Level Switcher data). */
export interface AvailableLevelEntry {
  level: string;
  variantId: string;
  available: boolean;
  isRecommended: boolean;
  isPreferred: boolean;
}

export interface LessonDetailResponse {
  id: string;
  topic: TopicMeta;
  title: string;
  level: string;
  body: string;
  estimatedMinutes: number;
  audioDurationSeconds?: number;
  isPublicSample: boolean;
  publishedAt: string | null;
  audio: AudioDescriptor;
  /** Podcast Slice 2 fields (present for eligible Students). */
  episode?: EpisodeMeta;
  variant?: {
    id: string;
    level: string;
    summaryFa: string;
    transcript: string;
    audioDurationSeconds: number;
    publicationStatus: string;
  };
  recommendedLevel?: string;
  preferredLevel?: string;
  availableLevels?: AvailableLevelEntry[];
  vocabularyCount?: number;
}

export interface PublicSampleResponse {
  kind: 'sample' | 'sample_unavailable';
  lesson?: {
    id: string;
    topic: TopicMeta;
    title: string;
    level: string;
    summary: string;
    body: string;
    estimatedMinutes: number;
    audio: AudioDescriptor;
  };
}

export type { CefrLevel };
