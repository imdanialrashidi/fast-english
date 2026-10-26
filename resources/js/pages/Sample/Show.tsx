import { Head, Link, usePage } from '@inertiajs/react';
import { BookOpen, Clock, Gauge } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { AudioConsole } from '@/components/AudioConsole';
import { publicLayout } from '@/layouts/PublicLayout';
import { useAudioTransport } from '@/lib/audio';
import { useMediaSession } from '@/lib/media-session';
import type { LessonPayload, ReadingContent, SharedProps, TopicPayload } from '@/types';

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

interface SampleProps extends SharedProps, ReadingContent {
    topic: TopicPayload;
    lesson: LessonPayload;
    sampleLevels: string[];
}

export const SampleShow: FunctionComponent<SampleProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    topic,
    lesson,
    sampleLevels,
    paragraphs,
    glossary,
}: SampleProps): React.JSX.Element => {
    const audio = useAudioTransport({ resetKey: lesson.audio_url });
    const { audioRef, bindRef, playing, buffering, time, duration, rate, hasError, expanded, setExpanded, fraction, bufferedFraction, toggle, seekToFraction, skipBy, cycleRate, retry } = audio;
    const signedIn = usePage<SharedProps>().props.auth.user !== null;

    useMediaSession({
        title: lesson.title_en,
        album: lesson.level,
        artwork: topic.cover_url,
        audioRef,
        playing,
        position: time,
        duration,
        rate,
    });

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
                            className="block h-56 w-full rounded-3xl border border-line bg-canvas object-cover"
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

                <AudioConsole
                    className="w-full"
                    sectionLabel="پخش‌کننده نمونه"
                    seekLabel="جست‌وجو در صوت نمونه"
                    title={lesson.title_en}
                    level={lesson.level}
                    coverUrl={topic.cover_url}
                    state={{ playing, buffering, time, duration, rate, fraction, bufferedFraction, hasError, expanded, saveError: null }}
                    actions={{ setExpanded, toggle, seekToFraction, skipBy, cycleRate, retry, retrySaveNow: () => undefined }}
                />
                <audio id="lesson-audio" ref={bindRef} src={lesson.audio_url} preload="metadata" />

                <article lang="en" dir="ltr" className="fe-english-body grid gap-5">
                    {paragraphs.map((paragraph, index) => (
                        <p key={index} className="m-0 text-left font-en text-[1.125rem] leading-8">
                            {paragraph}
                        </p>
                    ))}
                </article>

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
                    <p className="m-0 leading-8 text-muted">
                        {signedIn
                            ? 'پلن را انتخاب کن و همهٔ مطلب‌ها را در سطح خودت بخوان و بشنو.'
                            : 'حساب بساز، پلن را انتخاب کن و همهٔ مطلب‌ها را در سطح خودت بخوان و بشنو.'}
                    </p>
                    <p className="m-0 flex flex-wrap gap-2">
                        {signedIn ? (
                            <Link
                                href="/app"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                ادامه در برنامه
                            </Link>
                        ) : (
                            <Link
                                href="/register"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                ساخت حساب
                            </Link>
                        )}
                        {signedIn ? (
                            <Link
                                href="/app/subscribe"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                            >
                                مشاهده پلن‌ها
                            </Link>
                        ) : (
                            <Link
                                href="/login"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                            >
                                ورود به حساب
                            </Link>
                        )}
                    </p>
                </section>
            </div>
        </>
    );
};

SampleShow.layout = publicLayout;

export default SampleShow;
