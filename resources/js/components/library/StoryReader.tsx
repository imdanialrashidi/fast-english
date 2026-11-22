import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { HighlightedText } from '@/components/library/HighlightedText';
import { PanelImage } from '@/components/library/PanelImage';
import { ReaderAudioBar } from '@/components/library/ReaderAudioBar';
import { WordPreview } from '@/components/library/WordPreview';
import { postJson } from '@/lib/http';
import { activeSentenceIndex, formatClock } from '@/lib/reading';
import type {
    LibraryBreadcrumb,
    ReadingArt,
    ReadingChapter,
    ReadingEndpoints,
    ReadingNode,
    ReadingPage,
    ReadingProgressState,
    ReadingWord,
} from '@/types';

interface FlatPage {
    chapter: ReadingChapter;
    chapterIndex: number;
    page: ReadingPage;
    pageIndex: number;
}

interface StoryReaderProps {
    node: ReadingNode;
    breadcrumbs: LibraryBreadcrumb[];
    chapters: ReadingChapter[];
    art: ReadingArt | null;
    progress: ReadingProgressState | null;
    endpoints: ReadingEndpoints;
    credit?: string | null;
}

/**
 * Story / Inside Reading reader: image first (one panel of the book's 2×3
 * sheet), a collapsible word preview above it, the English page with the
 * spoken sentence softly highlighted, and the transport. Narration always
 * starts from the page's real offset; a page without a panel never inherits
 * the previous picture.
 */
export function StoryReader({ node, breadcrumbs, chapters, art, progress, endpoints, credit }: StoryReaderProps): React.JSX.Element {
    const flat = useMemo<FlatPage[]>(
        () =>
            chapters.flatMap((chapter, chapterIndex) =>
                chapter.pages.map((page, pageIndex) => ({ chapter, chapterIndex, page, pageIndex })),
            ),
        [chapters],
    );

    const savedIndex = useMemo(() => {
        if (progress === null || !progress.same_revision) {
            return -1;
        }

        return flat.findIndex((entry) => entry.page.id === progress.page_key);
    }, [flat, progress]);

    const [index, setIndex] = useState(savedIndex >= 0 ? savedIndex : 0);
    const [playing, setPlaying] = useState(false);
    const [timeMs, setTimeMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [rate, setRate] = useState(1);
    const [continuous, setContinuous] = useState(false);
    const canResume =
        savedIndex >= 0 &&
        progress !== null &&
        progress.position_ms > 500 &&
        (flat[savedIndex]?.chapter.audio_url !== null || flat[savedIndex]?.page.audio_url !== null);
    const resumeOffset =
        canResume && progress !== null
            ? Math.max(0, progress.position_ms - (flat[savedIndex]?.page.audio_start_ms ?? 0))
            : 0;
    const [resumeNote, setResumeNote] = useState(canResume ? `ادامه از ${formatClock(resumeOffset)}` : null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const wordAudioRef = useRef<HTMLAudioElement | null>(null);
    const pendingSeekRef = useRef<number | null>(canResume && progress !== null ? progress.position_ms : null);
    const resumeAfterLoadRef = useRef(false);
    const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
    const mountedRef = useRef(false);

    const entry = flat[index];
    const audioSrc = entry?.page.audio_url ?? entry?.chapter.audio_url ?? null;
    const pageStart = entry === undefined ? 0 : entry.page.audio_url !== null ? 0 : entry.page.audio_start_ms ?? 0;
    const pageEnd = entry?.page.audio_end_ms ?? null;

    useEffect(() => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }

        if (audioSrc === null) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            setDurationMs(0);

            return;
        }

        const absolute = new URL(audioSrc, window.location.href).href;
        if (audio.src !== absolute) {
            audio.src = audioSrc;
            audio.load();
        }
    }, [audioSrc]);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio === null || entry === undefined) {
            return;
        }

        const target = pendingSeekRef.current ?? pageStart;
        pendingSeekRef.current = null;

        if (audio.readyState >= 1 && Number.isFinite(audio.duration)) {
            audio.currentTime = target / 1000;
            setDurationMs(audio.duration * 1000);
            if (resumeAfterLoadRef.current) {
                void audio.play().catch(() => setPlaying(false));
            }
        } else {
            pendingSeekRef.current = target;
        }

    }, [entry, pageStart]);

    useEffect(() => {
        if (!mountedRef.current) {
            mountedRef.current = true;

            return;
        }

        scrollAnchorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, [index]);

    useEffect(() => {
        const current = flat[index];
        const audio = audioRef.current;

        return () => {
            if (current !== undefined) {
                void saveProgress(endpoints.progress, current.page.id, (audio?.currentTime ?? 0) * 1000, false);
            }
        };
    }, [endpoints.progress, flat, index]);

    useEffect(() => {
        if (!playing) {
            return;
        }

        const timer = window.setInterval(() => {
            const current = flat[index];
            const audio = audioRef.current;
            if (current !== undefined && audio !== null) {
                void saveProgress(endpoints.progress, current.page.id, audio.currentTime * 1000, false);
            }
        }, 5000);

        return () => window.clearInterval(timer);
    }, [endpoints.progress, flat, index, playing]);

    if (entry === undefined) {
        return (
            <section className="mx-auto grid w-full max-w-[680px] gap-3 px-4 py-10">
                <h1 className="m-0 text-xl font-extrabold">{node.title_fa ?? node.title_en}</h1>
                <p className="m-0 text-sm leading-7 text-muted">صفحه‌ای برای این بخش ثبت نشده است.</p>
            </section>
        );
    }

    const page = entry.page;
    const activeIndex = activeSentenceIndex(page.sentences, timeMs);
    const parent = [...breadcrumbs].reverse().find((crumb) => crumb.url !== null);
    const isLast = index === flat.length - 1;
    const chapterLabel = entry.chapter.title_en ?? entry.chapter.title_fa;

    const goTo = (nextIndex: number, options?: { resume?: boolean }): void => {
        if (nextIndex < 0 || nextIndex >= flat.length) {
            return;
        }
        resumeAfterLoadRef.current = options?.resume ?? playing;
        pendingSeekRef.current = null;
        setIndex(nextIndex);
    };

    const toggle = (): void => {
        const audio = audioRef.current;
        if (audio === null || audioSrc === null) {
            return;
        }
        if (audio.paused) {
            void audio.play().catch(() => setPlaying(false));
        } else {
            audio.pause();
        }
    };

    const seek = (ms: number): void => {
        const audio = audioRef.current;
        if (audio !== null) {
            audio.currentTime = ms / 1000;
            setTimeMs(ms);
        }
    };

    const playWord = (word: ReadingWord): void => {
        const wordAudio = wordAudioRef.current;
        const narration = audioRef.current;
        if (word.audio_url === null || wordAudio === null) {
            return;
        }

        const wasPlaying = narration !== null && !narration.paused;
        narration?.pause();
        wordAudio.src = word.audio_url;
        wordAudio.onended = () => {
            if (wasPlaying) {
                void narration?.play().catch(() => setPlaying(false));
            }
        };
        void wordAudio.play().catch(() => {
            if (wasPlaying) {
                void narration?.play().catch(() => setPlaying(false));
            }
        });
    };

    const handleTime = (): void => {
        const audio = audioRef.current;
        if (audio === null) {
            return;
        }

        const current = audio.currentTime * 1000;
        setTimeMs(current);

        if (pageEnd !== null && current >= pageEnd) {
            if (continuous && !isLast) {
                goTo(index + 1, { resume: true });
            } else {
                audio.pause();
                if (isLast) {
                    void saveProgress(endpoints.progress, page.id, current, true);
                }
            }
        }
    };

    return (
        <div className="mx-auto grid w-full max-w-[1040px] gap-4 px-4 py-4 pb-32 sm:gap-5 sm:py-5 sm:pb-32">
            <div className="flex items-center justify-between gap-3">
                <Link
                    href={parent?.url ?? '/app/books'}
                    className="fe-press inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-muted no-underline hover:text-ink"
                >
                    <ArrowRight size={16} aria-hidden="true" />
                    {parent?.title ?? 'کتاب‌ها'}
                </Link>
                <span className="font-en text-xs font-bold text-muted" dir="ltr">
                    {index + 1} / {flat.length}
                </span>
            </div>

            <header className="grid gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="m-0 text-lg leading-8 font-extrabold sm:text-xl">{node.title_fa ?? node.title_en}</h2>
                    {chapterLabel !== null && chapterLabel !== undefined && (
                        <p lang="en" dir="ltr" className="m-0 font-en text-xs font-bold text-muted">
                            {chapterLabel}
                        </p>
                    )}
                </div>
                <div
                    role="progressbar"
                    aria-label="پیشرفت داستان"
                    aria-valuemin={1}
                    aria-valuemax={flat.length}
                    aria-valuenow={index + 1}
                    className="h-1 w-full overflow-hidden rounded-full bg-line"
                >
                    <div
                        className="h-full rounded-full bg-accent transition-[width] duration-300"
                        style={{ width: `${((index + 1) / flat.length) * 100}%` }}
                    />
                </div>
                {resumeNote !== null && (
                    <p className="m-0 inline-flex items-center gap-1.5 text-[0.72rem] font-bold text-accent-strong">
                        <BookOpen size={13} aria-hidden="true" />
                        {resumeNote} — برای ادامه پخش را بزن.
                    </p>
                )}
            </header>

            <div ref={scrollAnchorRef} />

            <WordPreview words={page.words} onPlay={playWord} />

            {page.panel_index === null && page.image_url === null && node.cover_url !== null && (
                <div
                    className={`relative overflow-hidden rounded-3xl bg-ink ${
                        entry.pageIndex === 0 ? 'aspect-[16/9]' : ''
                    }`}
                >
                    <img
                        src={node.cover_url}
                        alt=""
                        className={entry.pageIndex === 0 ? 'h-full w-full object-cover' : 'h-24 w-full object-cover object-top'}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-surface">
                        <div className="min-w-0">
                            <p className="m-0 font-en text-[0.6rem] font-bold tracking-[0.16em] text-surface/70 uppercase">
                                {entry.pageIndex === 0 ? 'فصل' : 'ادامهٔ فصل'}
                            </p>
                            <p lang="en" dir="ltr" className="m-0 truncate font-en text-sm font-bold sm:text-base">
                                {chapterLabel ?? node.title_en}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
                {page.panel_index !== null || page.image_url !== null ? (
                    <PanelImage
                        art={art}
                        panelIndex={page.panel_index}
                        imageUrl={page.image_url}
                        alt={page.alt_fa}
                        className="aspect-[2/1] w-full lg:sticky lg:top-20"
                    />
                ) : null}

                <article className="grid gap-4 rounded-3xl border border-line bg-surface p-4 sm:p-6">
                    <p
                        lang="en"
                        dir="ltr"
                        className="m-0 max-w-[66ch] font-en text-[1.05rem] leading-8 text-ink sm:text-[1.12rem] sm:leading-9"
                    >
                        <HighlightedText
                            text={page.text_en}
                            sentences={page.sentences}
                            activeIndex={activeIndex}
                            words={page.words}
                            onWordClick={playWord}
                        />
                    </p>

                    {page.text_fa !== null && page.text_fa !== '' && (
                        <p className="m-0 border-t border-line pt-3 text-sm leading-7 text-muted">{page.text_fa}</p>
                    )}

                    <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                        <button
                            type="button"
                            onClick={() => goTo(index - 1)}
                            disabled={index === 0}
                            className="fe-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-canvas px-4 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ArrowRight size={16} aria-hidden="true" />
                            صفحهٔ قبل
                        </button>
                        <button
                            type="button"
                            onClick={() => goTo(index + 1)}
                            disabled={isLast}
                            className="fe-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-surface disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            صفحهٔ بعد
                            <ArrowLeft size={16} aria-hidden="true" />
                        </button>
                    </div>
                </article>
            </div>

            <ReaderAudioBar
                disabled={audioSrc === null}
                playing={playing}
                timeMs={pageEnd !== null ? Math.max(0, timeMs - pageStart) : timeMs}
                durationMs={pageEnd !== null ? Math.max(0, pageEnd - pageStart) : durationMs}
                onToggle={toggle}
                onSeek={(ms) => seek(pageEnd !== null ? pageStart + ms : ms)}
                rate={rate}
                onRate={(next) => {
                    setRate(next);
                    if (audioRef.current !== null) {
                        audioRef.current.playbackRate = next;
                    }
                }}
                continuous={continuous}
                onContinuous={setContinuous}
            />

            {isLast && (
                <section className="grid gap-2 rounded-2xl border border-line bg-surface p-4 text-center">
                    <h2 className="m-0 text-lg font-extrabold">پایان این داستان</h2>
                    <p className="m-0 text-sm leading-7 text-muted">
                        می‌توانی دوباره از ابتدا بخوانی یا به قفسه برگردی و داستان بعدی را انتخاب کنی.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => goTo(0, { resume: false })}
                            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-bold text-ink"
                        >
                            از ابتدا
                        </button>
                        <Link
                            href={parent?.url ?? '/app/books'}
                            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-surface no-underline"
                        >
                            بازگشت به فهرست
                        </Link>
                    </div>
                </section>
            )}

            {credit !== null && credit !== undefined && (
                <p className="m-0 text-center text-[0.65rem] text-muted">{credit}</p>
            )}

            <audio
                ref={audioRef}
                preload="metadata"
                onLoadedMetadata={() => {
                    const audio = audioRef.current;
                    if (audio === null) {
                        return;
                    }
                    const target = pendingSeekRef.current ?? pageStart;
                    pendingSeekRef.current = null;
                    audio.currentTime = target / 1000;
                    audio.playbackRate = rate;
                    setDurationMs(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0);
                    setTimeMs(target);
                    if (resumeAfterLoadRef.current) {
                        void audio.play().catch(() => setPlaying(false));
                    }
                }}
                onTimeUpdate={handleTime}
                onPlay={() => {
                    setPlaying(true);
                    setResumeNote(null);
                }}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                    setPlaying(false);
                    if (continuous && !isLast) {
                        goTo(index + 1, { resume: true });
                    } else if (isLast) {
                        void saveProgress(endpoints.progress, page.id, timeMs, true);
                    }
                }}
                className="hidden"
            />
            <audio ref={wordAudioRef} preload="none" className="hidden" />
        </div>
    );
}

async function saveProgress(url: string, pageKey: string, positionMs: number, completed: boolean): Promise<void> {
    await postJson(url, {
        page_key: pageKey,
        position_ms: Math.max(0, Math.round(positionMs)),
        completed,
    }).catch(() => undefined);
}
