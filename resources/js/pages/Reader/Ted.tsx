import { Head, Link } from '@inertiajs/react';
import { BookOpen, ChevronDown, Clock, Headphones, Pause, Play } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { LevelTabs } from '@/components/LevelTabs';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import { usePlayer } from '@/lib/player';
import type { SharedProps, TedSentence, TedTalkPayload, TopicPayload } from '@/types';

/**
 * Seventh reader tab (owner request 2026-11-21): one TED talk beside the
 * podcast levels.
 *
 * The official cue times drive one calm sentence highlight while the talk
 * plays through the persistent player (listening only, no progress writes).
 * The ten-word gloss is collapsed by default; the cover and the transcript
 * sit below it. Layout order is fixed: title → meta → actions → new words →
 * cover → synced transcript → source.
 */

interface TedProps extends SharedProps {
    topic: TopicPayload;
    talk: TedTalkPayload;
    availableLevels: string[];
}

function estimateMinutes(seconds: number): number {
    return Math.max(1, Math.round(seconds / 60));
}

const Paragraph = React.memo(function Paragraph({
    sentences,
    startIndex,
    activeIndex,
}: {
    sentences: TedSentence[];
    startIndex: number;
    activeIndex: number;
}): React.JSX.Element {
    return (
        <p className="m-0 text-left font-en text-[1.125rem] leading-9">
            {sentences.map((sentence, offset) => {
                const index = startIndex + offset;
                const active = index === activeIndex;
                return (
                    <React.Fragment key={index}>
                        <span
                            className="fe-ted-sentence"
                            data-active={active ? 'true' : undefined}
                            aria-current={active ? 'true' : undefined}
                        >
                            {sentence.text}
                        </span>{' '}
                    </React.Fragment>
                );
            })}
        </p>
    );
});

export const TedShow: FunctionComponent<TedProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    topic,
    talk,
    availableLevels,
}: TedProps): React.JSX.Element => {
    const { setTrack, toggle, playing, time } = usePlayer();
    const articleRef = React.useRef<HTMLElement | null>(null);
    const manualUntil = React.useRef(0);

    // Bind the talk to the persistent player. A TED talk never writes
    // lesson progress, so the callbacks are no-ops and canSave is false.
    React.useEffect(() => {
        setTrack(
            {
                kind: 'ted',
                lessonId: talk.id,
                audioUrl: talk.audio_url,
                audioRevision: talk.audio_revision,
                titleEn: talk.title_en,
                level: 'TED',
                coverUrl: talk.cover_url,
                initialPosition: 0,
            },
            { canSave: false, onCompleted: () => {}, onStale: () => {} },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [talk.id]);

    const flat = React.useMemo(() => talk.segments.flat(), [talk.segments]);
    const starts = React.useMemo(() => flat.map((sentence) => sentence.t), [flat]);
    const offsets = React.useMemo(() => {
        let running = 0;

        return talk.segments.map((paragraph) => {
            const offset = running;
            running += paragraph.length;

            return offset;
        });
    }, [talk.segments]);

    const activeIndex = React.useMemo(() => {
        const ms = Math.round(time * 1000);
        let low = 0;
        let high = starts.length - 1;
        let found = -1;

        while (low <= high) {
            const middle = (low + high) >> 1;
            const start = starts[middle] ?? 0;
            if (start <= ms) {
                found = middle;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        return found;
    }, [time, starts]);

    // Follow the read sentence only when it leaves the comfortable band.
    // A user who scrolls, swipes or uses the keyboard takes over for 8 s.
    React.useEffect(() => {
        const pause = (): void => {
            manualUntil.current = Date.now() + 8000;
        };

        window.addEventListener('wheel', pause, { passive: true });
        window.addEventListener('touchmove', pause, { passive: true });
        window.addEventListener('keydown', pause);

        return () => {
            window.removeEventListener('wheel', pause);
            window.removeEventListener('touchmove', pause);
            window.removeEventListener('keydown', pause);
        };
    }, []);

    React.useEffect(() => {
        if (activeIndex < 0 || Date.now() < manualUntil.current) {
            return;
        }

        const element = articleRef.current?.querySelector<HTMLElement>('[data-active="true"]');
        if (element === null || element === undefined) {
            return;
        }

        const rect = element.getBoundingClientRect();
        if (rect.top < 96 || rect.bottom > window.innerHeight - 140) {
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            element.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        }
    }, [activeIndex]);

    const minutes = estimateMinutes(talk.duration_seconds);

    return (
        <>
            <Head title={`${talk.title_en} (TED Talk)`} />
            <ScreenHeader
                title={talk.title_en}
                titleLang="en"
                width="reading"
                back={{ href: `/app/topics/${topic.slug}`, label: 'بازگشت به درس پادکست' }}
            />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-5 sm:gap-6 sm:py-6">
                <header className="grid gap-2.5 sm:gap-3">
                    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                        <span className="fe-chip px-2 py-0.5 font-en text-[0.75rem] font-bold">TED Talk</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1.5">
                            <Clock size={16} aria-hidden="true" />
                            {minutes.toLocaleString('fa-IR')} دقیقه
                        </span>
                        {talk.speaker !== '' && (
                            <>
                                <span aria-hidden="true">·</span>
                                <span lang="en" dir="ltr" className="font-en">
                                    {talk.speaker}
                                </span>
                            </>
                        )}
                    </p>
                    <h2 lang="en" dir="ltr" className="m-0 text-left font-en text-3xl leading-[1.35] font-extrabold tracking-tight sm:text-4xl">
                        {talk.title_en}
                    </h2>
                    <p className="m-0 text-sm leading-7 text-muted">
                        از مجموعهٔ{' '}
                        <Link href={`/app/topics/${topic.slug}`} className="font-bold text-primary underline underline-offset-4">
                            {topic.title_en}
                        </Link>
                    </p>
                    <LevelTabs
                        topicSlug={topic.slug}
                        levels={availableLevels}
                        activeLevel={null}
                        ted={{ url: `/app/topics/${topic.slug}/ted`, minutes }}
                    />
                </header>

                <div className="grid gap-2 rounded-3xl border border-line bg-surface p-4 sm:p-5">
                    <button
                        id="ted-play"
                        type="button"
                        onClick={toggle}
                        className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover sm:w-auto"
                    >
                        {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
                        {playing ? 'توقف پخش' : 'پخش و دنبال‌کردن متن'}
                    </button>
                    <p className="m-0 flex items-start gap-1.5 text-xs leading-6 text-muted">
                        <Headphones size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                        جمله‌ای که خوانده می‌شود آرام هایلایت می‌شود. اگر خودت اسکرول کنی، صفحه کمی صبر می‌کند.
                    </p>
                </div>

                <details className="fe-ted-words group rounded-3xl border border-line bg-surface">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        <BookOpen size={18} aria-hidden="true" className="shrink-0 text-primary" />
                        <span lang="en" dir="ltr" className="font-en text-[0.9375rem] font-bold">
                            new words
                        </span>
                        <span className="text-xs text-muted">{talk.words.length.toLocaleString('fa-IR')} واژه</span>
                        <ChevronDown
                            size={18}
                            aria-hidden="true"
                            className="fe-ted-chevron ms-auto shrink-0 text-muted"
                        />
                    </summary>
                    <dl className="m-0 grid gap-x-6 gap-y-3 border-t border-line px-4 pt-3 pb-4 sm:grid-cols-2">
                        {talk.words.map((word) => (
                            <div key={word.word} className="grid gap-0.5">
                                <dt lang="en" dir="ltr" className="text-left font-en text-[0.9375rem] font-bold">
                                    {word.word}
                                </dt>
                                <dd dir="ltr" className="m-0 flex flex-wrap items-baseline gap-x-2 text-left">
                                    <span lang="en" className="font-en text-sm leading-6 text-muted">
                                        {word.en}
                                    </span>
                                    {word.fa !== null && (
                                        <span lang="fa" dir="rtl" className="text-sm leading-6">
                                            {word.fa}
                                        </span>
                                    )}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </details>

                {talk.cover_url !== null && (
                    <img
                        src={talk.cover_url}
                        alt=""
                        loading="eager"
                        className="block aspect-video h-auto w-full rounded-2xl border border-line bg-canvas object-cover sm:rounded-3xl"
                    />
                )}

                <article
                    ref={articleRef}
                    lang="en"
                    dir="ltr"
                    aria-label="متن هم‌زمان با پخش"
                    className="fe-english-body grid gap-5"
                >
                    {talk.segments.map((paragraph, index) => (
                        <Paragraph
                            key={index}
                            sentences={paragraph}
                            startIndex={offsets[index] ?? 0}
                            activeIndex={activeIndex}
                        />
                    ))}
                </article>

                <p className="m-0 border-t border-line pt-4 text-xs leading-6 text-muted">
                    منبع:{' '}
                    <a
                        href={talk.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-bold text-primary underline underline-offset-4"
                    >
                        TED
                    </a>{' '}
                    · «{talk.title_en}» اثر {talk.speaker || 'TED'} · مجوز {talk.source_license}
                </p>
            </div>
        </>
    );
};

TedShow.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default TedShow;
