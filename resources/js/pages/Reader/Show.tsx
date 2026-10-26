import { Head, Link } from '@inertiajs/react';
import { Bookmark, BookOpen, Check, Clock, Gauge, Headphones, RotateCcw } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toast } from '@/components/Toast';
import AppLayout from '@/layouts/AppLayout';
import { deleteJson, postJson } from '@/lib/http';
import { usePlayerActions } from '@/lib/player';
import type { GlossaryEntry, LessonPayload, ReadingContent, SharedProps, TopicPayload } from '@/types';

/**
 * M1 immersive reader (READ-01/02): the composed reading environment —
 * editorial title, bounded cover, level selector, studio player (fixed in
 * the persistent shell), the plain English body, and the active lesson's
 * key words with notebook saves.
 *
 * Order is fixed: title → meta → cover → level → player → body → words.
 * The level travels in the URL only; browsing never writes
 * preferred_level. The audio plays normally beside the text: no
 * sentence-level highlight or seek (owner direction, 2026-10-21).
 */

interface ReaderProps extends SharedProps, ReadingContent {
    topic: TopicPayload;
    lesson: LessonPayload;
    availableLevels: string[];
    initialPosition: number;
    completed: boolean;
    bookmarked: boolean;
    isGuest: boolean;
}

function GlossaryRow({
    entry,
    lessonId,
    isGuest,
    onSaved,
}: {
    entry: GlossaryEntry;
    lessonId: number;
    isGuest: boolean;
    onSaved: (message: string, ok: boolean) => void;
}): React.JSX.Element {
    const [saved, setSaved] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    const save = async (): Promise<void> => {
        if (saved || busy) {
            return;
        }
        setBusy(true);
        try {
            const response = await postJson('/app/words', {
                word: entry.word,
                meaning_fa: entry.meaning_fa,
                example_en: entry.example_en,
                lesson_id: lessonId,
            });
            if (response.status === 201) {
                setSaved(true);
                onSaved(`«${entry.word}» در دفترچه ذخیره شد.`, true);
            } else if (response.status === 422) {
                const data = (await response.json().catch(() => null)) as { message?: string; id?: number } | null;
                // Only the idempotent duplicate shape carries the surviving
                // row id. A validation 422 (word too long, etc.) is a real
                // failure and must not claim the word was saved.
                if (typeof data?.id === 'number') {
                    setSaved(true);
                    onSaved(data.message ?? 'این واژه قبلاً در دفترچه شما ذخیره شده است.', true);
                } else {
                    onSaved(data?.message ?? 'ذخیره واژه ممکن نشد. دوباره تلاش کنید.', false);
                }
            } else {
                onSaved('ذخیره واژه ممکن نشد. دوباره تلاش کنید.', false);
            }
        } catch {
            onSaved('ذخیره واژه ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.', false);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="grid gap-1 border-b border-line py-4 last:border-b-0">
            <dt lang="en" dir="ltr" className="text-left font-en text-[1.0625rem] font-bold">
                {entry.word}
            </dt>
            <dd className="m-0 leading-8">{entry.meaning_fa}</dd>
            {entry.example_en !== null && (
                <dd lang="en" dir="ltr" className="m-0 text-left font-en leading-7 text-muted">
                    {entry.example_en}
                </dd>
            )}
            {!isGuest && (
                <dd className="m-0 mt-1">
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={saved || busy}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[0.9375rem] text-ink transition-colors duration-150 hover:bg-canvas disabled:cursor-default disabled:opacity-70"
                    >
                        <BookOpen size={18} aria-hidden="true" />
                        {saved ? 'ذخیره شد' : 'ذخیره واژه'}
                    </button>
                </dd>
            )}
        </div>
    );
}

export const ReaderShow: FunctionComponent<ReaderProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    topic,
    lesson,
    availableLevels,
    initialPosition,
    completed: completedProp,
    bookmarked: bookmarkedProp,
    isGuest,
    paragraphs,
    glossary,
}: ReaderProps): React.JSX.Element => {
    const { setTrack, seekTo } = usePlayerActions();
    const [completed, setCompleted] = React.useState(completedProp);
    const [bookmarked, setBookmarked] = React.useState(bookmarkedProp);
    const [bookmarkStatus, setBookmarkStatus] = React.useState('');
    const [bookmarkOk, setBookmarkOk] = React.useState(true);
    const [vocabStatus, setVocabStatus] = React.useState('');
    const [vocabOk, setVocabOk] = React.useState(true);
    const [actionStatus, setActionStatus] = React.useState('');
    const [actionOk, setActionOk] = React.useState(true);
    const [busyAction, setBusyAction] = React.useState(false);
    const [confirmReset, setConfirmReset] = React.useState(false);
    const [toast, setToast] = React.useState('');


    // Bind the lesson version to the persistent element. Same key on
    // back/forward revisit keeps time and play state untouched.
    React.useEffect(() => {
        setTrack(
            {
                lessonId: lesson.id,
                audioUrl: lesson.audio_url,
                audioRevision: lesson.audio_revision,
                titleEn: lesson.title_en,
                level: lesson.level,
                coverUrl: topic.cover_url,
                initialPosition,
            },
            {
                canSave: !isGuest,
                onCompleted: () => setCompleted(true),
                onStale: () => {
                    setActionStatus('موقعیت ذخیره‌شده از سرور به‌روز شد.');
                    setActionOk(true);
                },
            },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lesson.id, lesson.audio_revision]);

    // Keep server-fed state in sync when the version changes.
    React.useEffect(() => {
        setCompleted(completedProp);
        setBookmarked(bookmarkedProp);
    }, [lesson.id, completedProp, bookmarkedProp]);

    const toggleBookmark = async (): Promise<void> => {
        if (busyAction) {
            return;
        }
        setBusyAction(true);
        try {
            const response = bookmarked
                ? await deleteJson(`/app/bookmarks/${topic.id}`)
                : await postJson('/app/bookmarks', { topic_id: topic.id });
            if (response.ok) {
                setBookmarked(!bookmarked);
                const message = bookmarked ? 'از ذخیره‌شده‌ها حذف شد.' : 'به ذخیره‌شده‌ها اضافه شد.';
                setBookmarkStatus(message);
                setBookmarkOk(true);
                setToast(message);
            } else {
                setBookmarkStatus('ذخیره ممکن نشد. دوباره تلاش کنید.');
                setBookmarkOk(false);
            }
        } catch {
            setBookmarkStatus('ذخیره ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.');
            setBookmarkOk(false);
        } finally {
            setBusyAction(false);
        }
    };

    const markRead = async (): Promise<void> => {
        if (busyAction) {
            return;
        }
        setBusyAction(true);
        try {
            const response = await postJson('/app/progress/complete', {
                lesson_id: lesson.id,
                audio_revision: lesson.audio_revision,
            });
            if (response.ok) {
                setCompleted(true);
                setActionStatus('این درس تکمیل شد.');
                setActionOk(true);
                setToast('این درس تکمیل شد.');
            } else {
                setActionStatus('ثبت تکمیل ممکن نشد. دوباره تلاش کنید.');
                setActionOk(false);
            }
        } catch {
            setActionStatus('ثبت تکمیل ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.');
            setActionOk(false);
        } finally {
            setBusyAction(false);
        }
    };

    const handleVocabStatus = (message: string, ok: boolean): void => {
        setVocabStatus(message);
        setVocabOk(ok);
        if (ok) {
            setToast(message);
        }
    };

    const resetProgress = async (): Promise<void> => {
        if (busyAction) {
            return;
        }
        setBusyAction(true);
        try {
            const response = await postJson('/app/progress/reset', { lesson_id: lesson.id });
            if (response.ok) {
                setCompleted(false);
                seekTo(0);
                setActionStatus('پیشرفت این درس پاک شد؛ از اول شروع کن.');
                setActionOk(true);
                setToast('پیشرفت این درس پاک شد.');
            } else {
                setActionStatus('شروع دوباره ممکن نشد. دوباره تلاش کنید.');
                setActionOk(false);
            }
        } catch {
            setActionStatus('شروع دوباره ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.');
            setActionOk(false);
        } finally {
            setBusyAction(false);
        }
    };

    return (
        <>
            <Head title={`${lesson.title_en} (${lesson.level})`} />
            <ScreenHeader
                title={lesson.title_en}
                titleLang="en"
                width="reading"
                back={{ href: '/app', label: 'بازگشت به کشف مطالب' }}
            />
            <Toast message={toast} onClose={() => setToast('')} />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-5 sm:gap-6 sm:py-6">
                <header className="grid gap-2.5 sm:gap-3">
                    <p className="m-0 inline-flex items-center gap-1.5 text-sm text-muted">
                        <Gauge size={16} aria-hidden="true" />
                        سطح{' '}
                        <span lang="en" dir="ltr" className="font-en font-bold">
                            {lesson.level}
                        </span>
                        <span aria-hidden="true">·</span>
                        <Clock size={16} aria-hidden="true" />
                        حدود {lesson.estimated_minutes.toLocaleString('fa-IR')} دقیقه مطالعه
                    </p>
                    <h2 lang="en" dir="ltr" className="m-0 text-left font-en text-3xl leading-[1.35] font-extrabold tracking-tight sm:text-4xl">
                        {lesson.title_en}
                    </h2>
                    {topic.summary_public !== null && topic.summary_public !== '' && (
                        <p dir="auto" className="m-0 text-[1.0625rem] leading-8 text-muted">
                            {topic.summary_public}
                        </p>
                    )}
                    {topic.cover_url !== null && (
                        <img
                            src={topic.cover_url}
                            alt=""
                            loading="eager"
                            fetchPriority="high"
                            className="block aspect-video h-auto w-full rounded-3xl border border-line bg-canvas object-cover sm:max-w-[26rem]"
                        />
                    )}
                    <nav aria-label="سطح درس" className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <p className="m-0 text-sm font-bold text-muted">سطح این مطلب:</p>
                        <div className="flex flex-wrap gap-2">
                            {availableLevels.map((level) => (
                                <Link
                                    key={level}
                                    href={`/app/topics/${topic.slug}?level=${level}`}
                                    aria-current={level === lesson.level ? 'page' : undefined}
                                    className={
                                        level === lesson.level
                                            ? 'inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-5 py-2 font-en font-bold text-surface no-underline'
                                            : 'inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-5 py-2 font-en text-ink no-underline hover:bg-canvas'
                                    }
                                >
                                    <span lang="en" dir="ltr">
                                        {level}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </nav>
                </header>

                {/* Lesson binding for the persistent player (S1 no-mixing
                    proof: the audio URL in the document belongs only to the
                    active level) + the anonymous-resume probe. */}
                <div
                    id="fe-lesson-data"
                    data-lesson-id={lesson.id}
                    data-audio-url={lesson.audio_url}
                    data-revision={lesson.audio_revision}
                    data-initial-position={initialPosition}
                    data-topic={topic.title_en}
                    data-level={lesson.level}
                    data-cover-url={topic.cover_url ?? '/icons/icon-192.png'}
                    data-authenticated={isGuest ? '0' : '1'}
                    data-completed={completed ? '1' : '0'}
                    hidden
                />

                {initialPosition > 1 && !completed && (
                    <p role="status" className="m-0 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
                        <Headphones size={20} aria-hidden="true" />
                        ادامه از موقعیت ذخیره‌شده
                    </p>
                )}
                {completed && (
                    <p role="status" className="m-0 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-success">
                        <Check size={20} aria-hidden="true" />
                        این درس تکمیل شده است
                    </p>
                )}

                {!isGuest && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            id="bookmark-toggle"
                            type="button"
                            onClick={() => void toggleBookmark()}
                            data-topic-id={topic.id}
                            data-bookmarked={bookmarked ? '1' : '0'}
                            aria-pressed={bookmarked ? 'true' : 'false'}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink transition-colors duration-150 hover:bg-canvas"
                        >
                            <Bookmark size={20} aria-hidden="true" />
                            <span>{bookmarked ? 'حذف از ذخیره‌شده‌ها' : 'ذخیره برای بعد'}</span>
                        </button>
                    </div>
                )}
                <div aria-live="polite" className="grid gap-1">
                    {bookmarkStatus !== '' && (
                        <p
                            id="bookmark-status"
                            role={bookmarkOk ? 'status' : 'alert'}
                            className={bookmarkOk ? 'm-0 text-sm leading-7 text-muted' : 'm-0 text-sm leading-7 text-danger'}
                        >
                            {bookmarkStatus}
                        </p>
                    )}
                    {actionStatus !== '' && (
                        <p
                            role={actionOk ? 'status' : 'alert'}
                            className={actionOk ? 'm-0 text-sm leading-7 text-muted' : 'm-0 text-sm leading-7 text-danger'}
                        >
                            {actionStatus}
                        </p>
                    )}
                </div>

                <article lang="en" dir="ltr" className="fe-english-body grid gap-5">
                    {paragraphs.map((paragraph, index) => (
                        <p key={index} className="m-0 text-left font-en text-[1.125rem] leading-8">
                            {paragraph}
                        </p>
                    ))}
                </article>

                <section aria-label="واژه‌های کلیدی" className="grid gap-1 rounded-3xl border border-line bg-surface px-5 py-2">
                    <h2 className="m-0 flex items-center gap-2 pt-3 pb-1 text-xl leading-8">
                        <BookOpen size={20} aria-hidden="true" />
                        واژه‌های کلیدی
                    </h2>
                    {glossary.length > 0 ? (
                        <dl className="m-0">
                            {glossary.map((entry) => (
                                <GlossaryRow key={entry.word} entry={entry} lessonId={lesson.id} isGuest={isGuest} onSaved={handleVocabStatus} />
                            ))}
                        </dl>
                    ) : (
                        <p role="note" className="m-0 py-4 leading-8 text-muted">
                            برای این درس واژه‌ای ثبت نشده است.
                        </p>
                    )}
                    {!isGuest && vocabStatus !== '' && (
                        <p
                            id="vocab-status"
                            role={vocabOk ? 'status' : 'alert'}
                            className={vocabOk ? 'm-0 py-3 text-sm leading-7 text-muted' : 'm-0 py-3 text-sm leading-7 text-danger'}
                        >
                            {vocabStatus}
                        </p>
                    )}
                </section>

                {/* Completion belongs after the reading surface, not before it. */}
                {!isGuest && (
                    <section aria-label="پایان درس" className="grid gap-3 border-t border-line pt-6">
                        <div>
                            <h2 className="m-0 text-xl leading-8">پایان درس</h2>
                            <p className="m-0 mt-1 text-sm leading-7 text-muted">
                                اگر متن را خواندی، درس را تکمیل کن تا در برنامه امروزت ثبت شود.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {!completed ? (
                                <button
                                    id="mark-read"
                                    type="button"
                                    onClick={() => void markRead()}
                                    data-lesson-id={lesson.id}
                                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover"
                                >
                                    <Check size={20} aria-hidden="true" />
                                    خواندم
                                </button>
                            ) : confirmReset ? (
                                <span className="inline-flex flex-wrap items-center gap-2">
                                    <button
                                        id="reset-progress-confirm"
                                        type="button"
                                        onClick={() => void resetProgress()}
                                        disabled={busyAction}
                                        data-lesson-id={lesson.id}
                                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-danger px-4 py-2 font-bold text-surface transition-colors duration-150 hover:opacity-90 disabled:opacity-60"
                                    >
                                        <RotateCcw size={20} aria-hidden="true" />
                                        بله، از اول شروع کن
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmReset(false)}
                                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center rounded-full border border-line bg-surface px-4 py-2 text-ink transition-colors duration-150 hover:bg-canvas"
                                    >
                                        لغو
                                    </button>
                                </span>
                            ) : (
                                <button
                                    id="reset-progress"
                                    type="button"
                                    onClick={() => setConfirmReset(true)}
                                    data-lesson-id={lesson.id}
                                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink transition-colors duration-150 hover:bg-canvas"
                                >
                                    <RotateCcw size={20} aria-hidden="true" />
                                    شروع دوباره
                                </button>
                            )}
                            <Link
                                href="/app"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full px-4 py-2 text-sm font-bold text-muted no-underline hover:bg-surface hover:text-ink"
                            >
                                بازگشت به کشف مطالب
                            </Link>
                        </div>
                    </section>
                )}
            </div>
        </>
    );
};

ReaderShow.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default ReaderShow;
