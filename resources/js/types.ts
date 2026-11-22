import type { PageProps as InertiaPageProps } from '@inertiajs/core';

/**
 * Inertia's client Head dedupes tags by `head-key`. React's HTML typings
 * do not know that attribute, so declare it once here instead of casting
 * every meta/link in SeoHead.
 */
declare module 'react' {
    interface HTMLAttributes<T> {
        'head-key'?: string;
    }
}

/**
 * Server-shaped public SEO metadata (App\Support\PublicSeo). Present only
 * on public pages; SeoHead uses the same values as the Blade partial so an
 * Inertia visit updates the tags instead of leaving them stale.
 */
export interface SeoProps {
    title: string;
    description: string | null;
    canonical: string;
    type: 'website' | 'article';
    image: string;
    image_alt: string;
    image_width: number;
    image_height: number;
    robots: string | null;
    json_ld: Record<string, unknown> | null;
}

/**
 * M0 shared Inertia props (mirrors HandleInertiaRequests::share()).
 * Page-specific props extend this interface per page.
 */
export interface AuthUser {
    id: number;
    name: string;
    email: string;
}

/** Owner-confirmed support channels (SiteSettings::supportContacts()). */
export interface SupportContact {
    phone: string;
    phone_href: string | null;
    email: string;
    email_href: string | null;
    messenger: string;
    messenger_note: string;
    hours: string | null;
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
    /** Due vocabulary count for the tab badge; 0 for guests. */
    due_words: number;
    /**
     * Whether a published public sample exists. Public/auth surfaces hide
     * sample links when false instead of sending a guest to a 404.
     */
    has_public_sample: boolean;
    /** Null on pages that do not render a support note. */
    support: SupportContact | null;
    /** Public pages only; null/absent on auth and app screens. */
    seo?: SeoProps | null;
}

/** Page-specific URL bags are declared at their page (Landing only). */

/**
 * M1 player track: the single audio identity bound to the persistent
 * element. Lessons and reading pages share the same element and console;
 * switching identity replaces the source (old audio stops).
 *
 * `reading` tracks may be a bounded slice of a chapter file: `startSeconds`
 * and `endSeconds` keep the console time relative to the page while the
 * underlying element still stores absolute chapter time.
 */
export interface PlayerTrack {
    /** `lesson` saves lesson progress; `ted`/`reading` never do. */
    kind?: 'lesson' | 'ted' | 'reading';
    /** Unique per reading page; the key change rebinds the element. */
    key?: string;
    lessonId: number;
    audioUrl: string;
    audioRevision: number;
    titleEn: string;
    level: string;
    coverUrl: string | null;
    /** Resume offset in seconds relative to the bound slice; applied once. */
    initialPosition: number;
    startSeconds?: number;
    endSeconds?: number;
    /** Start playing as soon as metadata is ready (continuous page turn). */
    autoplay?: boolean;
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

/** Standalone TED section (owner instruction 2026-11-22). */
export interface TedWord {
    word: string;
    en: string;
    fa: string | null;
}

export interface TedSentence {
    t: number;
    text: string;
}

export interface TedTalkPayload {
    id: number;
    slug: string;
    title_en: string;
    speaker: string;
    area: string;
    area_label: string;
    duration_seconds: number;
    estimated_minutes: number;
    audio_revision: number;
    audio_url: string;
    cover_url: string | null;
    segments: TedSentence[][];
    words: TedWord[];
    source_url: string;
    source_license: string;
}

export interface TedTalkCard {
    slug: string;
    title_en: string;
    speaker: string;
    area: string;
    area_label: string;
    minutes: number;
    cover_url: string | null;
    url: string;
}

export interface TedArea {
    key: string;
    label: string;
    count: number;
}

/** Owner request 2026-11-15: AEF book flashcards (two-grade scheduler). */
export type FlashcardRating = 'again' | 'good';

/** Lesson vocabulary decks use the notebook's four-grade schedule. */
export type VocabRating = 'again' | 'hard' | 'good' | 'easy';

/** Book-unit exercises: grammar topics, choice and matching (2026-11-16). */
export type ExerciseType = 'choice' | 'matching';

export interface ExerciseTopicRow {
    id: number;
    key: string;
    title_en: string;
    title_fa: string;
    use_fa: string;
    formulas: { label_fa: string; text: string }[];
    examples: { en: string; fa: string | null }[];
    notes_fa: string | null;
}

export interface ExerciseAnswerResult {
    is_correct: boolean;
    response: number | number[];
    correct: string;
    explanation_fa: string | null;
    feedback_fa: string | null;
    answered_at: string | null;
}

export interface UnitExerciseItem {
    id: number;
    topic_key: string | null;
    type: ExerciseType;
    prompt: string;
    position: number;
    answered: boolean;
    options?: string[];
    left?: string[];
    rights?: string[];
    result?: ExerciseAnswerResult;
}

export interface UnitExerciseSet {
    title: string;
    instructions_fa: string;
    source: Record<string, unknown> | null;
}

export interface UnitProgress {
    questions: number;
    answered: number;
}

/** One lesson deck's computed state (owner clarification 2026-11-15). */
export interface LessonDeckCounts {
    total: number;
    new: number;
    learning: number;
    known: number;
    due: number;
}

export interface LessonDeckLesson {
    id: number;
    title_en: string;
    level: string;
    topic_slug: string;
    topic_title: string;
    reader_url: string;
}

export interface BookExerciseProgress {
    questions: number;
    answered: number;
}

export interface UnitExerciseProgress {
    questions: number;
    answered: number;
}

export interface BookRow {
    slug: string;
    title_en: string;
    title_fa: string | null;
    level: string | null;
    edition: string | null;
    units_count: number;
    exercise: BookExerciseProgress | null;
    cover_url: string | null;
    url: string;
}

/** The five-item books shelf and the tabs shared by every screen below it. */
export interface LibraryTab {
    key: string;
    label: string;
    url: string;
    active: boolean;
}

export interface LibraryCollection {
    key: string;
    title_fa: string;
    title_en: string;
    subtitle_fa: string;
    description_fa: string;
    cover_url: string | null;
    url: string;
    chips: string[];
    ready: number;
    total: number;
    status: 'ready' | 'preparing';
}

export interface LibraryBreadcrumb {
    title: string;
    url: string | null;
}

export interface LibraryProgressBadge {
    page_key: string;
    position_ms: number;
    completed: boolean;
}

export interface LibraryCard {
    id: number;
    track: 'story' | 'ielts' | 'inside_reading';
    kind: string;
    title_en: string | null;
    title_fa: string | null;
    subtitle_fa: string | null;
    level: string | null;
    cover_url: string | null;
    url: string | null;
    readable: boolean;
    status: 'ready' | 'preparing';
    chips: string[];
    progress: LibraryProgressBadge | null;
}

/** Reader document pieces (App\Support\Library\ReadingPayload). */
export interface ReadingWord {
    word: string;
    meaning_fa: string | null;
    definition_en: string | null;
    part_of_speech: string | null;
    start_utf16: number | null;
    end_utf16: number | null;
    audio_url: string | null;
}

export interface ReadingSentence {
    start_utf16: number;
    end_utf16: number;
    start_ms: number | null;
    end_ms: number | null;
    text_fa: string | null;
}

export interface ReadingPage {
    id: string;
    number: number | null;
    label: string | null;
    text_en: string;
    text_fa: string | null;
    panel_index: number | null;
    image_url: string | null;
    alt_fa: string | null;
    audio_url: string | null;
    audio_start_ms: number | null;
    audio_end_ms: number | null;
    sync_confidence: number | null;
    words: ReadingWord[];
    sentences: ReadingSentence[];
}

export interface ReadingChapter {
    id: string;
    title_en: string | null;
    title_fa: string | null;
    audio_url: string | null;
    duration_ms: number | null;
    pages: ReadingPage[];
}

export interface ReadingArt {
    url: string | null;
    columns: number;
    rows: number;
    alt_fa: string | null;
}

export type IeltsQuestionType = 'choice' | 'multi_choice' | 'tfng' | 'ynng' | 'completion' | 'short_answer';

export interface IeltsQuestion {
    id: string;
    number: number | null;
    number_end: number | null;
    weight: number;
    type: IeltsQuestionType;
    instructions_fa: string | null;
    prompt: string;
    options: string[];
    word_limit: number | null;
    max_answers: number | null;
}

export interface IeltsEvidence {
    page_key: string;
    start_utf16: number;
    end_utf16: number;
}

export interface IeltsResultItem {
    id: string;
    number: number | null;
    number_end: number | null;
    weight: number;
    is_correct: boolean;
    given: string | string[] | null;
    correct: string;
    explanation_fa: string | null;
    why_wrong_fa: string | null;
    evidence: IeltsEvidence | null;
}

export interface IeltsResult {
    score: number;
    total: number;
    items: IeltsResultItem[];
}

export interface ReadingEndpoints {
    progress: string;
    attempts: string | null;
}

export interface ReadingNode {
    id: number;
    track: 'story' | 'ielts' | 'inside_reading';
    kind: string;
    title_en: string | null;
    title_fa: string | null;
    level: string | null;
    cover_url: string | null;
}

export interface ReadingProgressState {
    page_key: string;
    position_ms: number;
    completed: boolean;
    same_revision: boolean;
}



export interface BookUnitRow {
    number: number;
    title_en: string;
    title_fa: string | null;
    subtitle: string | null;
    exercise: UnitExerciseProgress | null;
    hub_url: string;
}

export interface FlashcardCardRow {
    id: number;
    word_key?: string | null;
    word: string;
    headword: string;
    phonetic: string | null;
    translation_fa: string;
    definition_en: string | null;
    example_en: string | null;
    part_of_speech: string | null;
    /** Null on a lesson card whose approved clip has not been produced yet. */
    audio_url: string | null;
    status?: 'new' | 'learning' | 'known' | string | null;
    last_rating: FlashcardRating | null;
    phase: string | null;
    due_at: string | null;
    is_new: boolean;
    book_title?: string | null;
    book_slug?: string | null;
    unit_title?: string | null;
    unit_number?: number | null;
}

export interface FlashcardStudyConfig {
    reveal_delay_ms: number;
    auto_play_audio: boolean;
    show_phonetic: boolean;
    show_translation: boolean;
}

declare global {
    interface Window {
        /** Browser-test probe: the persistent audio element bound once. */
        __fePlayerBound?: boolean;
    }
}
