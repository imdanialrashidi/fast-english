import type { PageProps as InertiaPageProps } from '@inertiajs/core';

/**
 * M0 shared Inertia props (mirrors HandleInertiaRequests::share()).
 * Page-specific props extend this interface per page.
 */
export interface AuthUser {
    id: number;
    name: string;
    email: string;
}

export interface SharedProps extends InertiaPageProps {
    auth: {
        user: AuthUser | null;
    };
    flash: {
        success: string | null;
        error: string | null;
    };
    /**
     * Neutral session status (Fortify reset link, settings save,
     * placement notices). Never a secret — the same string the Blade
     * session helper showed.
     */
    status: string | null;
}

/** Page-specific URL bags are declared at their page (Landing only). */

/**
 * M1 player track: the single lesson version bound to the persistent
 * audio element. One track at a time; switching lessons replaces it
 * (old audio stops, nothing auto-plays). The audio URL is only ever
 * present for a lesson the server already authorized (the reader
 * controller 403s before rendering otherwise).
 */
export interface PlayerTrack {
    lessonId: number;
    audioUrl: string;
    audioRevision: number;
    titleEn: string;
    level: string;
    coverUrl: string | null;
    /** Server-confirmed resume position for this revision; applied once. */
    initialPosition: number;
}

/** M1 library row: metadata only — never bodies, glossaries, or audio. */
export interface TopicRow {
    slug: string;
    title_en: string;
    cover_url: string | null;
    category_name: string | null;
    levels: string[];
    first_level: string | null;
    extra_levels: number;
    minutes: number;
    reader_url: string;
}

export interface PaginationMeta {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
}

/** M1 reader glossary entry (active lesson only, server-escaped). */
export interface GlossaryEntry {
    word: string;
    meaning_fa: string;
    example_en: string | null;
}

/**
 * Shared reading payload (App\Support\ReadingPayload): the topic/lesson
 * allowlist and Reading::prepared content used by the learner reader and
 * the public sample. Page-specific state is added by the controller.
 */
export interface TopicPayload {
    id: number;
    slug: string;
    title_en: string;
    summary_public: string | null;
    cover_url: string | null;
}

export interface LessonPayload {
    id: number;
    title_en: string;
    level: string;
    estimated_minutes: number;
    duration_seconds: number;
    audio_revision: number;
    audio_url: string;
}

export interface ReadingContent {
    paragraphs: string[];
    glossary: GlossaryEntry[];
}

declare global {
    interface Window {
        /** Browser-test probe: the persistent audio element bound once. */
        __fePlayerBound?: boolean;
    }
}
