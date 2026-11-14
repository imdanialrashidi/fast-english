import { Link } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';
import { Clock, Download, LoaderCircle, Pause, Play, Plus } from 'lucide-react';
import type { SharedProps, TopicRow } from '@/types';
import { formatAudioTime, useAudioTransport } from '@/lib/audio';
import { useMediaSession } from '@/lib/media-session';
import { publicLayout } from '@/layouts/PublicLayout';

/**
 * Landing (GET /): the guest-only publication cover for Fast English.
 *
 * Composition: a reading desk rather than a SaaS template. The hero pairs
 * the promise with the working public sample (real cover, real title,
 * real paragraphs, real audio and rate control). A dark level band breaks
 * the page in half; the method, the real sample spread, the library
 * contents, the DB price list, the FAQ rows, and the closing action are
 * set as editorial sections with a shared folio mark.
 *
 * Art direction: ink and warm paper carry the hierarchy, primary blue is
 * the action voice only, and one teal thread marks the read/listen and
 * progress moments (the H1 verbs, the player fill, the active level).
 * The sample sheet sits on a hard-offset ink plate, not a soft shadow:
 * it is the single product object lifted off the page. Folio numbers and
 * hairline rules structure the page like a publication contents list.
 *
 * Contract (tests/browser/s8-landing, m0-inertia, m1-journey):
 * - H1 «انگلیسی را با داستان‌های کوتاه بخوان و بشنو»
 * - section «پیش‌نمایش روش یادگیری با نمونه واقعی» with an English
 *   paragraph and the only <audio> on the page (labels «پخش نمونه صوتی»
 *   / «توقف پخش نمونه», the «بخشی از متن نمونه» note)
 * - section «نمونه واقعی» with heading «یک نمونه واقعی، بدون ثبت‌نام»
 *   and a /sample?topic=…&level=… link
 * - heading «تازه‌ترین مطالب», section «پلن‌ها» with one <li> per plan,
 *   «ساخت حساب و خرید» when sales are on
 * - «شروع با نمونه رایگان», «وضعیت نسخه اندروید», «مشاهده همه پرسش‌ها»
 *
 * Truth rules: every number, title, cover, price, and paragraph comes
 * from the server; there are no counts, testimonials, ratings, or
 * claims. Signed-in visitors never reach this page, and no guest link
 * enters /app: the sample is the free path and registration starts the
 * paid path. Every link and button keeps a 44px target and every image
 * is sized. Motion is hover/focus only, as the owner direction requires.
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
    price_label: string;
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

/** Two-digit Persian folio numbers for the editorial indexes. */
const folio = (n: number): string => n.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });

const STEPS = [
    {
        title: 'مطلب و سطح را انتخاب کن',
        text: 'از کتابخانه، در سطحی که می‌خوانی. هر مطلب نسخهٔ خودش را دارد و متن و صوت همان نسخه‌اند.',
    },
    {
        title: 'بخوان و هم‌زمان بشنو',
        text: 'سرعت را بین ۰٫۷۵ و ۱٫۵ برابر تنظیم کن. هر جا رها کنی، همان‌جا ادامه پیدا می‌کند.',
    },
    {
        title: 'واژه‌ها را نگه دار',
        text: 'واژهٔ مهم را با معنی و جملهٔ مثال ذخیره کن تا بعداً سراغش برگردی.',
    },
    {
        title: 'سر موعد مرور کن',
        text: 'کارت‌ها با دوباره، سخت، خوب یا آسان زمان‌بندی می‌شوند و سر موعد برمی‌گردند.',
    },
];

const PLAN_INCLUDES = [
    'همهٔ مطالب منتشرشده، در سطح‌های خودشان',
    'متن و صوت هر درس، همیشه از یک نسخه',
    'واژه‌ها، مرور زمان‌بندی‌شده و برنامهٔ روزانه',
    'ادامه از همان‌جایی که رها کرده‌ای',
];

const primaryCta =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-extrabold whitespace-nowrap text-surface no-underline transition-[background-color,color] duration-150 hover:bg-primary-hover';

const secondaryCta =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-field bg-transparent px-5 py-3 text-base font-bold whitespace-nowrap text-ink no-underline transition-[background-color,border-color,color] duration-150 hover:border-ink hover:bg-surface';

function CoverImage({
    src,
    eager = false,
    className = '',
}: {
    src: string | null;
    eager?: boolean;
    className?: string;
}): React.JSX.Element {
    if (src === null) {
        return (
            <span aria-hidden="true" className={`flex items-center justify-center bg-ink ${className}`}>
                <span className="font-en text-2xl font-extrabold text-surface">F</span>
            </span>
        );
    }

    return (
        <img
            src={src}
            alt=""
            width={800}
            height={450}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : undefined}
            decoding="async"
            className={`block h-full w-full object-cover ${className}`}
        />
    );
}

function SectionMark({ index, children }: { index: string; children: ReactNode }): React.JSX.Element {
    return (
        <p className="m-0 flex items-center gap-3 text-[0.8125rem] font-bold text-muted">
            <span className="tabular-nums text-ink">{index}</span>
            <span aria-hidden="true" className="h-px w-7 bg-line" />
            <span>{children}</span>
        </p>
    );
}

function HeroActions({
    sample,
    sampleHref,
    releasePublished,
    downloadUrl,
    urls,
}: {
    sample: SampleProps | null;
    sampleHref: string;
    releasePublished: boolean;
    downloadUrl: string | null;
    urls: LandingProps['urls'];
}): React.JSX.Element {
    const downloadHref = releasePublished && downloadUrl !== null ? downloadUrl : urls.download;

    return (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {releasePublished ? (
                <a href={downloadHref} download className={primaryCta}>
                    <Download size={19} aria-hidden="true" />
                    دانلود اپلیکیشن
                </a>
            ) : sample !== null ? (
                <Link href={sampleHref} className={primaryCta}>
                    <Play size={19} aria-hidden="true" />
                    شروع با نمونه رایگان
                </Link>
            ) : (
                <Link href={urls.download} className={primaryCta}>
                    <Download size={19} aria-hidden="true" />
                    وضعیت نسخه اندروید
                </Link>
            )}

            {releasePublished && sample !== null ? (
                <Link href={sampleHref} className={secondaryCta}>
                    <Play size={18} aria-hidden="true" />
                    شروع با نمونه رایگان
                </Link>
            ) : !releasePublished && sample !== null ? (
                <Link href={urls.download} className={secondaryCta}>
                    <Download size={18} aria-hidden="true" />
                    وضعیت نسخه اندروید
                </Link>
            ) : (
                <Link href={urls.register} className={secondaryCta}>
                    ساخت حساب
                </Link>
            )}
        </div>
    );
}

function SampleSheet({
    sample,
    paragraphs,
    audioUrl,
}: {
    sample: SampleProps;
    paragraphs: string[];
    audioUrl: string | null;
}): React.JSX.Element {
    const audio = useAudioTransport({ resetKey: audioUrl ?? '' });
    const { audioRef, bindRef, playing, buffering, time, duration, rate, hasError, fraction, toggle, cycleRate, retry } = audio;
    const hasAudio = audioUrl !== null;

    useMediaSession({
        title: sample.title_en,
        album: sample.level,
        artwork: sample.cover_url,
        audioRef,
        playing,
        position: time,
        duration,
        rate,
    });

    return (
        <section aria-label="پیش‌نمایش روش یادگیری با نمونه واقعی" aria-busy={buffering ? 'true' : undefined}>
            <div className="relative">
                <span
                    aria-hidden="true"
                    className="absolute inset-0 translate-y-1.5 -translate-x-1.5 rounded-[1.5rem] bg-ink sm:translate-y-2.5 sm:-translate-x-2.5"
                />
                <figure className="relative m-0 overflow-hidden rounded-[1.5rem] border border-line bg-surface">
                    {hasAudio && (
                        <audio ref={bindRef} src={audioUrl} preload="metadata" aria-label="صوت نمونه واقعی" className="hidden" />
                    )}

                    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                        <span className="text-[0.8125rem] font-bold text-ink">نمونهٔ عمومی</span>
                        <span className="flex items-center gap-2">
                            <span className="text-xs text-muted">سطح</span>
                            <span lang="en" dir="ltr" className="rounded-md border border-line bg-canvas px-2 py-0.5 font-en text-xs font-bold text-ink">
                                {sample.level}
                            </span>
                        </span>
                    </div>

                    <div className="relative aspect-video overflow-hidden bg-canvas">
                        <CoverImage src={sample.cover_url} eager />
                    </div>

                    <div className="grid gap-1 px-5 pt-5">
                        <p lang="en" dir="ltr" className="m-0 text-start font-en text-[1.5rem] leading-8 font-bold tracking-[-0.01em] text-ink">
                            {sample.title_en}
                        </p>
                        <p className="m-0 text-left text-xs text-muted">متن و صوت از یک نسخه</p>
                    </div>

                    {paragraphs.length > 0 ? (
                        <div className="px-5 pt-4">
                            <p
                                lang="en"
                                dir="ltr"
                                className="m-0 line-clamp-3 text-start font-en text-[0.9375rem] leading-[1.85] text-ink sm:line-clamp-4"
                            >
                                {paragraphs[0]}
                            </p>
                        </div>
                    ) : (
                        <p className="m-0 px-5 pt-4 text-[0.9375rem] leading-7 text-muted">
                            متن این نمونه در حال آماده‌سازی است.
                        </p>
                    )}

                    {hasAudio && (
                        <div className="mt-5 flex items-center gap-3 border-t border-line px-4 py-3">
                            <button
                                type="button"
                                onClick={toggle}
                                aria-label={playing ? 'توقف پخش نمونه' : 'پخش نمونه صوتی'}
                                className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-full bg-primary text-surface transition-[background-color] duration-150 hover:bg-primary-hover"
                            >
                                {buffering ? (
                                    <LoaderCircle size={19} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                                ) : playing ? (
                                    <Pause size={19} aria-hidden="true" />
                                ) : (
                                    <Play size={19} aria-hidden="true" className="translate-x-px" />
                                )}
                            </button>

                            <span className="grid min-w-0 flex-1 gap-1.5">
                                <span aria-hidden="true" dir="ltr" className="block h-1.5 overflow-hidden rounded-full bg-line">
                                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(fraction * 100)}%` }} />
                                </span>
                                <span className="flex items-center justify-between font-en text-[0.6875rem] leading-4 text-muted tabular-nums" dir="ltr">
                                    <span>{formatAudioTime(time)}</span>
                                    <span>{formatAudioTime(duration)}</span>
                                </span>
                            </span>

                            <button
                                type="button"
                                onClick={cycleRate}
                                dir="ltr"
                                aria-label={`تغییر سرعت پخش، اکنون ${rate} برابر`}
                                className="inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-field px-3 font-en text-sm font-bold text-ink tabular-nums transition-[background-color,border-color] duration-150 hover:bg-canvas"
                            >
                                {rate}×
                            </button>
                        </div>
                    )}

                    {hasError && (
                        <p role="alert" className="m-0 flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 text-sm text-danger">
                            پخش صدا ممکن نشد.
                            <button
                                type="button"
                                onClick={retry}
                                className="inline-flex min-h-11 cursor-pointer items-center px-1 font-bold text-primary underline underline-offset-4"
                            >
                                تلاش دوباره
                            </button>
                        </p>
                    )}

                    <p className="m-0 border-t border-line bg-canvas px-5 py-2.5 text-[0.8125rem] leading-6 text-muted">
                        بخشی از متن نمونه. متن کامل و واژه‌ها در صفحهٔ نمونه است.
                    </p>
                </figure>
            </div>
        </section>
    );
}

function SampleFallback({ downloadHref }: { downloadHref: string }): React.JSX.Element {
    return (
        <div className="rounded-[1.5rem] border border-line bg-surface p-6 sm:p-8">
            <p className="m-0 text-lg font-extrabold text-ink">نمونهٔ عمومی هنوز منتشر نشده است</p>
            <p className="mt-2 mb-0 leading-8 text-muted">
                به‌محض انتشار، همان‌جا بدون ثبت‌نام باز می‌شود. وضعیت نسخهٔ اندروید در صفحهٔ دانلود اعلام می‌شود.
            </p>
            <Link href={downloadHref} className={`${secondaryCta} mt-5`}>
                <Download size={18} aria-hidden="true" />
                صفحهٔ دانلود
            </Link>
        </div>
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
    const downloadHref = releasePublished && downloadUrl !== null ? downloadUrl : urls.download;
    const sampleQuote = sampleParagraphs[1] ?? sampleParagraphs[0] ?? null;
    const statusNote =
        sample !== null
            ? releasePublished
                ? 'نمونه بدون ثبت‌نام باز می‌شود. نسخهٔ اندروید از صفحهٔ دانلود در دسترس است.'
                : 'نمونه بدون ثبت‌نام باز می‌شود. نسخهٔ اندروید هنوز منتشر نشده؛ وضعیت آن در صفحهٔ دانلود است.'
            : releasePublished
              ? 'نمونهٔ عمومی هنوز منتشر نشده است. نسخهٔ اندروید از صفحهٔ دانلود در دسترس است.'
              : 'نمونهٔ عمومی هنوز منتشر نشده است. وضعیت نسخهٔ اندروید در صفحهٔ دانلود اعلام می‌شود.';

    return (
        <>
            {/* 1. Cover: promise at the start, the working sample at the end. */}
            <section aria-label="معرفی Fast English" className="mx-auto w-full max-w-[1200px] px-4 pt-10 pb-14 sm:px-6 sm:pt-14 lg:pt-20 lg:pb-20">
                <div className="grid gap-12 lg:grid-cols-[1fr_1.03fr] lg:items-start lg:gap-16">
                    <div className="grid content-start gap-6 lg:pt-3">
                        <p className="m-0 flex items-center gap-3 text-sm font-bold text-ink">
                            <span aria-hidden="true" className="h-px w-8 bg-accent-strong" />
                            خواندن و شنیدن، از یک نسخه
                        </p>

                        <h1 className="m-0 max-w-[15ch] text-[2.25rem] leading-[1.32] font-extrabold tracking-[-0.02em] text-balance text-ink sm:text-[3rem] sm:leading-[1.28] lg:text-[3.4rem] lg:leading-[1.24]">
                            انگلیسی را با داستان‌های کوتاه{' '}
                            <span className="block text-accent-strong">بخوان و بشنو</span>
                        </h1>

                        <p className="m-0 max-w-[48ch] text-[1.0625rem] leading-9 text-pretty text-muted">
                            هر مطلب یک متن کوتاه انگلیسی در سطح توست، با صوت همان نسخه. بخوان و هم‌زمان بشنو، سرعت را تنظیم کن و واژه‌های تازه را برای مرور نگه دار.
                        </p>

                        <HeroActions
                            sample={sample}
                            sampleHref={sampleHref}
                            releasePublished={releasePublished}
                            downloadUrl={downloadUrl}
                            urls={urls}
                        />

                        <p className="m-0 max-w-[48ch] text-sm leading-7 text-muted">{statusNote}</p>

                        <dl className="m-0 grid grid-cols-3 gap-x-4 border-t border-line pt-5">
                            <div className="grid gap-1">
                                <dt className="text-xs text-muted">سطح‌ها</dt>
                                <dd className="m-0 text-sm font-extrabold text-ink">A1 تا C2</dd>
                            </div>
                            <div className="grid gap-1">
                                <dt className="text-xs text-muted">هر درس</dt>
                                <dd className="m-0 text-sm font-extrabold text-ink">متن + صوت</dd>
                            </div>
                            <div className="grid gap-1">
                                <dt className="text-xs text-muted">نمونه</dt>
                                <dd className="m-0 text-sm font-extrabold text-ink">بدون ثبت‌نام</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="lg:pt-1">
                        {sample !== null ? (
                            <SampleSheet sample={sample} paragraphs={sampleParagraphs} audioUrl={sampleAudioUrl} />
                        ) : (
                            <SampleFallback downloadHref={urls.download} />
                        )}
                    </div>
                </div>
            </section>

            {/* 2. The six levels, set as a dark typographic band. */}
            <section aria-label="سطح‌ها" className="bg-ink text-surface">
                <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-16 lg:py-20">
                    <div className="grid content-start gap-4">
                        <p className="m-0 flex items-center gap-3 text-[0.8125rem] font-bold text-surface/80">
                            <span aria-hidden="true" className="h-px w-7 bg-surface/30" />
                            سطح
                        </p>
                        <h2 className="fe-title m-0 text-[2rem] leading-[1.32] font-extrabold text-balance sm:text-[2.5rem]">
                            هر متن، در سطح خودش
                        </h2>
                        <p className="m-0 max-w-[46ch] leading-9 text-pretty text-surface/75">
                            از A1 تا C2. هر مطلب نسخهٔ خودش را دارد و متن و صوت همیشه از یک نسخه‌اند. اگر نسخه‌ای آماده نباشد، همان را می‌بینی.
                        </p>
                    </div>

                    <div>
                        <ul className="m-0 grid list-none grid-cols-3 gap-x-3 gap-y-6 p-0 sm:grid-cols-6" aria-label="شش سطح A1 تا C2">
                            {LEVELS.map((level) => {
                                const current = sample?.level === level;

                                return (
                                    <li key={level} className="border-t border-surface/20 pt-3">
                                        <span
                                            lang="en"
                                            dir="ltr"
                                            className={`block font-en text-[2.125rem] leading-none font-black tracking-[-0.05em] tabular-nums sm:text-[2.75rem] lg:text-[3.25rem] ${
                                                current ? 'text-surface' : 'text-surface/55'
                                            }`}
                                        >
                                            {level}
                                        </span>
                                        <span className="mt-2 block h-0.5 w-full max-w-10 bg-surface/15" aria-hidden="true">
                                            {current && <span className="block h-full w-full bg-accent" />}
                                        </span>
                                        {current && (
                                            <span className="mt-1.5 block text-[0.6875rem] font-bold text-surface">سطح نمونه</span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="mt-7 mb-0 border-t border-surface/20 pt-4 text-sm text-surface/75">
                            سطح، سختی متن را می‌گوید؛ نه دسترسی را.
                        </p>
                    </div>
                </div>
            </section>

            {/* 3. The session, as an editorial run of rows. */}
            <section aria-label="روش کار" className="border-b border-line bg-surface">
                <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:py-20">
                    <div className="grid content-start gap-4">
                        <SectionMark index="۰۱">روش</SectionMark>
                        <h2 className="fe-title m-0 text-[2rem] leading-[1.32] font-extrabold text-balance sm:text-[2.5rem]">
                            از باز کردن تا مرور
                        </h2>
                        <p className="m-0 max-w-[40ch] leading-9 text-pretty text-muted">
                            لازم نیست از اول شروع کنی. هر جلسه از سطح خودت و همان‌جایی که مانده‌ای ادامه پیدا می‌کند.
                        </p>
                    </div>

                    <ol className="m-0 grid list-none gap-0 p-0">
                        {STEPS.map((step, index) => (
                            <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t border-line py-5 last:border-b sm:grid-cols-[3.5rem_1fr]">
                                <span className="pt-1 text-base font-bold text-muted tabular-nums" aria-hidden="true">
                                    {folio(index + 1)}
                                </span>
                                <div className="grid gap-1">
                                    <h3 className="m-0 text-lg leading-8 font-extrabold text-ink">{step.title}</h3>
                                    <p className="m-0 max-w-[52ch] text-[0.9375rem] leading-7 text-muted">{step.text}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* 4. The real sample, as a magazine spread. */}
            {sample !== null && (
                <section aria-label="نمونه واقعی" className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-6 lg:py-20">
                    <div className="grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16">
                        <figure className="m-0">
                            <div className="rounded-[1.75rem] border border-line bg-surface p-2">
                                <div className="aspect-[16/10] overflow-hidden rounded-[1.25rem] bg-canvas">
                                    <CoverImage src={sample.cover_url} />
                                </div>
                            </div>
                            <figcaption className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-muted">
                                <span>از کتابخانهٔ Fast English</span>
                                <span className="font-en" dir="ltr" lang="en">
                                    {sample.title_en}
                                </span>
                            </figcaption>
                        </figure>

                        <div className="grid content-start gap-4">
                            <SectionMark index="۰۲">نمونه</SectionMark>
                            <h2 className="fe-title m-0 text-[2rem] leading-[1.32] font-extrabold text-balance sm:text-[2.5rem]">
                                یک نمونه واقعی، بدون ثبت‌نام
                            </h2>
                            <p className="m-0 font-en text-2xl leading-9 font-bold tracking-[-0.01em] text-ink" lang="en" dir="ltr">
                                {sample.title_en}
                            </p>
                            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                                <span lang="en" dir="ltr" className="rounded-md bg-ink px-2 py-0.5 font-en text-xs font-bold text-surface">
                                    {sample.level}
                                </span>
                                <span>متن کامل و صوت همان نسخه</span>
                            </p>
                            <p className="m-0 max-w-[46ch] leading-8 text-pretty text-muted">
                                بدون حساب باز می‌شود؛ همان تجربه‌ای که بعد از اشتراک هر روز داری. یک صفحه بخوان و هم‌زمان بشنو.
                            </p>

                            {sampleQuote !== null && (
                                <blockquote className="mt-2 border-t border-line pt-5">
                                    <p
                                        lang="en"
                                        dir="ltr"
                                        className="m-0 line-clamp-5 text-start font-en text-[1.0625rem] leading-9 text-ink"
                                    >
                                        {sampleQuote}
                                    </p>
                                    <footer className="mt-2 text-xs text-muted">از متن نمونه</footer>
                                </blockquote>
                            )}

                            <Link href={sampleHref} className={`${primaryCta} mt-2 self-start lg:w-fit`}>
                                <Play size={19} aria-hidden="true" />
                                خواندن و شنیدن نمونه
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* 5. Library contents: one editorial row per topic. */}
            {featured.length > 0 && (
                <section aria-label="تازه‌ترین مطالب" className="border-y border-line bg-surface">
                    <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:py-20">
                        <div className="grid content-start gap-4">
                            <SectionMark index="۰۳">کتابخانه</SectionMark>
                            <h2 className="fe-title m-0 text-[2rem] leading-[1.32] font-extrabold text-balance sm:text-[2.5rem]">
                                تازه‌ترین مطالب
                            </h2>
                            <p className="m-0 max-w-[38ch] leading-9 text-pretty text-muted">
                                هر مطلب در سطح‌های منتشرشدهٔ خودش می‌آید. سطح را انتخاب کن و همان نسخه را بخوان و بشنو.
                            </p>
                        </div>

                        <ul className="m-0 grid list-none divide-y divide-line border-y border-line p-0">
                            {featured.map((topic, index) => (
                                <li key={topic.slug}>
                                    <div className="grid grid-cols-[1.5rem_1fr_5.5rem] items-center gap-x-3 py-4 sm:grid-cols-[2.75rem_1fr_9.5rem] sm:gap-4 sm:py-5">
                                        <span className="text-sm font-bold text-muted tabular-nums" aria-hidden="true">
                                            {folio(index + 1)}
                                        </span>
                                        <div className="grid min-w-0 gap-1.5">
                                            <span lang="en" dir="ltr" className="font-en text-lg leading-7 font-bold tracking-[-0.01em] text-ink sm:text-xl">
                                                {topic.title_en}
                                            </span>
                                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                                                {topic.levels.length > 0 && (
                                                    <span className="font-en" lang="en" dir="ltr">
                                                        {topic.levels.join(' · ')}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock size={14} aria-hidden="true" />
                                                    حدود {topic.minutes.toLocaleString('fa-IR')} دقیقه
                                                </span>
                                            </span>
                                        </div>
                                        <span className="block w-full overflow-hidden rounded-lg border border-line">
                                            <span className="block aspect-video">
                                                <CoverImage src={topic.cover_url} />
                                            </span>
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            )}

            {/* 6. Plans: the real names, durations, and server-formatted prices. */}
            <section id="plans" aria-label="پلن‌ها" className="scroll-mt-20">
                <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:gap-16 lg:py-20">
                    <div className="grid content-start gap-4">
                        <SectionMark index="۰۴">اشتراک</SectionMark>
                        <h2 className="fe-title m-0 text-[2rem] leading-[1.32] font-extrabold text-balance sm:text-[2.5rem]">پلن‌ها</h2>
                        <p className="m-0 max-w-[42ch] leading-9 text-pretty text-muted">
                            یک اشتراک، همهٔ کتابخانه را باز می‌کند. مبلغ و مدت هر پلن همان‌جا آمده است.
                        </p>

                        <div className="mt-1 grid gap-0 border-t border-line">
                            {PLAN_INCLUDES.map((item) => (
                                <p key={item} className="m-0 border-b border-line py-3 text-[0.9375rem] leading-7 text-ink">
                                    {item}
                                </p>
                            ))}
                        </div>

                        {!salesOn && (
                            <div role="status" className="mt-2 grid gap-2 rounded-2xl border border-line bg-surface p-5">
                                <p className="m-0 font-extrabold text-ink">فروش هنوز فعال نشده است</p>
                                <p className="m-0 text-sm leading-7 text-muted">
                                    قیمت‌ها همین‌جا آمده‌اند؛ خرید پس از فعال‌شدن فروش در همین صفحه ممکن می‌شود.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="grid content-start gap-4">
                        {plans.length === 0 ? (
                            <div className="grid gap-3 rounded-2xl border border-line bg-surface p-6 sm:p-8">
                                <p className="m-0 text-lg font-extrabold text-ink">در حال حاضر پلن فعالی وجود ندارد</p>
                                <p className="m-0 leading-8 text-pretty text-muted">
                                    نمونهٔ عمومی بدون حساب باز می‌شود. پلن‌ها پس از فعال‌شدن در همین صفحه نمایش داده می‌شوند.
                                </p>
                                {sample !== null && (
                                    <Link href={sampleHref} className={`${secondaryCta} mt-1 self-start`}>
                                        <Play size={18} aria-hidden="true" />
                                        شروع با نمونه رایگان
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <>
                                <p className="m-0 text-[0.9375rem] text-muted">
                                    {plansFromLabel === null ? 'پلن‌های فعال' : `پلن‌ها از ${plansFromLabel} شروع می‌شوند`}
                                </p>

                                <ul className="m-0 grid list-none border-t border-line p-0">
                                    {plans.map((plan) => (
                                        <li
                                            key={plan.id}
                                            className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b border-line py-5 sm:grid-cols-[1fr_auto] sm:py-6"
                                        >
                                            <div className="grid gap-1">
                                                <h3 className="m-0 text-base leading-7 font-extrabold text-ink">{plan.name_fa}</h3>
                                                <p className="m-0 flex items-center gap-1.5 text-sm text-muted">
                                                    <Clock size={15} aria-hidden="true" />
                                                    {plan.duration_days.toLocaleString('fa-IR')} روز دسترسی
                                                </p>
                                            </div>
                                            <p className="m-0 text-xl leading-8 font-extrabold text-ink tabular-nums sm:text-2xl">
                                                {plan.price_label}
                                            </p>
                                        </li>
                                    ))}
                                </ul>

                                <div className="mt-1 flex flex-col items-start gap-3">
                                    <p className="m-0 text-sm leading-7 text-muted">دسترسی پس از تأیید پرداخت فعال می‌شود.</p>
                                    {salesOn ? (
                                        <Link href={urls.register} className={primaryCta}>
                                            ساخت حساب و خرید
                                        </Link>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled
                                            className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-full bg-primary px-6 py-3 font-bold text-surface opacity-60"
                                        >
                                            پرداخت هنوز فعال نشده
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* 7. FAQ: the three real questions, as divider rows. */}
            <section aria-label="پرسش‌های پرتکرار" className="border-y border-line bg-surface">
                <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:py-20">
                    <div className="grid content-start gap-4">
                        <SectionMark index="۰۵">پرسش‌ها</SectionMark>
                        <h2 className="fe-title m-0 text-[2rem] leading-[1.32] font-extrabold text-balance sm:text-[2.5rem]">
                            پرسش‌های پرتکرار
                        </h2>
                        <p className="m-0 max-w-[36ch] leading-8 text-pretty text-muted">
                            جواب کوتاه سه سؤال اول. بقیه را در صفحهٔ پرسش‌ها بخوان.
                        </p>
                        <Link href={urls.faq} className={`${secondaryCta} mt-1 self-start lg:w-fit`}>
                            مشاهده همه پرسش‌ها
                        </Link>
                    </div>

                    <div className="border-t border-line">
                        {faqs.map((item, index) => (
                            <details key={item.q} open={index === 0} className="group border-b border-line">
                                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-extrabold text-ink [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                                    {item.q}
                                    <Plus
                                        size={18}
                                        aria-hidden="true"
                                        className="shrink-0 text-muted transition-transform duration-150 group-open:rotate-45"
                                    />
                                </summary>
                                <p className="mt-0 mb-5 max-w-[58ch] leading-8 text-muted">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* 8. Closing: a back cover panel with one clear action. */}
            <section aria-label="شروع" className="mx-auto w-full max-w-[1200px] px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="rounded-[1.75rem] border border-line bg-surface px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
                    <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
                        <div className="grid content-start gap-4">
                            <SectionMark index="۰۶">شروع</SectionMark>
                            <h2 className="fe-title m-0 max-w-[16ch] text-[2.125rem] leading-[1.3] font-extrabold text-balance sm:text-[3rem]">
                                همین حالا یک داستان کوتاه بخوان.
                            </h2>
                            <p className="m-0 max-w-[52ch] leading-9 text-pretty text-muted">
                                یک نمونه را باز کن و هم‌زمان بشنو. برای ادامه، حساب بساز و پلن را انتخاب کن؛ دسترسی پس از تأیید پرداخت فعال می‌شود و پیشرفت، واژه‌ها و برنامهٔ روزانه‌ات ذخیره می‌ماند.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
                            <HeroActions
                                sample={sample}
                                sampleHref={sampleHref}
                                releasePublished={releasePublished}
                                downloadUrl={downloadUrl}
                                urls={urls}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
};

LandingIndex.layout = publicLayout;

export default LandingIndex;
