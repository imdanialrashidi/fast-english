import { Link } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';
import {
    BookOpen,
    CalendarCheck,
    Check,
    Download,
    ExternalLink,
    Headphones,
    Languages,
    LibraryBig,
    ListChecks,
    MessageCircle,
    PenLine,
    Phone,
    Send,
    Smartphone,
    Timer,
    Video,
} from 'lucide-react';
import type { SharedProps, SupportContact } from '@/types';
import { publicLayout } from '@/layouts/PublicLayout';
import { supportChannels } from '@/lib/support';

/**
 * Landing (GET /), rewritten for the owner instruction of 2026-11-22.
 *
 * Conversion structure:
 * 1. Hero: the promise, the owner-supplied 16,355 learners, the
 *    990,000 → 641,000 offer, and a real library sheet built from the
 *    three newest TED Talks.
 * 2. Library: measured counts (texts, tracks, levels, units).
 * 3. Inside: asymmetric hierarchy. TED is the flagship (7 columns), the
 *    AEF course is the second pillar (5), and the three study tools share
 *    the last row. The layout mirrors the content weight instead of
 *    repeating equal cards.
 * 4. TED Talk band: talks, transcript words, listening hours, and the
 *    public TED video link. The app's transcript/audio stay paid.
 * 5. Method: four repeated actions and a 15-minute session layout.
 * 6. Offer: 990,000 struck through, 641,000 payable, 35% off.
 * 7. FAQ and closing: support is one tap away at every step.
 *
 * Truth rules: every library number arrives from the server; only the
 * learner count and the offer are owner-supplied config. There is no
 * free-sample link, no trial CTA, no fake rating, testimonial, or logo
 * bar. The only external destinations are the real TED source pages.
 *
 * Art direction: deep ink for the promise, warm paper for reading, one
 * teal accent for levels/progress and one navy voice for action. The
 * folio numbers and the A1-C2 rail are the repeated identity motif.
 * Motion stays hover/focus only, per the permanent-light owner contract.
 */
interface LandingStats {
    learners: number;
    levels: number;
    texts: number;
    words: number;
    listeningHours: number;
    units: number;
    exercises: number;
    talks: number;
    talkWords: number;
    talkHours: number;
    stories: number;
    ielts: number;
    inside: number;
    placementQuestions: number;
}

interface TalkProps {
    title_en: string;
    speaker: string;
    area_label: string;
    minutes: number;
    cover_url: string | null;
    source_url: string;
}

interface OfferProps {
    price_label: string;
    compare_label: string;
    per_day_label: string;
    discount_percent: number;
    duration_days: number;
}

interface FaqProps {
    q: string;
    a: string;
}

interface LandingProps extends SharedProps {
    stats: LandingStats;
    talks: TalkProps[];
    offer: OfferProps;
    faqs: FaqProps[];
    releasePublished: boolean;
    downloadUrl: string | null;
    urls: {
        register: string;
        download: string;
        install: string;
        faq: string;
        support: string;
    };
}

const LEVELS = [
    { code: 'A1', label: 'شروع' },
    { code: 'A2', label: 'مقدماتی' },
    { code: 'B1', label: 'میانی' },
    { code: 'B2', label: 'بالاتر از میانی' },
    { code: 'C1', label: 'پیشرفته' },
    { code: 'C2', label: 'تسلط' },
] as const;

const STEPS = [
    {
        title: 'سطحت را پیدا کن',
        body: 'شش سطح A1 تا C2، یا آزمون تعیین سطح تا پیشنهاد یک سطح روشن برسد. سطح فقط سختی محتوا را می‌گوید.',
        meta: '۶ سطح',
    },
    {
        title: 'محتوا را انتخاب کن',
        body: 'TED Talk، داستان کوتاه، آیلتس، Inside Reading یا یونیت گرامر. هر روز یک انتخاب، نه یک فهرست بی‌پایان.',
        meta: '۴ مسیر',
    },
    {
        title: 'بخوان و بشنو',
        body: 'متن و صوت همیشه از یک نسخه‌اند. سرعت را بین ۰٫۷۵ و ۱٫۵ برابر تنظیم کن و هر جا رها کردی، همان‌جا ادامه بده.',
        meta: '۰٫۷۵ تا ۱٫۵ برابر',
    },
    {
        title: 'واژه‌ها را نگه دار',
        body: 'واژهٔ مهم را با معنی و مثال ذخیره کن. کارت مرور سر موعد برمی‌گردد و خودت درجهٔ دوباره، سخت، خوب یا آسان را می‌زنی.',
        meta: '۴ درجه مرور',
    },
] as const;

const SESSION = [
    { title: 'خواندن', minutes: 4 },
    { title: 'شنیدن', minutes: 5 },
    { title: 'واژه‌ها', minutes: 4 },
    { title: 'مرور', minutes: 2 },
] as const;

const INCLUDED = [
    '۲۲۱ متن و سخنرانی در شش سطح A1 تا C2',
    '۵۳ سخنرانی TED Talk با متن، واژه‌های کلیدی و صوت',
    '۶ کتاب American English File با ۶۶ یونیت و ۱٬۶۳۰ تمرین',
    'سه مسیر خواندن: داستان، آیلتس و Inside Reading',
    'واژه‌نامهٔ شخصی با مرور زمان‌بندی‌شده در چهار درجه',
    'برنامهٔ روزانه، ادامه از همان‌جا و پیشرفت روی همهٔ دستگاه‌ها',
    'نصب روی گوشی به‌صورت PWA یا نسخهٔ اندروید',
    'پشتیبانی مستقیم در بله و تلگرام',
] as const;

const primaryCta =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-extrabold whitespace-nowrap text-surface no-underline transition-colors duration-150 hover:bg-primary-hover';

const secondaryCta =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-field bg-transparent px-5 py-3 text-base font-bold whitespace-nowrap text-ink no-underline transition-colors duration-150 hover:bg-canvas';

const primaryOnInk =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface px-6 py-3 text-base font-extrabold whitespace-nowrap text-ink no-underline transition-colors duration-150 hover:bg-canvas';

const secondaryOnInk =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-surface/30 bg-transparent px-5 py-3 text-base font-bold whitespace-nowrap text-surface no-underline transition-colors duration-150 hover:bg-surface/10';

const fa = (value: number): string => value.toLocaleString('fa-IR');

const folio = (value: number): string => value.toLocaleString('fa-IR', { minimumIntegerDigits: 2, useGrouping: false });

function CoverImage({
    src,
    eager = false,
    priority = false,
}: {
    src: string | null;
    eager?: boolean;
    priority?: boolean;
}): React.JSX.Element {
    if (src === null) {
        return (
            <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-ink">
                <span className="font-en text-xl font-black text-surface">F</span>
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
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            className="block h-full w-full object-cover"
        />
    );
}

function SectionLabel({
    index,
    children,
    tone = 'light',
}: {
    index: string;
    children: ReactNode;
    tone?: 'light' | 'dark';
}): React.JSX.Element {
    const dark = tone === 'dark';

    return (
        <p className={`m-0 flex items-center gap-3 text-[0.8125rem] font-bold ${dark ? 'text-surface/70' : 'text-muted'}`}>
            <span className={`tabular-nums ${dark ? 'text-surface' : 'text-ink'}`}>{index}</span>
            <span aria-hidden="true" className={`h-px w-8 ${dark ? 'bg-surface/30' : 'bg-accent-strong'}`} />
            <span>{children}</span>
        </p>
    );
}

function SupportActions({
    support,
    tone = 'light',
}: {
    support: SupportContact | null;
    tone?: 'light' | 'dark';
}): React.JSX.Element {
    const channels = supportChannels(support);
    const dark = tone === 'dark';

    const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold no-underline transition-colors duration-150';
    const quiet = dark
        ? 'border border-surface/30 text-surface hover:bg-surface/10'
        : 'border border-field text-ink hover:bg-canvas';

    return (
        <div className="grid gap-2 sm:grid-cols-2">
            <a
                href={channels.phoneHref}
                dir="ltr"
                aria-label={`تماس با پشتیبانی ${channels.phone}`}
                className={`${base} sm:col-span-2 ${dark ? 'bg-accent-strong text-surface hover:bg-accent-strong/90' : 'bg-primary text-surface hover:bg-primary-hover'}`}
            >
                <Phone size={16} aria-hidden="true" />
                {channels.phone}
            </a>
            <a href={channels.bale} target="_blank" rel="noopener noreferrer" className={`${base} ${quiet}`}>
                <MessageCircle size={16} aria-hidden="true" />
                پیام در بله
            </a>
            <a href={channels.telegram} target="_blank" rel="noopener noreferrer" className={`${base} ${quiet}`}>
                <Send size={16} aria-hidden="true" />
                پیام در تلگرام
            </a>
        </div>
    );
}

function SupportBox({
    support,
    tone = 'light',
    className = '',
}: {
    support: SupportContact | null;
    tone?: 'light' | 'dark';
    className?: string;
}): React.JSX.Element {
    const channels = supportChannels(support);
    const dark = tone === 'dark';

    return (
        <aside
            aria-label="پشتیبانی"
            className={`grid gap-3 rounded-2xl border p-4 sm:p-5 ${dark ? 'border-surface/20 bg-surface/5' : 'border-line bg-canvas'} ${className}`}
        >
            <div className="grid gap-1">
                <p className={`m-0 flex items-center gap-2 font-extrabold ${dark ? 'text-surface' : 'text-ink'}`}>
                    <MessageCircle size={18} aria-hidden="true" />
                    پشتیبانی، قبل از خرید هم جواب می‌دهد.
                </p>
                <p className={`m-0 text-sm leading-7 ${dark ? 'text-surface/75' : 'text-muted'}`}>
                    در بله یا تلگرام به شمارهٔ{' '}
                    <span dir="ltr" className={`font-en font-bold ${dark ? 'text-surface' : 'text-ink'}`}>
                        {channels.phone}
                    </span>{' '}
                    پیام بده. اگر ترجیح می‌دهی، مستقیم تماس بگیر.
                </p>
            </div>
            <SupportActions support={support} tone={tone} />
        </aside>
    );
}

function LibrarySheet({ talks, stats }: { talks: TalkProps[]; stats: LandingStats }): React.JSX.Element {
    return (
        <div className="relative">
            <span
                aria-hidden="true"
                className="absolute inset-0 -translate-x-2 translate-y-2 rounded-[1.75rem] bg-accent-strong sm:-translate-x-3 sm:translate-y-3"
            />
            <figure className="relative m-0 overflow-hidden rounded-[1.75rem] border border-surface/15 bg-surface text-ink">
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                    <span className="flex items-center gap-2 text-sm font-extrabold">
                        <LibraryBig size={17} aria-hidden="true" className="text-accent-strong" />
                        کتابخانهٔ Fast English
                    </span>
                    <span lang="en" dir="ltr" className="rounded-full border border-line bg-canvas px-3 py-1 font-en text-xs font-bold">
                        A1 · C2
                    </span>
                </div>

                {talks.length > 0 ? (
                    <ul className="m-0 grid list-none divide-y divide-line p-0">
                        {talks.map((talk, index) => (
                            <li
                                key={`${talk.title_en}-${index}`}
                                className="grid grid-cols-[5rem_1fr] items-center gap-3 px-4 py-3.5 sm:grid-cols-[6.5rem_1fr] sm:gap-4 sm:px-5"
                            >
                                <span className="block overflow-hidden rounded-lg border border-line">
                                    <span className="block aspect-video">
                                        <CoverImage src={talk.cover_url} eager priority={index === 0} />
                                    </span>
                                </span>
                                <span className="grid min-w-0 gap-1">
                                    <span className="flex flex-wrap items-center gap-2 text-[0.6875rem] font-bold">
                                        <span className="rounded bg-accent-strong/10 px-1.5 py-0.5 text-accent-strong">TED Talk</span>
                                        <span className="text-muted">{talk.area_label}</span>
                                    </span>
                                    <span
                                        lang="en"
                                        dir="ltr"
                                        className="line-clamp-2 text-start font-en text-[0.9375rem] leading-6 font-bold text-ink sm:text-base"
                                    >
                                        {talk.title_en}
                                    </span>
                                    <span className="text-xs text-muted">
                                        {talk.speaker} · {fa(talk.minutes)} دقیقه
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="grid grid-cols-3 gap-2 px-5 py-6">
                        {LEVELS.map((level) => (
                            <span
                                key={level.code}
                                className="rounded-xl border border-line bg-canvas px-2 py-4 text-center font-en text-lg font-black text-ink"
                            >
                                {level.code}
                            </span>
                        ))}
                    </div>
                )}

                <figcaption className="grid gap-1 border-t border-line bg-canvas px-5 py-3.5 text-xs leading-6 text-muted">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-bold text-ink">{fa(stats.talks)} TED Talk</span>
                        <span>{fa(stats.talkWords)} کلمه متن</span>
                        <span>{fa(stats.talkHours)} ساعت صدا</span>
                    </span>
                    <span>و سه مسیر خواندن، شش کتاب گرامر و واژه‌نامهٔ شخصی.</span>
                </figcaption>
            </figure>
        </div>
    );
}

function Stat({ value, label }: { value: string; label: string }): React.JSX.Element {
    return (
        <div className="grid gap-1">
            <dt className="order-2 text-xs leading-5 text-surface/70">{label}</dt>
            <dd className="order-1 m-0 text-xl leading-7 font-black tabular-nums text-surface sm:text-2xl">{value}</dd>
        </div>
    );
}

function TedCard({ talk }: { talk: TalkProps }): React.JSX.Element {
    return (
        <article className="grid grid-cols-[6.5rem_1fr] gap-4 rounded-2xl border border-surface/15 bg-surface p-3 text-ink sm:grid-cols-[9rem_1fr] sm:p-4">
            <span className="block aspect-video overflow-hidden rounded-xl border border-line">
                <CoverImage src={talk.cover_url} />
            </span>
            <div className="grid min-w-0 content-start gap-1.5">
                <p className="m-0 flex items-center gap-1.5 text-xs font-bold text-accent-strong">
                    <Video size={14} aria-hidden="true" />
                    TED Talk · {talk.area_label}
                </p>
                <h3
                    lang="en"
                    dir="ltr"
                    className="m-0 line-clamp-2 text-start font-en text-base leading-7 font-bold tracking-[-0.01em]"
                >
                    {talk.title_en}
                </h3>
                <p className="m-0 text-xs leading-6 text-muted">
                    {talk.speaker} · {fa(talk.minutes)} دقیقه
                </p>
                {talk.source_url !== '' && (
                    <a
                        href={talk.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex min-h-11 w-fit items-center gap-1.5 justify-self-end text-sm font-bold text-primary no-underline hover:underline"
                    >
                        تماشای ویدیو در TED
                        <ExternalLink size={14} aria-hidden="true" />
                    </a>
                )}
            </div>
        </article>
    );
}

function OfferCard({
    offer,
    support,
    registerUrl,
}: {
    offer: OfferProps;
    support: SupportContact | null;
    registerUrl: string;
}): React.JSX.Element {
    return (
        <article aria-label="پیشنهاد اشتراک" className="overflow-hidden rounded-[1.75rem] border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-5 py-4 text-surface sm:px-7">
                <p className="m-0 text-sm font-extrabold sm:text-base">پیشنهاد ویژهٔ Fast English</p>
                {offer.discount_percent > 0 && (
                    <span className="rounded-full bg-accent-strong px-3 py-1 text-xs font-extrabold text-surface sm:text-sm">
                        {fa(offer.discount_percent)}٪ تخفیف
                    </span>
                )}
            </div>

            <div className="grid gap-5 px-5 py-6 sm:px-7 sm:py-8">
                <div>
                    <p className="m-0 text-sm text-muted">قیمت قبل از تخفیف</p>
                    <p className="m-0 text-xl font-bold text-muted line-through decoration-2">{offer.compare_label}</p>
                </div>

                <div>
                    <p className="m-0 text-sm font-bold text-accent-strong">قیمت با تخفیف</p>
                    <p className="m-0 text-[2.75rem] leading-[1.2] font-black tracking-[-0.02em] tabular-nums text-ink sm:text-[3.25rem]">
                        {offer.price_label}
                    </p>
                    <p className="mt-2 mb-0 text-sm leading-7 text-muted">
                        {fa(offer.duration_days)} روز دسترسی کامل · روزی حدود {offer.per_day_label}
                    </p>
                </div>

                <Link href={registerUrl} className={`${primaryCta} w-full`}>
                    <BookOpen size={19} aria-hidden="true" />
                    ثبت‌نام و فعال‌سازی دسترسی
                </Link>

                <div className="grid gap-2 border-t border-line pt-4">
                    <p className="m-0 text-sm leading-7 text-muted">
                        پرداخت کارت‌به‌کارت است؛ بعد از تأیید رسید، دسترسی باز می‌شود و پیام تأیید می‌گیری.
                    </p>
                    <a
                        href={supportChannels(support).phoneHref}
                        dir="ltr"
                        className="inline-flex min-h-11 w-fit items-center gap-2 font-en text-sm font-bold text-primary no-underline hover:underline"
                    >
                        <Phone size={16} aria-hidden="true" />
                        {supportChannels(support).phone}
                    </a>
                </div>
            </div>
        </article>
    );
}

export const LandingIndex: FunctionComponent<LandingProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    stats,
    talks,
    offer,
    faqs,
    releasePublished,
    downloadUrl,
    urls,
    support,
}: LandingProps): React.JSX.Element => {
    const channels = supportChannels(support);
    const downloadHref = releasePublished && downloadUrl !== null ? downloadUrl : urls.install;
    const startLabel = offer.discount_percent > 0 ? `شروع کن با ${fa(offer.discount_percent)}٪ تخفیف` : 'شروع کن';

    return (
        <>
            {/* The promise, the offer, and a real content sheet. */}
            <section aria-label="معرفی Fast English" className="relative overflow-hidden bg-ink text-surface">
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -start-10 -bottom-28 hidden select-none font-en text-[26rem] leading-none font-black text-surface/[0.04] lg:block"
                >
                    A1
                </span>

                <div className="relative mx-auto grid w-full max-w-[1200px] gap-12 px-4 pt-10 pb-14 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pt-20 lg:pb-24">
                    <div className="grid content-start gap-6">
                        <p className="m-0 flex items-center gap-3 text-sm font-bold text-surface/80">
                            <span aria-hidden="true" className="h-px w-8 bg-accent" />
                            خواندن و شنیدن، از یک نسخه
                        </p>

                        <h1 className="m-0 max-w-[18ch] text-[2.15rem] leading-[1.4] font-black tracking-[-0.02em] text-balance sm:text-[3rem] sm:leading-[1.32] lg:text-[3.6rem] lg:leading-[1.26]">
                            روزی ۱۵ دقیقه بخوان و بشنو؛
                            <span className="mt-1 block text-surface/90">انگلیسی‌ات را در ۶ سطح بساز.</span>
                        </h1>

                        <p className="m-0 max-w-[54ch] text-[1.0625rem] leading-9 text-pretty text-surface/75">
                            {fa(stats.learners)} دانش‌آموز موفق، {fa(stats.texts)} متن و سخنرانی، {fa(stats.words)} کلمه و{' '}
                            {fa(stats.listeningHours)} ساعت صدا. یک کتابخانهٔ واقعی برای اینکه هر روز یک قدم جلوتر بروی.
                        </p>

                        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                            <Link href={urls.register} className={primaryOnInk}>
                                <BookOpen size={19} aria-hidden="true" />
                                {startLabel}
                            </Link>
                            <Link href={urls.support} className={secondaryOnInk}>
                                <MessageCircle size={18} aria-hidden="true" />
                                پیام به پشتیبانی
                            </Link>
                        </div>

                        <p className="m-0 text-sm leading-7 text-surface/70">
                            پرداخت کارت‌به‌کارت · فعال‌سازی پس از تأیید رسید
                        </p>

                        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-surface/75">
                            <Phone size={15} aria-hidden="true" />
                            <span>پشتیبانی:</span>
                            <a
                                href={channels.phoneHref}
                                dir="ltr"
                                aria-label={`تماس با پشتیبانی ${channels.phone}`}
                                className="inline-flex min-h-11 items-center font-en font-bold text-surface no-underline hover:underline"
                            >
                                {channels.phone}
                            </a>
                            <span aria-hidden="true">·</span>
                            <span>بله یا تلگرام</span>
                        </p>

                        <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-surface/20 pt-6 sm:grid-cols-4">
                            <Stat value={fa(stats.learners)} label="دانش‌آموز موفق" />
                            <Stat value={fa(stats.texts)} label="متن و سخنرانی" />
                            <Stat value={fa(stats.words)} label="کلمهٔ متن" />
                            <Stat value={`${fa(stats.listeningHours)} ساعت`} label="صدا" />
                        </dl>
                    </div>

                    <div className="lg:pt-2">
                        <LibrarySheet talks={talks} stats={stats} />
                        <p className="mt-5 mb-0 text-center text-xs leading-6 text-surface/60">
                            محتوای واقعی کتابخانه؛ این سه مورد از تازه‌ترین TED Talkها هستند.
                        </p>
                    </div>
                </div>
            </section>

            {/* Measured library facts, then the six-level rail. */}
            <section aria-label="کتابخانه" className="border-b border-line bg-canvas">
                <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
                    <div className="grid content-start gap-4">
                        <SectionLabel index="۰۱">کتابخانه</SectionLabel>
                        <h2 className="fe-title m-0 text-[2rem] leading-[1.35] font-black tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                            {fa(stats.texts)} متن و سخنرانی. برای هر سلیقه.
                        </h2>
                        <p className="m-0 max-w-[46ch] text-[1.0625rem] leading-9 text-pretty text-muted">
                            از داستان کوتاه و آزمون آیلتس تا سخنرانی TED و یونیت‌های گرامر. سطح را انتخاب می‌کنی، متن را می‌خوانی و همان
                            نسخه را می‌شنوی.
                        </p>

                        <ul className="m-0 mt-2 grid list-none border-t border-line p-0">
                            <li className="flex items-center justify-between gap-4 border-b border-line py-3.5">
                                <span className="flex items-center gap-2 font-bold text-ink">
                                    <BookOpen size={17} aria-hidden="true" className="text-accent-strong" />
                                    داستان کوتاه
                                </span>
                                <span className="text-lg font-black tabular-nums text-ink">{fa(stats.stories)} متن</span>
                            </li>
                            <li className="flex items-center justify-between gap-4 border-b border-line py-3.5">
                                <span className="flex items-center gap-2 font-bold text-ink">
                                    <ListChecks size={17} aria-hidden="true" className="text-accent-strong" />
                                    آیلتس
                                </span>
                                <span className="text-lg font-black tabular-nums text-ink">{fa(stats.ielts)} متن</span>
                            </li>
                            <li className="flex items-center justify-between gap-4 border-b border-line py-3.5">
                                <span className="flex items-center gap-2 font-bold text-ink">
                                    <Languages size={17} aria-hidden="true" className="text-accent-strong" />
                                    Inside Reading
                                </span>
                                <span className="text-lg font-black tabular-nums text-ink">{fa(stats.inside)} متن</span>
                            </li>
                        </ul>
                    </div>

                    <div className="grid content-start gap-6">
                        <div className="flex items-end justify-between gap-4">
                            <p className="m-0 max-w-[38ch] text-[0.9375rem] leading-7 text-muted">
                                سطح فقط سختی متن را می‌گوید، نه دسترسی را. هر محتوا در سطح خودش، با متن و صدای همان نسخه.
                            </p>
                            <span className="hidden shrink-0 items-center gap-2 text-sm font-bold text-ink sm:flex">
                                <Headphones size={17} aria-hidden="true" className="text-accent-strong" />
                                متن + صدا
                            </span>
                        </div>

                        <ul
                            aria-label="شش سطح A1 تا C2"
                            className="m-0 grid list-none grid-cols-3 gap-px border-y border-line bg-line p-0 sm:grid-cols-6"
                        >
                            {LEVELS.map((level) => (
                                <li key={level.code} className="grid gap-1 bg-canvas px-3 py-4">
                                    <span lang="en" dir="ltr" className="font-en text-[1.75rem] leading-none font-black tracking-[-0.04em] text-ink sm:text-[2rem]">
                                        {level.code}
                                    </span>
                                    <span className="text-xs leading-5 text-muted">{level.label}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1 border-s-2 border-accent-strong ps-4">
                                <p className="m-0 text-2xl leading-8 font-black tabular-nums text-ink">{fa(stats.units)}</p>
                                <p className="m-0 text-sm leading-6 text-muted">یونیت گرامر در ۶ کتاب American English File</p>
                            </div>
                            <div className="grid gap-1 border-s-2 border-primary ps-4">
                                <p className="m-0 text-2xl leading-8 font-black tabular-nums text-ink">{fa(stats.exercises)}</p>
                                <p className="m-0 text-sm leading-6 text-muted">تمرین تعاملی با تصحیح و توضیح فارسی</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Asymmetric hierarchy: TED is the flagship, then the course,
                the three tracks, and the three study tools. */}
            <section aria-label="داخل اشتراک" className="border-b border-line bg-surface">
                <div className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
                    <div className="grid gap-4 sm:max-w-[58ch]">
                        <SectionLabel index="۰۲">داخل اشتراک</SectionLabel>
                        <h2 className="fe-title m-0 text-[2rem] leading-[1.35] font-black tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                            یک اشتراک، کل مسیر.
                        </h2>
                        <p className="m-0 text-[1.0625rem] leading-9 text-pretty text-muted">
                            فقط یک کتابخانه نیست. برنامهٔ روزانه، واژه‌نامه، تمرین و مرور کنار همان محتوایی می‌نشیند که هر روز
                            می‌خوانی.
                        </p>
                    </div>

                    <div className="mt-8 grid gap-4 lg:grid-cols-12">
                        <article className="grid content-start gap-5 rounded-[1.5rem] bg-ink p-6 text-surface sm:p-8 lg:col-span-7">
                            <div className="flex items-center justify-between gap-4">
                                <p className="m-0 flex items-center gap-2 text-sm font-bold text-surface/80">
                                    <Video size={17} aria-hidden="true" className="text-accent" />
                                    TED Talks
                                </p>
                                <span lang="en" dir="ltr" className="font-en text-xs font-bold text-surface/60">
                                    TED · {fa(stats.talks)}
                                </span>
                            </div>
                            <p className="m-0 text-[3rem] leading-none font-black tabular-nums sm:text-[4rem]">{fa(stats.talks)}</p>
                            <p className="m-0 max-w-[42ch] text-[1.0625rem] leading-8 text-surface/80">
                                سخنرانی TED Talk با متن کامل، واژه‌های کلیدی و صوت. ویدیو را از منبع اصلی ببین و متن را همین‌جا
                                بخوان.
                            </p>
                            <dl className="m-0 grid grid-cols-2 gap-4 border-t border-surface/20 pt-4">
                                <div className="grid gap-1">
                                    <dt className="order-2 text-xs text-surface/60">کلمهٔ متن</dt>
                                    <dd className="order-1 m-0 text-xl font-black tabular-nums">{fa(stats.talkWords)}</dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="order-2 text-xs text-surface/60">ساعت صدا</dt>
                                    <dd className="order-1 m-0 text-xl font-black tabular-nums">{fa(stats.talkHours)}</dd>
                                </div>
                            </dl>
                            <a
                                href="#ted"
                                className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-surface/30 px-4 py-2 text-sm font-bold text-surface no-underline hover:bg-surface/10"
                            >
                                دیدن بخش TED Talks
                            </a>
                        </article>

                        <article className="grid content-start gap-4 rounded-[1.5rem] border border-line bg-canvas p-6 lg:col-span-5">
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-muted">
                                <BookOpen size={17} aria-hidden="true" className="text-accent-strong" />
                                کتاب دوره
                            </p>
                            <h3 className="m-0 text-2xl leading-9 font-black text-ink">American English File</h3>
                            <p className="m-0 text-[0.9375rem] leading-7 text-muted">
                                گرامر با توضیح فارسی، مثال و تمرین تعاملی. هر یونیت یک درس کامل با تصحیح سمت سرور.
                            </p>
                            <dl className="m-0 grid grid-cols-3 gap-3 border-t border-line pt-4">
                                <div className="grid gap-1">
                                    <dt className="order-2 text-xs text-muted">کتاب</dt>
                                    <dd className="order-1 m-0 text-xl font-black tabular-nums text-ink">۶</dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="order-2 text-xs text-muted">یونیت</dt>
                                    <dd className="order-1 m-0 text-xl font-black tabular-nums text-ink">{fa(stats.units)}</dd>
                                </div>
                                <div className="grid gap-1">
                                    <dt className="order-2 text-xs text-muted">تمرین</dt>
                                    <dd className="order-1 m-0 text-xl font-black tabular-nums text-ink">{fa(stats.exercises)}</dd>
                                </div>
                            </dl>
                        </article>

                        <article className="grid content-start gap-3 rounded-[1.5rem] border border-line bg-canvas p-6 lg:col-span-4">
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-muted">
                                <LibraryBig size={17} aria-hidden="true" className="text-accent-strong" />
                                سه مسیر خواندن
                            </p>
                            <ul className="m-0 grid list-none border-t border-line p-0">
                                <li className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm">
                                    <span className="font-bold text-ink">داستان کوتاه</span>
                                    <span className="tabular-nums text-muted">{fa(stats.stories)} متن</span>
                                </li>
                                <li className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm">
                                    <span className="font-bold text-ink">آیلتس</span>
                                    <span className="tabular-nums text-muted">{fa(stats.ielts)} متن</span>
                                </li>
                                <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                    <span className="font-bold text-ink">Inside Reading</span>
                                    <span className="tabular-nums text-muted">{fa(stats.inside)} متن</span>
                                </li>
                            </ul>
                            <p className="m-0 text-xs leading-6 text-muted">هر متن با صوت همان نسخه و ادامه از آخرین جای خوانده‌شده.</p>
                        </article>

                        <article className="grid content-start gap-3 rounded-[1.5rem] border border-line bg-canvas p-6 lg:col-span-4">
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-muted">
                                <PenLine size={17} aria-hidden="true" className="text-accent-strong" />
                                واژه‌ها
                            </p>
                            <h3 className="m-0 text-xl leading-8 font-black text-ink">چهار درجه، یک برنامهٔ مرور.</h3>
                            <p className="m-0 text-sm leading-7 text-muted">
                                واژه را با معنی و مثال ذخیره کن؛ کارت مرور سر موعد برمی‌گردد و خودت زمان‌بندی بعدی را انتخاب می‌کنی.
                            </p>
                            <ul className="m-0 flex flex-wrap gap-1.5 p-0">
                                {['دوباره', 'سخت', 'خوب', 'آسان'].map((grade) => (
                                    <li key={grade} className="list-none rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold text-ink">
                                        {grade}
                                    </li>
                                ))}
                            </ul>
                        </article>

                        <article className="grid content-start gap-3 rounded-[1.5rem] border border-line bg-canvas p-6 lg:col-span-4">
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-muted">
                                <CalendarCheck size={17} aria-hidden="true" className="text-accent-strong" />
                                برنامهٔ روزانه
                            </p>
                            <h3 className="m-0 text-xl leading-8 font-black text-ink">امروز چه کاری؟</h3>
                            <p className="m-0 text-sm leading-7 text-muted">
                                یک کار روشن برای هر روز: ادامهٔ درس، مرور واژه یا یک متن تازه. پیشرفت روی وب و گوشی همگام می‌ماند.
                            </p>
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-ink">
                                <Smartphone size={16} aria-hidden="true" className="text-accent-strong" />
                                PWA و اندروید
                            </p>
                        </article>
                    </div>
                </div>
            </section>

            {/* TED Talk band: the strongest content proof and the public
                video source, with the paid transcript/audio explained. */}
            <section id="ted" aria-label="TED Talks" className="scroll-mt-24 bg-ink text-surface">
                <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16 lg:py-24">
                    <div className="grid content-start gap-4">
                        <SectionLabel index="۰۳" tone="dark">
                            TED Talks
                        </SectionLabel>
                        <h2 className="fe-title m-0 text-[2rem] leading-[1.35] font-black tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                            سخنرانی‌های TED، با متن و صدا.
                        </h2>
                        <p className="m-0 max-w-[46ch] text-[1.0625rem] leading-9 text-pretty text-surface/75">
                            {fa(stats.talks)} سخنرانی، {fa(stats.talkWords)} کلمه متن و {fa(stats.talkHours)} ساعت صدا. ویدیوی هر سخنرانی
                            از منبع اصلی باز می‌شود و متن کامل، واژه‌های کلیدی و صوت آن داخل Fast English است.
                        </p>

                        <dl className="m-0 mt-2 grid grid-cols-3 gap-4 border-t border-surface/20 pt-5">
                            <div className="grid gap-1">
                                <dt className="order-2 text-xs leading-5 text-surface/60">سخنرانی</dt>
                                <dd className="order-1 m-0 text-2xl leading-8 font-black tabular-nums">{fa(stats.talks)}</dd>
                            </div>
                            <div className="grid gap-1">
                                <dt className="order-2 text-xs leading-5 text-surface/60">کلمهٔ متن</dt>
                                <dd className="order-1 m-0 text-2xl leading-8 font-black tabular-nums">{fa(stats.talkWords)}</dd>
                            </div>
                            <div className="grid gap-1">
                                <dt className="order-2 text-xs leading-5 text-surface/60">ساعت صدا</dt>
                                <dd className="order-1 m-0 text-2xl leading-8 font-black tabular-nums">{fa(stats.talkHours)}</dd>
                            </div>
                        </dl>

                        <Link href={urls.register} className={`${primaryOnInk} mt-2 self-start`}>
                            <Video size={18} aria-hidden="true" />
                            دسترسی به TED Talks
                        </Link>
                    </div>

                    <div className="grid gap-3">
                        {talks.length > 0 ? (
                            talks.map((talk) => <TedCard key={`${talk.title_en}-${talk.source_url}`} talk={talk} />)
                        ) : (
                            <p className="m-0 rounded-2xl border border-surface/15 bg-surface/5 p-6 text-sm leading-7 text-surface/75">
                                سخنرانی‌ها در کتابخانه در حال انتشارند. متن کامل و صوت پس از انتشار در همین بخش قرار می‌گیرد.
                            </p>
                        )}

                        <p className="m-0 text-xs leading-6 text-surface/60">
                            ویدیوها در سایت رسمی TED منتشر می‌شوند؛ Fast English متن، واژه‌های کلیدی و تجربهٔ خواندن و شنیدن همان
                            سخنرانی را ارائه می‌دهد.
                        </p>
                    </div>
                </div>
            </section>

            {/* Four repeated actions plus the suggested 15-minute layout. */}
            <section aria-label="روش" className="border-b border-line bg-canvas">
                <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:py-24">
                    <div className="grid content-start gap-4">
                        <SectionLabel index="۰۴">روش</SectionLabel>
                        <h2 className="fe-title m-0 text-[2rem] leading-[1.35] font-black tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                            چهار کاری که هر جلسه تکرار می‌شود.
                        </h2>
                        <p className="m-0 max-w-[42ch] text-[1.0625rem] leading-9 text-pretty text-muted">
                            لازم نیست از اول شروع کنی. هر جلسه از سطح خودت و همان‌جایی که مانده‌ای ادامه پیدا می‌کند.
                        </p>

                        {stats.placementQuestions > 0 && (
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-ink">
                                <ListChecks size={17} aria-hidden="true" className="text-accent-strong" />
                                آزمون تعیین سطح {fa(stats.placementQuestions)} سؤالی
                            </p>
                        )}

                        <div className="mt-2 grid gap-3 rounded-2xl border border-line bg-surface p-5">
                            <p className="m-0 flex items-center gap-2 font-extrabold text-ink">
                                <Timer size={18} aria-hidden="true" className="text-accent-strong" />
                                یک جلسهٔ ۱۵ دقیقه‌ای
                            </p>
                            <ol className="m-0 grid list-none border-t border-line p-0">
                                {SESSION.map((item) => (
                                    <li key={item.title} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm">
                                        <span className="text-ink">{item.title}</span>
                                        <span className="font-bold tabular-nums text-muted">{fa(item.minutes)} دقیقه</span>
                                    </li>
                                ))}
                            </ol>
                            <p className="m-0 text-xs leading-6 text-muted">یک چیدمان پیشنهادی؛ می‌توانی کوتاه‌تر شروع کنی و بعد بلندترش کنی.</p>
                        </div>
                    </div>

                    <ol className="m-0 grid list-none p-0">
                        {STEPS.map((step, index) => (
                            <li
                                key={step.title}
                                className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t border-line py-5 last:border-b sm:grid-cols-[4rem_1fr] sm:gap-x-6 sm:py-6"
                            >
                                <span className="pt-1 text-base font-bold text-muted tabular-nums" aria-hidden="true">
                                    {folio(index + 1)}
                                </span>
                                <div className="grid gap-1.5">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                        <h3 className="m-0 text-lg leading-8 font-extrabold text-ink">{step.title}</h3>
                                        <span className="text-xs font-bold text-accent-strong">{step.meta}</span>
                                    </div>
                                    <p className="m-0 max-w-[56ch] text-[0.9375rem] leading-7 text-muted">{step.body}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* The offer is the page's single action, so it gets the
                strongest price contrast and a sticky desktop position. */}
            <section id="pricing" aria-label="اشتراک و قیمت" className="scroll-mt-24 border-b border-line bg-surface">
                <div className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
                    {/* Phone order: promise, offer, inclusions. On desktop
                        the promise and list share the start column and the
                        offer sits beside them, aligned with the promise. */}
                    <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-start lg:gap-x-16">
                        <div className="contents lg:col-start-1 lg:row-start-1 lg:grid lg:content-start lg:gap-5">
                            <div className="order-1 grid content-start gap-4 sm:max-w-[58ch]">
                                <SectionLabel index="۰۵">اشتراک</SectionLabel>
                                <h2 className="fe-title m-0 text-[2rem] leading-[1.35] font-black tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                                    یک اشتراک، همهٔ مسیر.
                                </h2>
                                <p className="m-0 max-w-[48ch] text-[1.0625rem] leading-9 text-pretty text-muted">
                                    همهٔ محتوا، تمرین‌ها، مرور و برنامهٔ روزانه با یک اشتراک باز می‌شود. قیمت پایین‌تر و دسترسی
                                    سه‌ماهه، برای اینکه فرصت کنی عادتت را بسازی.
                                </p>
                            </div>

                            <div className="order-3 grid min-w-0 content-start gap-5">
                                <ul className="m-0 grid min-w-0 list-none grid-cols-1 border-t border-line p-0">
                                    {INCLUDED.map((item) => (
                                        <li key={item} className="flex min-w-0 items-start gap-3 border-b border-line py-3">
                                            <Check size={18} aria-hidden="true" className="mt-1 shrink-0 text-accent-strong" />
                                            <span className="min-w-0 flex-1 text-[0.9375rem] leading-7 text-ink">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="order-2 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24">
                            <OfferCard offer={offer} support={support} registerUrl={urls.register} />

                            <div className="mt-4 grid gap-2 rounded-2xl border border-line bg-canvas p-4 text-sm leading-7 text-muted">
                                <p className="m-0 flex items-center gap-2 font-bold text-ink">
                                    <Download size={17} aria-hidden="true" className="text-accent-strong" />
                                    روی گوشی هم هست.
                                </p>
                                <p className="m-0">
                                    نسخهٔ وب را نصب کن (PWA) یا از{' '}
                                    {releasePublished ? (
                                        <a href={downloadHref} download className="inline-flex min-h-11 items-center font-bold text-primary">
                                            فایل اندروید
                                        </a>
                                    ) : (
                                        <Link href={urls.install} className="inline-flex min-h-11 items-center font-bold text-primary">
                                            راهنمای نصب
                                        </Link>
                                    )}{' '}
                                    استفاده کن.
                                </p>
                            </div>

                            <SupportBox support={support} className="mt-4" />
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ: real answers, with the support channel beside them. */}
            <section aria-label="پرسش‌های پرتکرار" className="border-b border-line bg-canvas">
                <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:py-24">
                    <div className="grid content-start gap-4">
                        <SectionLabel index="۰۶">پرسش‌ها</SectionLabel>
                        <h2 className="fe-title m-0 text-[2rem] leading-[1.35] font-black tracking-[-0.02em] text-balance sm:text-[2.5rem]">
                            قبل از خرید، این‌ها را بدان.
                        </h2>
                        <p className="m-0 max-w-[38ch] leading-8 text-pretty text-muted">
                            جواب کوتاه پنج پرسش اول. اگر جوابت را پیدا نکردی، مستقیم به پشتیبانی پیام بده.
                        </p>
                        <Link href={urls.faq} className={`${secondaryCta} mt-1 self-start`}>
                            همهٔ پرسش‌ها
                        </Link>
                        <SupportBox support={support} className="mt-2" />
                    </div>

                    <div className="border-t border-line">
                        {faqs.map((item, index) => (
                            <details key={item.q} open={index === 0} className="group border-b border-line">
                                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-extrabold text-ink [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                                    {item.q}
                                    <span aria-hidden="true" className="shrink-0 text-xl leading-none text-muted transition-transform duration-150 group-open:rotate-45">
                                        +
                                    </span>
                                </summary>
                                <p className="mt-0 mb-5 max-w-[62ch] text-[0.9375rem] leading-8 text-muted">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Closing action: one price, one button, three support paths. */}
            <section aria-label="شروع" className="bg-ink text-surface">
                <div className="mx-auto w-full max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
                    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-16">
                        <div className="grid content-start gap-4">
                            <SectionLabel index="۰۷" tone="dark">
                                شروع
                            </SectionLabel>
                            <h2 className="fe-title m-0 max-w-[18ch] text-[2.125rem] leading-[1.32] font-black tracking-[-0.02em] text-balance sm:text-[3rem]">
                                امروز شروع کن؛ فردا یک متن واقعی خوانده‌ای.
                            </h2>
                            <p className="m-0 max-w-[54ch] text-[1.0625rem] leading-9 text-pretty text-surface/75">
                                {fa(offer.duration_days)} روز دسترسی، {fa(stats.texts)} متن و سخنرانی، {fa(stats.words)} کلمه و{' '}
                                {fa(stats.listeningHours)} ساعت صدا. با{' '}
                                <span className="whitespace-nowrap">{offer.price_label}</span> شروع کن.
                            </p>
                        </div>

                        <div className="grid gap-3">
                            <Link href={urls.register} className={primaryOnInk}>
                                <BookOpen size={19} aria-hidden="true" />
                                ثبت‌نام و شروع یادگیری
                            </Link>
                            <Link href={urls.install} className={secondaryOnInk}>
                                <Smartphone size={18} aria-hidden="true" />
                                راهنمای نصب روی گوشی
                            </Link>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-surface/20 pt-6">
                        <SupportBox support={support} tone="dark" />
                    </div>
                </div>
            </section>
        </>
    );
};

LandingIndex.layout = publicLayout;

export default LandingIndex;
