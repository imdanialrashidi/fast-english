import { Head, Link } from '@inertiajs/react';
import { BookOpen, ChevronDown, Clock, Gauge, Pause, Play, RotateCcw, RotateCw, TriangleAlert } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import PublicLayout, { publicLayout } from '@/layouts/PublicLayout';
import { formatAudioTime, useHeadlessAudio } from '@/lib/audio';
import type { GlossaryEntry, SentenceCue, SharedProps } from '@/types';

/**
 * Public sample experience (/sample, owner paid-only requirement): the
 * designated public-sample lesson rendered in the marketing layout —
 * never the learner sidebar, tabs, or global player. Audio plays through
 * a local element owned by this page (same hook IDs as the learner
 * player so the media contracts keep holding: #lesson-audio,
 * #player-play/seek/speed/back/forward/toggle/error/retry). Glossary is
 * read-only here: saving words is gated learner functionality.
 *
 * Props mirror the reader allowlist for exactly this lesson — no other
 * lesson's content travels with the page.
 */

interface SampleTopic {
    slug: string;
    title_en: string;
    summary_public: string | null;
    cover_url: string | null;
}

interface SampleLesson {
    id: number;
    title_en: string;
    level: string;
    estimated_minutes: number;
    duration_seconds: number;
    audio_revision: number;
    audio_url: string;
}

interface SampleProps extends SharedProps {
    topic: SampleTopic;
    lesson: SampleLesson;
    sampleLevels: string[];
    sentences: string[];
    paragraphs: string[];
    cues: SentenceCue[];
    cuesUsable: boolean;
    glossary: GlossaryEntry[];
}

export const SampleShow: FunctionComponent<SampleProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    topic,
    lesson,
    sampleLevels,
    sentences,
    paragraphs,
    cues,
    cuesUsable,
    glossary,
}: SampleProps): React.JSX.Element => {
    const audio = useHeadlessAudio(lesson.audio_url, cues, cuesUsable);
    const { audioRef, playing, time, duration, rate, hasError, expanded, setExpanded, fraction, activeIndex, toggle, seekTo, skipBy, cycleRate, retry } = audio;
    const sentenceRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

    React.useEffect(() => {
        if (activeIndex < 0 || !playing) {
            return;
        }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        sentenceRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, playing]);

    const selectSentence = (index: number): void => {
        const cue = cues[index];
        if (cue === undefined) {
            return;
        }
        seekTo(cue.start_seconds + 0.01);
        if (!playing) {
            toggle();
        }
    };

    return (
        <>
            <Head title={`${lesson.title_en} (${lesson.level}) · نمونه رایگان`} />
            <div className="mx-auto grid max-w-[680px] gap-6 px-4 py-6">
                <header className="grid gap-3">
                    <p className="m-0 inline-flex items-center gap-1.5 text-sm text-muted">
                        <Gauge size={16} aria-hidden="true" />
                        نمونه رایگان · سطح{' '}
                        <span lang="en" dir="ltr" className="font-en font-bold">
                            {lesson.level}
                        </span>
                        <span aria-hidden="true">·</span>
                        <Clock size={16} aria-hidden="true" />
                        حدود {lesson.estimated_minutes} دقیقه مطالعه
                    </p>
                    <h1 lang="en" dir="ltr" className="m-0 text-left font-en text-3xl leading-[1.35] font-extrabold tracking-tight sm:text-4xl">
                        {lesson.title_en}
                    </h1>
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
                            className="block aspect-video w-full rounded-3xl border border-line bg-canvas object-cover"
                        />
                    )}
                    {sampleLevels.length > 1 && (
                        <nav aria-label="سطح نمونه" className="grid gap-2">
                            <p className="m-0 text-sm font-bold text-muted">سطح نمونه:</p>
                            <div className="flex flex-wrap gap-2">
                                {sampleLevels.map((level) => (
                                    <Link
                                        key={level}
                                        href={`/sample?topic=${encodeURIComponent(topic.slug)}&level=${encodeURIComponent(level)}`}
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
                    )}
                </header>

                <section className="fe-playerbar grid gap-3 rounded-3xl border border-line bg-surface p-4" data-expanded={expanded ? 'true' : 'false'} aria-label="پخش‌کننده نمونه">
                    <div className="flex items-center gap-3">
                        <button
                            id="player-play"
                            type="button"
                            onClick={toggle}
                            aria-label={playing ? 'توقف' : 'پخش'}
                            className="inline-flex h-12 w-12 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-surface transition-colors duration-150 hover:bg-primary-hover"
                        >
                            {playing ? <Pause size={24} aria-hidden="true" /> : <Play size={24} aria-hidden="true" />}
                        </button>
                        <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[0.9375rem] leading-6 font-bold">
                                <span lang="en" dir="ltr">
                                    {lesson.title_en}
                                </span>{' '}
                                <span lang="en" dir="ltr" className="font-en text-sm font-bold text-muted">
                                    {lesson.level}
                                </span>
                            </p>
                            <p className="m-0 font-en text-[0.8125rem] tabular-nums" dir="ltr">
                                <span id="player-current">{formatAudioTime(time)}</span>
                                {' / '}
                                <span id="player-duration">{formatAudioTime(duration)}</span>
                            </p>
                        </div>
                        <button
                            id="player-speed"
                            type="button"
                            onClick={cycleRate}
                            aria-label={`سرعت پخش: ${rate}×`}
                            className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1.5 hover:bg-canvas"
                        >
                            <span id="player-speed-label" dir="ltr" className="font-en text-[0.8125rem] font-bold tabular-nums">
                                {rate}×
                            </span>
                        </button>
                        <button
                            id="player-toggle"
                            type="button"
                            onClick={() => setExpanded(!expanded)}
                            aria-expanded={expanded ? 'true' : 'false'}
                            aria-controls="player-detail"
                            aria-label={expanded ? 'پنهان کردن کنترل‌های بیشتر' : 'نمایش کنترل‌های بیشتر'}
                            className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface hover:bg-canvas"
                        >
                            <ChevronDown size={20} aria-hidden="true" className={expanded ? 'rotate-180' : ''} />
                        </button>
                    </div>
                    <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-line">
                        <span id="player-progress-fill" className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(fraction * 100)}%` }} />
                    </div>
                    <div id="player-detail" className={expanded ? 'grid gap-3' : 'hidden'}>
                        <input
                            id="player-seek"
                            type="range"
                            min={0}
                            max={100}
                            step={0.1}
                            value={Math.round(fraction * 1000) / 10}
                            onInput={(event) => {
                                if (Number.isFinite(duration) && duration > 0) {
                                    seekTo((Number(event.currentTarget.value) / 100) * duration);
                                }
                            }}
                            onChange={(event) => {
                                if (Number.isFinite(duration) && duration > 0) {
                                    seekTo((Number(event.currentTarget.value) / 100) * duration);
                                }
                            }}
                            aria-label="جست‌وجو در صوت نمونه"
                            className="h-11 w-full cursor-pointer"
                        />
                        <div className="flex items-center justify-center gap-6">
                            <button
                                id="player-back"
                                type="button"
                                onClick={() => skipBy(-10)}
                                aria-label="۱۰ ثانیه به عقب"
                                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 hover:bg-canvas"
                            >
                                <RotateCcw size={20} aria-hidden="true" />
                                <span dir="ltr" className="font-en text-sm font-bold tabular-nums">
                                    10
                                </span>
                            </button>
                            <button
                                id="player-forward"
                                type="button"
                                onClick={() => skipBy(10)}
                                aria-label="۱۰ ثانیه به جلو"
                                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 hover:bg-canvas"
                            >
                                <RotateCw size={20} aria-hidden="true" />
                                <span dir="ltr" className="font-en text-sm font-bold tabular-nums">
                                    10
                                </span>
                            </button>
                        </div>
                        <p id="player-error" role="alert" hidden={!hasError} className="m-0 flex items-center gap-2 rounded-2xl border border-line bg-canvas px-4 py-3 text-danger">
                            <TriangleAlert size={20} aria-hidden="true" />
                            <span id="player-error-text">پخش صوت ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.</span>
                        </p>
                        <p className="m-0" hidden={!hasError}>
                            <button
                                id="player-retry"
                                type="button"
                                onClick={retry}
                                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-surface hover:bg-primary-hover"
                            >
                                <RotateCw size={20} aria-hidden="true" />
                                تلاش دوباره
                            </button>
                        </p>
                    </div>
                    <audio
                        id="lesson-audio"
                        ref={audioRef}
                        src={lesson.audio_url}
                        preload="metadata"
                        onPlay={audio.bind.onPlay}
                        onPause={audio.bind.onPause}
                        onTimeUpdate={audio.bind.onTimeUpdate}
                        onLoadedMetadata={audio.bind.onLoadedMetadata}
                        onDurationChange={audio.bind.onDurationChange}
                        onError={audio.bind.onError}
                    />
                </section>

                {cuesUsable ? (
                    <ol lang="en" dir="ltr" aria-label="متن نمونه با همگام‌سازی صوت" className="fe-sentences m-0 grid list-none gap-1 p-0">
                        {sentences.map((sentence, index) => {
                            const cue = cues[index];
                            const active = index === activeIndex;
                            return (
                                <li key={index}>
                                    <button
                                        type="button"
                                        ref={(element) => {
                                            sentenceRefs.current[index] = element;
                                        }}
                                        onClick={() => selectSentence(index)}
                                        data-index={index}
                                        data-start={cue?.start_seconds ?? 0}
                                        data-end={cue?.end_seconds ?? 0}
                                        aria-current={active ? 'true' : 'false'}
                                        aria-label={`پخش جمله ${index + 1} از ${sentences.length}`}
                                        className={
                                            active
                                                ? 'fe-sentence block min-h-11 w-full cursor-pointer rounded-xl border border-line border-s-4 border-s-accent-strong bg-canvas px-3 py-2 text-left font-en text-[1.125rem] leading-8'
                                                : 'fe-sentence block min-h-11 w-full cursor-pointer rounded-xl border border-transparent border-s-4 px-3 py-2 text-left font-en text-[1.125rem] leading-8 hover:bg-surface'
                                        }
                                    >
                                        {sentence}
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                ) : (
                    <>
                        <article lang="en" dir="ltr" className="fe-english-body grid gap-5">
                            {paragraphs.map((paragraph, index) => (
                                <p key={index} className="m-0 text-left font-en text-[1.125rem] leading-8">
                                    {paragraph}
                                </p>
                            ))}
                        </article>
                        <p role="note" className="m-0 flex items-start gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-muted">
                            همگام‌سازی جمله‌به‌جمله برای این نسخه هنوز آماده نیست؛ پخش عادی فعال است.
                        </p>
                    </>
                )}

                <section aria-label="واژه‌های کلیدی نمونه" className="grid gap-1 rounded-3xl border border-line bg-surface px-5 py-2">
                    <h2 className="m-0 flex items-center gap-2 pt-3 pb-1 text-xl leading-8">
                        <BookOpen size={20} aria-hidden="true" />
                        واژه‌های کلیدی
                    </h2>
                    {glossary.length > 0 ? (
                        <dl className="m-0">
                            {glossary.map((entry) => (
                                <div key={entry.word} className="grid gap-1 border-b border-line py-4 last:border-b-0">
                                    <dt lang="en" dir="ltr" className="text-left font-en text-[1.0625rem] font-bold">
                                        {entry.word}
                                    </dt>
                                    <dd className="m-0 leading-8">{entry.meaning_fa}</dd>
                                    {entry.example_en !== null && (
                                        <dd lang="en" dir="ltr" className="m-0 text-left font-en leading-7 text-muted">
                                            {entry.example_en}
                                        </dd>
                                    )}
                                </div>
                            ))}
                        </dl>
                    ) : (
                        <p role="note" className="m-0 py-4 leading-8 text-muted">
                            برای این نمونه واژه‌ای ثبت نشده است.
                        </p>
                    )}
                </section>

                <section aria-label="ادامه یادگیری" className="grid justify-items-start gap-2 rounded-3xl border border-line bg-surface p-6">
                    <h2 className="m-0 text-lg leading-8">دوست داشتی؟ ادامه‌اش با اشتراک است</h2>
                    <p className="m-0 leading-8 text-muted">حساب بساز، پلن را انتخاب کن و همه مطلب‌ها را در سطح خودت بخوان و بشنو.</p>
                    <p className="m-0 flex flex-wrap gap-2">
                        <Link
                            href="/register"
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                        >
                            ساخت حساب
                        </Link>
                        <Link
                            href="/app/subscribe"
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                        >
                            مشاهده پلن‌ها
                        </Link>
                    </p>
                </section>
            </div>
        </>
    );
};

SampleShow.layout = publicLayout;

export default SampleShow;
