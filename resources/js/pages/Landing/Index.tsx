import { Head, Link } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';
import { ArrowLeft, Clock, Download, LoaderCircle, Pause, Play, Plus } from 'lucide-react';
import type { SharedProps, TopicRow } from '@/types';
import { formatAudioTime, useAudioTransport } from '@/lib/audio';
import { useMediaSession } from '@/lib/media-session';
import { publicLayout } from '@/layouts/PublicLayout';

/**
 * Landing (GET /): the guest-only marketing page for search and download.
 *
 * Editorial composition on the approved warm-paper palette: an
 * asymmetric hero with the download action first and a working sample
 * preview beside it (real audio, opening paragraph, real rate control),
 * a three-step method band, the real public sample, newest topics as
 * non-navigating editorial rows, the DB plan list, FAQ rows, and one
 * closing download action. The page states only checkable product facts:
 * no counts, testimonials, ratings, or prices beyond the owner-approved
 * single-package label.
 *
 * Separation (owner requirement, 2026-10-21): this page never links into
 * the authenticated app. Library/reader/purchase links would bounce a
 * guest to login, so plan interest goes through registration and topic
 * rows are informational. Signed-in visitors never reach this page at
 * all — RedirectAuthenticatedToApp sends them to Today.
 *
 * Browser contracts preserved: fa/rtl document, «شروع با نمونه رایگان»
 * secondary CTA, preview labelled «پیش‌نمایش روش یادگیری با نمونه
 * واقعی» with its static opening paragraph and «بخشی از متن نمونه»
 * note, sample section «نمونه واقعی»
 * with heading «یک نمونه واقعی، بدون ثبت‌نام» and a /sample?topic=…&level=…
 * link, «تازه‌ترین مطالب», sales lanes («ساخت حساب و خرید» / «در دست
 * آماده‌سازی»), «بدون اشتراک می‌توانم امتحان کنم؟», «صفحه دانلود» →
 * «دانلود اپلیکیشن», «مشاهده همه پرسش‌ها», 44px targets, and no
 * horizontal scroll.
 *
 * Owner exclusions respected (DESIGN.md): no gradients, glow, backdrop
 * blur, grain, rotating/floating decoration, or looping motion. The
 * preview is a real media element; it never autoplays.
 */
interface SampleProps {
    title_en: string;
    level: string;
    cover_url: string | null;
    reader_url: string;
}

interface PlanProps {
    id: number;
    name_fa: string;
    duration_days: number;
}

interface FaqProps {
    q: string;
    a: string;
}

interface LandingProps extends SharedProps {
    sample: SampleProps | null;
    sampleParagraphs: string[];
    sampleAudioUrl: string | null;
    featured: TopicRow[];
    plans: PlanProps[];
    faqs: FaqProps[];
    salesOn: boolean;
    plansFromLabel: string | null;
    releasePublished: boolean;
    downloadUrl: string | null;
    urls: {
        sample: string;
        register: string;
        download: string;
        faq: string;
    };
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

const STEPS = [
    {
        title: 'مطلب و سطح را انتخاب کن',
        text: 'مطالب از A1 تا C2 منتشر می‌شوند و هر موضوع نسخه‌های خودش را دارد. اگر نسخه‌ای آماده نباشد همان پیام را می‌بینی، جایگزین پنهانی وجود ندارد.',
    },
    {
        title: 'بخوان و هم‌زمان بشنو',
        text: 'متن را بخوان و صوت همان نسخه را پخش کن. سرعت پخش را بین ۰٫۷۵ و ۱٫۵ برابر تنظیم کن و هر جا خواستی ادامه بده.',
    },
    {
        title: 'واژه بساز و مرور کن',
        text: 'واژه‌های مهم را ذخیره کن؛ کارت‌ها با دوباره، سخت، خوب یا آسان زمان‌بندی می‌شوند و سر موعد برمی‌گردند.',
    },
];

function Cover({ src, className = '', eager = false }: { src: string | null; className?: string; eager?: boolean }): React.JSX.Element {
    return (
        <span className={`relative block aspect-video overflow-hidden bg-canvas ${className}`} aria-hidden="true">
            {src !== null ? (
                <img
                    className="block h-full w-full object-cover"
                    src={src}
                    alt=""
                    loading={eager ? 'eager' : 'lazy'}
                    fetchPriority={eager ? 'high' : undefined}
                    decoding="async"
                />
            ) : (
                <span className="flex h-full w-full items-center justify-center bg-ink">
                    <span className="font-en text-xl font-extrabold text-surface">F</span>
                </span>
            )}
        </span>
    );
}

function SamplePreview({
    sample,
    paragraphs,
    audioUrl,
    fallbackUrl,
}: {
    sample: SampleProps | null;
    paragraphs: string[];
    audioUrl: string | null;
    fallbackUrl: string;
}): React.JSX.Element {
    const audio = useAudioTransport({ resetKey: audioUrl ?? '' });
    const { audioRef, bindRef, playing, buffering, time, duration, rate, hasError, fraction, toggle, cycleRate, retry } = audio;
    const hasAudio = audioUrl !== null;

    useMediaSession({
        title: sample?.title_en ?? null,
        album: sample?.level ?? null,
        artwork: sample?.cover_url ?? null,
        audioRef,
        playing,
        position: time,
        duration,
        rate,
    });

    return (
        <section
            aria-label="پیش‌نمایش روش یادگیری با نمونه واقعی"
            aria-busy={buffering ? 'true' : undefined}
            className="mx-auto w-full max-w-[520px] overflow-hidden rounded-2xl border border-line bg-surface lg:mx-0"
        >
            {hasAudio && <audio ref={bindRef} src={audioUrl} preload="metadata" aria-label="صوت نمونه واقعی" className="hidden" />}

            <div className="flex items-center gap-3 border-b border-line p-4">
                <span className="block w-[88px] shrink-0 overflow-hidden rounded-lg border border-line">
                    <Cover src={sample?.cover_url ?? null} eager />
                </span>
                <span className="grid min-w-0 flex-1 gap-1">
                    {sample !== null ? (
                        <>
                            <span className="truncate font-en text-base leading-6 font-bold text-ink" lang="en">
                                {sample.title_en}
                            </span>
                            <span className="text-xs text-muted">متن و صوت از یک نسخه</span>
                        </>
                    ) : (
                        <>
                            <span className="font-en text-base leading-6 font-bold text-ink" lang="en">
                                Fast English
                            </span>
                            <span className="text-xs text-muted">نمونه عمومی به‌زودی آماده می‌شود</span>
                        </>
                    )}
                </span>
                {sample !== null && (
                    <span className="shrink-0 rounded-sm bg-ink px-1.5 py-0.5 font-en text-[0.6875rem] font-bold text-surface" lang="en">
                        {sample.level}
                    </span>
                )}
            </div>

            {paragraphs.length > 0 ? (
                <div className="grid gap-2 p-4">
                    {paragraphs.map((paragraph, index) => (
                        <p
                            key={index}
                            lang="en"
                            dir="ltr"
                            className="m-0 line-clamp-4 text-left font-en text-[0.9375rem] leading-7 text-ink"
                        >
                            {paragraph}
                        </p>
                    ))}
                </div>
            ) : (
                <p className="m-0 p-4 text-[0.9375rem] leading-7 text-muted">
                    هنوز نمونه عمومی منتشر نشده است. وضعیت انتشار در{' '}
                    <Link href={fallbackUrl} className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">
                        صفحه دانلود
                    </Link>{' '}
                    اعلام می‌شود.
                </p>
            )}

            {hasAudio && (
                <div className="flex items-center gap-3 border-t border-line px-4 py-3">
                    <button
                        type="button"
                        onClick={toggle}
                        aria-label={playing ? 'توقف پخش نمونه' : 'پخش نمونه صوتی'}
                        className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-surface hover:bg-primary-hover"
                    >
                        {buffering ? (
                            <LoaderCircle size={18} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                        ) : playing ? (
                            <Pause size={18} aria-hidden="true" />
                        ) : (
                            <Play size={18} aria-hidden="true" className="translate-x-px" />
                        )}
                    </button>
                    <span className="grid flex-1 gap-1.5">
                        <span aria-hidden="true" dir="ltr" className="block h-1 overflow-hidden rounded-full bg-line">
                            <span className="block h-full rounded-full bg-accent-strong" style={{ width: `${Math.round(fraction * 100)}%` }} />
                        </span>
                        <span className="flex items-center justify-between font-en text-[0.6875rem] text-muted tabular-nums" dir="ltr">
                            <span>{formatAudioTime(time)}</span>
                            <span>{formatAudioTime(duration)}</span>
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={cycleRate}
                        dir="ltr"
                        aria-label={`تغییر سرعت پخش، اکنون ${rate} برابر`}
                        className="inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line px-3 font-en text-sm font-bold text-ink tabular-nums hover:bg-canvas"
                    >
                        {rate}×
                    </button>
                </div>
            )}

            {hasError && (
                <p role="alert" className="m-0 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-4 py-3 text-sm text-danger">
                    پخش صدا ممکن نشد.
                    <button type="button" onClick={retry} className="inline-flex min-h-11 items-center px-1 font-bold text-primary underline underline-offset-4">
                        تلاش دوباره
                    </button>
                </p>
            )}

            {paragraphs.length > 0 && (
                <p className="m-0 border-t border-line bg-canvas px-4 py-3 text-center text-[0.8125rem] leading-6 text-muted">
                    بخشی از متن نمونه. برای متن کامل و واژه‌ها، نمونه را باز کن.
                </p>
            )}
        </section>
    );
}

export const LandingIndex: FunctionComponent<LandingProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    sample,
    sampleParagraphs,
    sampleAudioUrl,
    featured,
    plans,
    faqs,
    salesOn,
    plansFromLabel,
    releasePublished,
    downloadUrl,
    urls,
}: LandingProps): React.JSX.Element => {
    const sampleHref = sample?.reader_url ?? urls.sample;
    // A published build downloads in one click; before publication the
    // same action opens the honest status/details page.
    const downloadHref = releasePublished && downloadUrl !== null ? downloadUrl : urls.download;

    return (
        <>
            <Head title="Fast English — انگلیسی را با داستان کوتاه بخوان و بشنو" />

            {/* 1. Hero: the promise beside the working sample. */}
            <section className="px-4 pt-10 sm:px-6 sm:pt-14 lg:pt-20" aria-label="معرفی Fast English">
                <div className="mx-auto grid max-w-[1160px] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                    <div className="grid justify-items-start gap-5 text-start">
                        <p className="m-0 flex items-center gap-2.5 text-sm font-bold text-accent-strong">
                            <span aria-hidden="true" className="inline-block h-px w-6 bg-accent-strong" />
                            خواندن و شنیدن، از یک نسخه
                        </p>
                        <h1 className="m-0 max-w-[22ch] text-[2.125rem] leading-[1.4] font-extrabold tracking-tight text-balance sm:text-5xl sm:leading-[1.3] lg:text-[3.4rem]">
                            انگلیسی را با داستان‌های کوتاه بخوان و بشنو
                        </h1>
                        <p className="m-0 max-w-[48ch] text-[1.0625rem] leading-9 text-pretty text-muted">
                            هر مطلب یک متن کوتاه انگلیسی در سطح توست، با صوت همان نسخه. بخوان و هم‌زمان بشنو، سرعت را تنظیم کن و واژه‌های تازه را برای مرور ذخیره کن.
                        </p>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
                            {!releasePublished && sample !== null ? (
                                <Link
                                    href={sampleHref}
                                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-extrabold text-surface no-underline hover:bg-primary-hover sm:w-auto"
                                >
                                    <Play size={19} aria-hidden="true" />
                                    شروع با نمونه رایگان
                                </Link>
                            ) : releasePublished ? (
                                <a
                                    href={downloadHref}
                                    download
                                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-extrabold text-surface no-underline hover:bg-primary-hover sm:w-auto"
                                >
                                    <Download size={19} aria-hidden="true" />
                                    دانلود اپلیکیشن
                                </a>
                            ) : (
                                <Link
                                    href={urls.download}
                                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-extrabold text-surface no-underline hover:bg-primary-hover sm:w-auto"
                                >
                                    <Download size={19} aria-hidden="true" />
                                    دانلود اپلیکیشن
                                </Link>
                            )}
                            {releasePublished && sample !== null && (
                                <Link
                                    href={sampleHref}
                                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 py-2 text-base font-bold text-ink no-underline underline decoration-line decoration-1 underline-offset-[6px] hover:decoration-ink sm:w-auto sm:justify-start"
                                >
                                    <Play size={18} aria-hidden="true" />
                                    شروع با نمونه رایگان
                                </Link>
                            )}
                            {!releasePublished && sample !== null && (
                                <Link
                                    href={urls.download}
                                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 py-2 text-base font-bold text-ink no-underline underline decoration-line decoration-1 underline-offset-[6px] hover:decoration-ink sm:w-auto sm:justify-start"
                                >
                                    <Download size={18} aria-hidden="true" />
                                    وضعیت نسخه اندروید
                                </Link>
                            )}
                        </div>
                        <p className="m-0 text-sm leading-6 text-muted">
                            {releasePublished
                                ? 'نمونه بدون ثبت‌نام باز می‌شود و نسخه اندروید از صفحه دانلود در دسترس است.'
                                : 'نمونه بدون ثبت‌نام باز می‌شود. نسخه اندروید به‌زودی منتشر می‌شود؛ وضعیت آن در صفحه دانلود اعلام می‌شود.'}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
                            <span>شش سطح:</span>
                            <span className="flex items-center gap-2.5 font-en text-sm text-muted" dir="ltr">
                                {LEVELS.map((level) => {
                                    const current = sample?.level === level;
                                    return (
                                        <span
                                            key={level}
                                            lang="en"
                                            className={
                                                current
                                                    ? 'font-bold text-ink underline decoration-accent-strong decoration-2 underline-offset-4'
                                                    : 'text-muted'
                                            }
                                        >
                                            {level}
                                            {current && <span className="sr-only"> (سطح نمونه فعلی)</span>}
                                        </span>
                                    );
                                })}
                            </span>
                        </div>
                    </div>

                    <SamplePreview
                        sample={sample}
                        paragraphs={sampleParagraphs}
                        audioUrl={sampleAudioUrl}
                        fallbackUrl={urls.download}
                    />
                </div>
            </section>

            {/* 2. Method: three steps, one per column, on a quiet surface band. */}
            <section aria-label="روش کار" className="mt-14 border-y border-line bg-surface sm:mt-20">
                <div className="mx-auto grid max-w-[1160px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14 lg:py-16">
                    <div className="grid content-start gap-3">
                        <h2 className="m-0 text-3xl leading-[1.5] font-extrabold tracking-tight">سه قدم، هر روز</h2>
                        <p className="m-0 max-w-[38ch] leading-8 text-pretty text-muted">
                            لازم نیست همه‌چیز را از اول شروع کنی. هر جلسه از همان سطح و همان جایی که مانده بود ادامه می‌یابد.
                        </p>
                    </div>
                    <ol className="m-0 grid list-none gap-6 p-0 sm:grid-cols-3">
                        {STEPS.map((step, index) => (
                            <li key={step.title} className="border-t border-line pt-4">
                                <p className="m-0 font-en text-xs font-bold text-accent-strong">{String(index + 1).padStart(2, '0')}</p>
                                <h3 className="mt-2 mb-0 text-lg leading-7 font-extrabold">{step.title}</h3>
                                <p className="mt-1 mb-0 text-[0.9375rem] leading-7 text-muted">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* 3. The real sample: full cover, real lesson meta, one action. */}
            {sample !== null && (
                <section aria-label="نمونه واقعی" className="mx-auto grid max-w-[1160px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:py-16">
                    <div className="grid justify-items-start gap-3 text-start">
                        <p className="m-0 text-sm font-bold text-accent-strong">نمونه رایگان</p>
                        <h2 className="m-0 text-3xl leading-[1.5] font-extrabold tracking-tight">یک نمونه واقعی، بدون ثبت‌نام</h2>
                        <p className="m-0 mt-1 font-en text-2xl leading-9 font-bold text-ink" lang="en">
                            {sample.title_en}
                        </p>
                        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                            <span className="inline-flex items-center gap-1 rounded-sm bg-ink px-1.5 py-0.5 font-en text-xs font-bold text-surface" lang="en">
                                {sample.level}
                            </span>
                            <span>متن کامل + صوت + واژه‌های کلیدی</span>
                        </p>
                        <p className="m-0 max-w-[46ch] leading-8 text-pretty text-muted">
                            بدون حساب باز می‌شود؛ همان تجربه‌ای که بعد از اشتراک هر روز داری. کافی است یک جمله را بخوانی و هم‌زمان بشنوی.
                        </p>
                        <Link
                            href={sample.reader_url}
                            className="mt-2 inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-surface no-underline hover:bg-primary-hover"
                        >
                            <Play size={19} aria-hidden="true" />
                            خواندن و شنیدن نمونه
                        </Link>
                    </div>
                    <Link
                        href={sample.reader_url}
                        className="block min-h-11 overflow-hidden rounded-2xl border border-line text-inherit no-underline"
                        aria-label={`باز کردن نمونه: ${sample.title_en}`}
                    >
                        <Cover src={sample.cover_url} />
                    </Link>
                </section>
            )}

            {/* 4. Newest topics: divider rows, one per topic. */}
            {featured.length > 0 && (
                <section aria-label="تازه‌ترین مطالب" className="mx-auto max-w-[1160px] px-4 pb-12 sm:px-6 lg:pb-16">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="grid max-w-[56ch] gap-2">
                            <h2 className="m-0 text-3xl leading-[1.5] font-extrabold tracking-tight">تازه‌ترین مطالب</h2>
                            <p className="m-0 leading-8 text-muted">هر مطلب در چند سطح منتشر می‌شود؛ سطح خودت را انتخاب کن و همان نسخه را بخوان و بشنو.</p>
                        </div>
                        <Link
                            href={urls.download}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-bold whitespace-nowrap text-ink no-underline hover:bg-canvas"
                        >
                            <Download size={18} aria-hidden="true" />
                            {releasePublished ? 'دریافت اپ' : 'وضعیت نسخه اندروید'}
                        </Link>
                    </div>
                    <ul className="m-0 mt-6 grid list-none divide-y divide-line border-y border-line p-0">
                        {featured.map((topic) => (
                            <li key={topic.slug}>
                                <div className="flex min-h-[88px] items-center gap-4 py-4">
                                    <span className="block w-[86px] shrink-0 overflow-hidden rounded-lg border border-line sm:w-[136px]">
                                        <Cover src={topic.cover_url} />
                                    </span>
                                    <span className="grid min-w-0 flex-1 gap-1.5">
                                        <span className="font-en text-lg leading-7 font-bold text-ink sm:text-xl" lang="en">
                                            {topic.title_en}
                                        </span>
                                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                                            {topic.levels.length > 0 && (
                                                <span>
                                                    نسخه‌ها:{' '}
                                                    <span lang="en" dir="ltr" className="font-en">
                                                        {topic.levels.join('، ')}
                                                    </span>
                                                </span>
                                            )}
                                            <span className="inline-flex items-center gap-1">
                                                <Clock size={14} aria-hidden="true" />
                                                حدود {topic.minutes.toLocaleString('fa-IR')} دقیقه
                                            </span>
                                        </span>
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* 5. Plans: DB names and durations only, never amounts. */}
            <section aria-label="پلن‌ها" className="border-y border-line bg-surface">
                <div className="mx-auto max-w-[1160px] px-4 py-12 sm:px-6 lg:py-16">
                    <div className="grid max-w-[56ch] gap-2">
                        <h2 className="m-0 text-3xl leading-[1.5] font-extrabold tracking-tight">پلن‌ها</h2>
                        <p className="m-0 leading-8 text-muted">دسترسی پس از تأیید پرداخت فعال می‌شود. تا آن روز، نمونه رایگان همیشه در دسترس است.</p>
                    </div>

                    {!salesOn ? (
                        <div className="mt-6 grid max-w-[720px] gap-2 border border-line bg-canvas p-6 sm:p-8">
                            <p className="m-0 text-lg font-extrabold">
                                <strong>در دست آماده‌سازی</strong>
                            </p>
                            <p className="m-0 leading-8 text-muted">
                                {plansFromLabel === null
                                    ? 'فروش هنوز فعال نشده است. پلن‌ها پس از اعلام رسمی قابل خرید خواهند بود.'
                                    : `فروش هنوز فعال نشده است. پلن‌ها از ${plansFromLabel} شروع می‌شوند و پس از اعلام رسمی قابل خرید خواهند بود.`}
                            </p>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="mt-6 max-w-[720px] border border-line bg-canvas p-6 text-muted sm:p-8">
                            <p className="m-0 leading-8">در حال حاضر پلن فعالی وجود ندارد.</p>
                        </div>
                    ) : (
                        <>
                            <p className="mt-6 mb-0 text-[1.0625rem] leading-8 text-muted">
                                {plansFromLabel === null ? 'پلن‌های فعال' : `پلن‌ها از ${plansFromLabel} شروع می‌شوند`}
                            </p>
                            <ul className="m-0 mt-4 grid list-none gap-4 p-0 md:grid-cols-3">
                                {plans.map((plan) => (
                                    <li key={plan.id} className="grid content-start gap-2 border border-line bg-canvas p-5">
                                        <h3 className="m-0 text-lg leading-7 font-extrabold">{plan.name_fa}</h3>
                                        <p className="m-0 flex items-center gap-1.5 text-sm text-muted">
                                            <Clock size={15} aria-hidden="true" />
                                            {plan.duration_days.toLocaleString('fa-IR')} روز دسترسی پس از تأیید
                                        </p>
                                        <p className="m-0 pt-2">
                                            <Link
                                                href={urls.register}
                                                className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-5 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                            >
                                                ساخت حساب و خرید
                                            </Link>
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </section>

            {/* 6. FAQ: three real questions as divider rows. */}
            <section aria-label="پرسش‌های پرتکرار" className="mx-auto grid max-w-[1160px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 lg:py-16">
                <div className="grid content-start gap-3">
                    <h2 className="m-0 text-3xl leading-[1.5] font-extrabold tracking-tight">پرسش‌های پرتکرار</h2>
                    <p className="m-0 max-w-[36ch] leading-8 text-muted">جواب کوتاه سه سؤال اول. بقیه را در صفحه پرسش‌ها بخوان.</p>
                    <p className="m-0 pt-1">
                        <Link
                            href={urls.faq}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-bold text-ink no-underline hover:bg-canvas"
                        >
                            مشاهده همه پرسش‌ها
                            <ArrowLeft size={18} aria-hidden="true" />
                        </Link>
                    </p>
                </div>
                <div className="border-t border-line">
                    {faqs.map((item, index) => (
                        <details key={item.q} open={index === 0} className="group border-b border-line">
                            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 font-extrabold [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                                {item.q}
                                <Plus
                                    size={18}
                                    aria-hidden="true"
                                    className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-45"
                                />
                            </summary>
                            <p className="mt-0 mb-4 max-w-[58ch] leading-8 text-muted">{item.a}</p>
                        </details>
                    ))}
                </div>
            </section>

            {/* 7. Closing action: one calm surface band before the footer. */}
            <section aria-label="شروع" className="border-t border-line bg-surface">
                <div className="mx-auto grid max-w-[1160px] gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:py-14">
                    <div className="grid content-start gap-2">
                        <h2 className="m-0 text-2xl leading-[1.5] font-extrabold tracking-tight text-pretty sm:text-3xl">بدون حساب شروع کن</h2>
                        <p className="m-0 max-w-[52ch] leading-8 text-pretty text-muted">
                            یک نمونه را بخوان و بشنو. برای ادامه، حساب بساز و پلن را انتخاب کن؛ دسترسی پس از تأیید پرداخت فعال می‌شود و پیشرفت، واژه‌ها و برنامه روزانه‌ات ذخیره می‌ماند.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                        {!releasePublished && sample !== null ? (
                            <Link
                                href={sampleHref}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-extrabold text-surface no-underline hover:bg-primary-hover sm:w-auto"
                            >
                                <Play size={18} aria-hidden="true" />
                                شروع با نمونه رایگان
                            </Link>
                        ) : releasePublished ? (
                            <a
                                href={downloadHref}
                                download
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-extrabold text-surface no-underline hover:bg-primary-hover sm:w-auto"
                            >
                                <Download size={18} aria-hidden="true" />
                                دانلود اپلیکیشن
                            </a>
                        ) : (
                            <Link
                                href={urls.download}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-extrabold text-surface no-underline hover:bg-primary-hover sm:w-auto"
                            >
                                <Download size={18} aria-hidden="true" />
                                دانلود اپلیکیشن
                            </Link>
                        )}
                        {releasePublished && sample !== null && (
                            <Link
                                href={sample.reader_url}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line px-6 py-3 font-bold text-ink no-underline hover:bg-canvas sm:w-auto"
                            >
                                <Play size={18} aria-hidden="true" />
                                شروع با نمونه رایگان
                            </Link>
                        )}
                        {releasePublished && (
                            <Link
                                href={urls.download}
                                className="inline-flex min-h-11 items-center text-sm font-bold text-muted underline underline-offset-4 hover:text-ink"
                            >
                                مشخصات فایل و SHA-256
                            </Link>
                        )}
                        {!releasePublished && (
                            <Link
                                href={urls.download}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line px-6 py-3 font-bold text-ink no-underline hover:bg-canvas sm:w-auto"
                            >
                                <Download size={18} aria-hidden="true" />
                                وضعیت نسخه اندروید
                            </Link>
                        )}
                    </div>
                </div>
            </section>
        </>
    );
};

LandingIndex.layout = publicLayout;

export default LandingIndex;
