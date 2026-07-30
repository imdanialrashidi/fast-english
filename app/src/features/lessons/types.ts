// app/src/features/lessons/types.ts
// Types for the lessons feature.

export interface TopicMeta {
  id: string;
  title: string;
  slug: string;
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
}

export interface LessonListResponse {
  lessons: LessonListItem[];
  page: number;
  perPage: number;
  totalItems: number;
}

export interface AudioDescriptor {
  url: string;
  contentType: string;
  estimatedMinutes: number;
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
