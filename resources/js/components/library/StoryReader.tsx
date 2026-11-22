import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { HighlightedText } from '@/components/library/HighlightedText';
import { PanelImage } from '@/components/library/PanelImage';
import { WordPreview } from '@/components/library/WordPreview';
import { postJson } from '@/lib/http';
import { activeSentenceIndex, formatClock } from '@/lib/reading';
import { useReaderTrack } from '@/lib/reader-player';
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
    revision: number;
    credit?: string | null;
}

/**
 * Story / Inside Reading reader.
 *
 * One page = one text, and (when the book's 2×3 sheet maps one) one panel.
 * The image belongs to that page only and is shown directly above its text;
 * the next page shows its own text/panel or no image at all. There is no
 * six-frame strip and no inherited picture. Audio is a slice of the one
 * persistent shell player, never a second console.
 */
export function StoryReader({
    node,
    breadcrumbs,
    chapters,
    art,
    progress,
    endpoints,
    revision,
    credit,
}: StoryReaderProps): React.JSX.Element {
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
    const [continuous, setContinuous] = useState(false);
    const nextAutoplay = useRef(false);
    const timeRef = useRef(0);
    const endHandled = useRef<string | null>(null);
    const wordAudioRef = useRef<HTMLAudioElement | null>(null);

    const entry = flat[index];
    const page = entry?.page;
    const panelIndex = page?.panel_index ?? null;
    const imageUrl = page?.image_url ?? null;
    const hasImage = panelIndex !== null || imageUrl !== null;
    const pageStart = page !== undefined && page.audio_url !== null ? 0 : (page?.audio_start_ms ?? 0);
    const initialPosition = savedIndex === index && progress !== null ? Math.max(0, progress.position_ms - pageStart) : 0;
    const audio = useReaderTrack({
        audioUrl: page?.audio_url ?? entry?.chapter.audio_url ?? null,
        pageKey: `${node.id}:${page?.id ?? 'none'}`,
        titleEn: entry?.chapter.title_en ?? entry?.chapter.title_fa ?? node.title_en ?? 'خواندن',
        level: node.track === 'inside_reading' ? '' : (node.level ?? ''),
        coverUrl: node.cover_url,
        audioRevision: revision,
        startMs: pageStart,
        endMs: page?.audio_end_ms ?? null,
        initialPositionMs: initialPosition,
        autoplay: nextAutoplay.current,
    });

    timeRef.current = audio.timeMs + pageStart;
    const activeIndex = activeSentenceIndex(page?.sentences ?? [], audio.timeMs + pageStart);
    const parent = [...breadcrumbs].reverse().find((crumb) => crumb.url !== null);
    const isLast = index === flat.length - 1;
    const chapterLabel = entry?.chapter.title_en ?? entry?.chapter.title_fa ?? null;

    const goTo = (nextIndex: number, autoplay = audio.playing): void => {
        if (nextIndex < 0 || nextIndex >= flat.length) {
            return;
        }
        nextAutoplay.current = autoplay;
        endHandled.current = null;
        setIndex(nextIndex);
    };

    const save = (pageKey: string, positionMs: number, completed = false): void => {
        void postJson(endpoints.progress, {
            page_key: pageKey,
            position_ms: Math.max(0, Math.round(positionMs)),
            completed,
        }).catch(() => undefined);
    };

    useEffect(() => {
        const current = flat[index];
        const timer = window.setInterval(() => {
            if (current !== undefined && audio.playing) {
                save(current.page.id, timeRef.current, false);
            }
        }, 5000);

        return () => {
            window.clearInterval(timer);
            if (current !== undefined) {
                save(current.page.id, timeRef.current, false);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, audio.playing]);

    useEffect(() => {
        if (page === undefined) {
            return;
        }
        const key = `${page.id}`;
        if (audio.durationMs <= 0 || audio.timeMs < audio.durationMs - 320 || endHandled.current === key) {
            return;
        }

        endHandled.current = key;
        if (continuous && !isLast) {
            save(page.id, audio.durationMs + pageStart, false);
            goTo(index + 1, true);

            return;
        }

        audio.pause();
        save(page.id, audio.durationMs + pageStart, isLast);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audio.timeMs, audio.durationMs, page?.id, continuous, isLast, index]);

    const playWord = (word: ReadingWord): void => {
        const wordAudio = wordAudioRef.current;
        if (word.audio_url === null || wordAudio === null) {
            return;
        }

        const wasPlaying = audio.playing;
        audio.pause();
        wordAudio.src = word.audio_url;
        wordAudio.onended = () => {
            if (wasPlaying) {
                audio.play();
            }
        };
        void wordAudio.play().catch(() => {
            if (wasPlaying) {
                audio.play();
            }
        });
    };

    const highlightIndex = audio.playing ? activeIndex : null;

    if (entry === undefined || page === undefined) {
        return (
            <section className="mx-auto grid w-full max-w-[680px] gap-3 px-4 py-10">
                <h1 className="m-0 text-xl font-extrabold">{node.title_fa ?? node.title_en}</h1>
                <p className="m-0 text-sm leading-7 text-muted">صفحه‌ای برای این بخش ثبت نشده است.</p>
            </section>
        );
    }

    return (
        <div className="mx-auto grid w-full max-w-[920px] gap-4 px-4 py-4 pb-32 sm:gap-5 sm:py-5 sm:pb-32">
            <header className="grid gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="m-0 text-xl leading-8 font-extrabold sm:text-2xl">{node.title_fa ?? node.title_en}</h2>
                    <span className="font-en text-xs font-bold text-muted" dir="ltr">
                        {index + 1} / {flat.length}
                    </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p lang="en" dir="ltr" className="m-0 font-en text-xs font-bold text-muted">
                        {chapterLabel ?? node.title_en}
                    </p>
                    {progress !== null && progress.same_revision && progress.position_ms > 500 && savedIndex === index && (
                        <p className="m-0 inline-flex items-center gap-1.5 text-[0.72rem] font-bold text-accent-strong">
                            <BookOpen size={13} aria-hidden="true" />
                            ادامه از {formatClock(progress.position_ms)}
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
            </header>

            <WordPreview words={page.words} onPlay={playWord} />

            <article className="mx-auto grid w-full max-w-[72ch] gap-4 rounded-3xl border border-line bg-surface p-4 sm:p-6 lg:p-7">
                {hasImage && (
                    <PanelImage
                        art={art}
                        panelIndex={panelIndex}
                        imageUrl={imageUrl}
                        alt={page.alt_fa}
                        className="aspect-[2/1] w-full"
                    />
                )}

                <p
                    lang="en"
                    dir="ltr"
                    className="m-0 font-en text-[1.12rem] leading-[1.95] text-ink text-pretty sm:text-[1.18rem]"
                >
                    <HighlightedText
                        text={page.text_en}
                        sentences={page.sentences}
                        activeIndex={highlightIndex}
                        words={page.words}
                        onWordClick={playWord}
                    />
                </p>

                {page.text_fa !== null && page.text_fa !== '' && (
                    <p className="m-0 border-t border-line pt-3 text-sm leading-7 text-muted">{page.text_fa}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <button
                        type="button"
                        onClick={() => goTo(index - 1, false)}
                        disabled={index === 0}
                        className="fe-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-canvas px-4 text-sm font-bold text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ArrowRight size={16} aria-hidden="true" />
                        صفحهٔ قبل
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setContinuous((value) => !value)}
                            aria-pressed={continuous}
                            className={`inline-flex min-h-10 items-center rounded-full border px-3 text-[0.7rem] font-bold transition-colors ${
                                continuous
                                    ? 'border-accent-strong bg-accent-strong/10 text-accent-strong'
                                    : 'border-line bg-canvas text-muted hover:text-ink'
                            }`}
                        >
                            پخش پیوسته
                        </button>
                        <button
                            type="button"
                            onClick={() => goTo(index + 1, audio.playing)}
                            disabled={isLast}
                            className="fe-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-surface disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            صفحهٔ بعد
                            <ArrowLeft size={16} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </article>

            {isLast && (
                <section className="grid gap-2 rounded-2xl border border-line bg-surface p-4 text-center">
                    <h2 className="m-0 text-lg font-extrabold">پایان این داستان</h2>
                    <p className="m-0 text-sm leading-7 text-muted">
                        می‌توانی دوباره از ابتدا بخوانی یا به قفسه برگردی و داستان بعدی را انتخاب کنی.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => goTo(0, false)}
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

            <audio ref={wordAudioRef} preload="none" className="hidden" />
            <span className="sr-only" aria-live="polite">
                صفحهٔ {index + 1} از {flat.length}
            </span>
        </div>
    );
}
