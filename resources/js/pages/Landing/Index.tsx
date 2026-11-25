import { Link } from '@inertiajs/react';
import { BookOpen, Check, Download, Headphones, Languages, LibraryBig, MessageCircle, Send, Smartphone, Sparkles } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { publicLayout } from '@/layouts/PublicLayout';
import { supportChannels } from '@/lib/support';
import type { SharedProps, SupportContact } from '@/types';

/**
 * Public landing (owner rewrite 2026-11-25).
 *
 * One promise, one offer, real content samples. The page never links into
 * the learner app: the start button and every content card open the login
 * page, and the only premium proof is metadata plus covers. No audio, body,
 * glossary, transcript, or sample lesson URL is part of this page.
 *
 * The three visible statistics are fixed by the owner. Other measured
 * counts stay server-side and only feed the SEO description.
 */

interface LandingStats {
    learners: number;
    listeningHours: number;
    levels: number;
}

interface PodcastSample {
    slug: string;
    title_en: string;
    title_fa: string | null;
    cover_url: string | null;
    category_name: string | null;
    levels: string[];
    first_level: string | null;
    extra_levels: number;
    minutes: number;
}

interface TalkSample {
    title_en: string;
    speaker: string;
    area_label: string;
    minutes: number;
    cover_url: string | null;
}

interface OfferProps {
    price_label: string;
    compare_label: string;
    discount_percent: number;
}

interface FaqProps {
    q: string;
    a: string;
}

interface LandingProps extends SharedProps {
    stats: LandingStats;
    podcasts: PodcastSample[];
    talks: TalkSample[];
    offer: OfferProps;
    faqs: FaqProps[];
    releasePublished: boolean;
    downloadUrl: string | null;
    urls: {
        start: string;
        login: string;
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

const FEATURES = [
    {
        title: 'هزاران متن و سخنرانی در شش سطح A1 تا C2',
        body: 'هر سطح محتوای خودش را دارد؛ سطح فقط سختی متن را می‌گوید، نه میزان دسترسی.',
        icon: <LibraryBig size={18} aria-hidden="true" />,
    },
    {
        title: 'آموزش و تمرین کامل گرامر',
        body: 'گرامر با توضیح فارسی، مثال و تمرین تعاملی، همراه با کتاب دوره.',
        icon: <BookOpen size={18} aria-hidden="true" />,
    },
    {
        title: 'مسیرهای مختلف خواندن؛ داستان، آیلتس، Inside Reading و…',
        body: 'هر روز یک انتخاب تازه، از داستان کوتاه تا متن‌های آکادمیک.',
        icon: <Languages size={18} aria-hidden="true" />,
    },
    {
        title: 'واژنامهٔ شخصی با مرور زمان‌بندی‌شده',
        body: 'واژه‌ها سر موعد برمی‌گردند تا در حافظه‌ات بمانند.',
        icon: <Sparkles size={18} aria-hidden="true" />,
    },
    {
        title: 'ادامه از همان‌جا و پیشرفت',
        body: 'هر جا رها کردی، همان‌جا ادامه بده و پیشرفتت را ببین.',
        icon: <Check size={18} aria-hidden="true" />,
    },
    {
        title: 'نصب روی گوشی و دریافت نسخهٔ اندروید',
        body: 'روی صفحهٔ اصلی نصب می‌شود، بدون فروشگاه برنامه.',
        icon: <Smartphone size={18} aria-hidden="true" />,
    },
    {
        title: 'پشتیبانی مستقیم در بله و تلگرام',
        body: 'قبل و بعد از خرید، پیام بده؛ سریع راهنمایی می‌گیری.',
        icon: <MessageCircle size={18} aria-hidden="true" />,
    },
] as const;

const primaryCta =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-extrabold whitespace-nowrap text-surface no-underline transition-colors duration-150 hover:bg-primary-hover';
const secondaryCta =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-field bg-transparent px-5 py-3 text-base font-bold whitespace-nowrap text-ink no-underline transition-colors duration-150 hover:bg-canvas';
const primaryOnInk =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface px-6 py-3 text-base font-extrabold whitespace-nowrap text-ink no-underline transition-colors duration-150 hover:bg-canvas';
const secondaryOnInk =
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-surface/30 px-5 py-3 text-base font-bold whitespace-nowrap text-surface no-underline transition-colors duration-150 hover:bg-surface/10';

const fa = (value: number): string => value.toLocaleString('fa-IR');

function CoverImage({ src, eager = false }: { src: string | null; eager?: boolean }): React.JSX.Element {
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
            fetchPriority={eager ? 'high' : undefined}
            decoding="async"
            className="block h-full w-full object-cover"
        />
    );
}

function PodcastCard({ sample, href, eager = false }: { sample: PodcastSample; href: string; eager?: boolean }): React.JSX.Element {
    return (
        <article className="group grid content-start overflow-hidden rounded-2xl border border-line bg-surface no-underline">
            <Link href={href} aria-label={`${sample.title_en} — ورود و شروع یادگیری`} className="grid h-full no-underline">
                <span className="relative block aspect-video overflow-hidden border-b border-line bg-canvas">
                    <CoverImage src={sample.cover_url} eager={eager} />
                    <span className="absolute start-2 top-2 rounded-full bg-ink/90 px-2.5 py-1 text-[0.7rem] font-bold text-surface">
                        پادکست {sample.category_name !== null ? `· ${sample.category_name}` : ''}
                    </span>
                </span>
                <span className="grid gap-2 p-4">
                    <span lang="en" dir="ltr" className="line-clamp-2 min-h-[3rem] text-start font-en text-base leading-6 font-bold text-ink">
                        {sample.title_en}
                    </span>
                    {sample.title_fa !== null && sample.title_fa !== '' && (
                        <span className="line-clamp-1 text-sm text-muted">{sample.title_fa}</span>
                    )}
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <Headphones size={14} aria-hidden="true" />
                        {fa(sample.minutes)} دقیقه
                        {sample.levels.length > 0 && (
                            <span>
                                ·{' '}
                                <span lang="en" dir="ltr" className="font-en font-bold text-ink">
                                    {sample.levels.slice(0, 3).join(' · ')}
                                </span>
                            </span>
                        )}
                    </span>
                </span>
            </Link>
        </article>
    );
}

function TalkCard({ talk, href, eager = false }: { talk: TalkSample; href: string; eager?: boolean }): React.JSX.Element {
    return (
        <article className="group grid content-start overflow-hidden rounded-2xl border border-line bg-surface no-underline">
            <Link href={href} aria-label={`${talk.title_en} — ورود و شروع یادگیری`} className="grid h-full no-underline">
                <span className="relative block aspect-video overflow-hidden border-b border-line bg-canvas">
                    <CoverImage src={talk.cover_url} eager={eager} />
                    <span className="absolute start-2 top-2 rounded-full bg-ink/90 px-2.5 py-1 text-[0.7rem] font-bold text-surface">
                        TED Talk · {talk.area_label}
                    </span>
                </span>
                <span className="grid gap-2 p-4">
                    <span lang="en" dir="ltr" className="line-clamp-2 min-h-[3rem] text-start font-en text-base leading-6 font-bold text-ink">
                        {talk.title_en}
                    </span>
                    <span className="line-clamp-1 text-sm text-muted">
                        <span lang="en" dir="ltr" className="font-en">
                            {talk.speaker}
                        </span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                        <Headphones size={14} aria-hidden="true" />
                        {fa(talk.minutes)} دقیقه
                    </span>
                </span>
            </Link>
        </article>
    );
}

function SupportBox({ support }: { support: SupportContact | null }): React.JSX.Element {
    const channels = supportChannels(support);
    const base =
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold no-underline transition-colors duration-150';

    return (
        <aside aria-label="پشتیبانی" className="grid gap-3 rounded-2xl border border-line bg-canvas p-5">
            <p className="m-0 flex items-start gap-2 text-sm leading-7 text-muted">
                <MessageCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                <span>
                    پشتیبانی قبل از خرید هم جواب می‌دهد. در بله یا تلگرام به شمارهٔ{' '}
                    <span dir="ltr" className="font-en font-bold text-ink">
                        {channels.phone}
                    </span>{' '}
                    پیام بدهید.
                </span>
            </p>
            <div className="flex flex-wrap gap-2">
                <a
                    href={channels.bale}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${base} bg-primary text-surface hover:bg-primary-hover`}
                >
                    <MessageCircle size={16} aria-hidden="true" />
                    پیام در بله
                </a>
                <a
                    href={channels.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${base} border border-field text-ink hover:bg-surface`}
                >
                    <Send size={16} aria-hidden="true" />
                    پیام در تلگرام
                </a>
            </div>
        </aside>
    );
}

export const LandingIndex: FunctionComponent<LandingProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    stats,
    podcasts,
    talks,
    offer,
    faqs,
    releasePublished,
    downloadUrl,
    urls,
    support,
}: LandingProps): React.JSX.Element => {
    const downloadHref = releasePublished && downloadUrl !== null ? downloadUrl : urls.install;
    const startLabel = offer.discount_percent > 0 ? `شروع کن با ${fa(offer.discount_percent)}٪ تخفیف` : 'شروع کن';

    return (
        <>
            <section aria-label="معرفی فست انگلیش" className="relative overflow-hidden bg-ink text-surface">
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -start-12 -bottom-32 hidden select-none font-en text-[30rem] leading-none font-black text-surface/[0.04] lg:block"
                >
                    A1
                </span>

                <div className="relative mx-auto grid w-full max-w-[1120px] gap-10 px-4 pt-12 pb-14 sm:px-6 sm:pt-16 lg:pt-20 lg:pb-20">
                    <div className="grid max-w-[64ch] content-start gap-5">
                        <p className="m-0 flex items-center gap-3 text-sm font-bold text-surface/75">
                            <span aria-hidden="true" className="h-px w-8 bg-accent" />
                            Fast English
                        </p>

                        <h1 className="m-0 text-[2.2rem] leading-[1.35] font-black tracking-[-0.02em] text-balance sm:text-[3.1rem] sm:leading-[1.3] lg:text-[3.7rem] lg:leading-[1.24]">
                            تنها پادکست استاندارد یادگیری زبان انگلیسی
                        </h1>
                        <p className="m-0 text-xl leading-9 font-extrabold text-accent sm:text-2xl">هر پادکست در شش سطح استاندارد</p>

                        <p className="m-0 text-[1.0625rem] leading-9 text-pretty text-surface/80">
                            با روش منحصربه‌فرد آموزش واژگان فست انگلیش، حتی اگر سطح زبانت متوسط یا پایین‌تر باشد، می‌توانی هنگام رانندگی
                            یا در موقعیت‌هایی که به صفحهٔ موبایل نگاه نمی‌کنی، با گوش‌دادن کلمات جدید یاد بگیری.
                        </p>

                        <p className="m-0 text-[0.98rem] leading-8 text-surface/60">
                            داستان‌های انگلیسی با متن و آموزش واژگان، سخنرانی‌های TED با آموزش کلمات و ده‌ها منبع معتبر آموزشی که با کمک
                            ابزارهای هوش مصنوعی به‌صورت حرفه‌ای آموزش داده می‌شوند.
                        </p>

                        <div className="mt-1 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                            <Link href={urls.start} className={primaryOnInk}>
                                <BookOpen size={19} aria-hidden="true" />
                                {startLabel}
                            </Link>
                            <Link href={urls.support} className={secondaryOnInk}>
                                <MessageCircle size={18} aria-hidden="true" />
                                پیام به پشتیبانی
                            </Link>
                        </div>
                    </div>

                    <dl className="m-0 grid gap-px border-y border-surface/15 bg-surface/15 sm:grid-cols-3">
                        <div className="grid gap-1 bg-ink px-1 py-5 sm:px-5">
                            <dd className="order-1 m-0 text-xl leading-9 font-black tabular-nums sm:text-2xl">
                                {fa(stats.learners)}
                            </dd>
                            <dt className="order-2 text-sm leading-7 text-surface/70">نفر با این اپلیکیشن زبانشان را تقویت کرده‌اند.</dt>
                        </div>
                        <div className="grid gap-1 bg-ink px-1 py-5 sm:px-5">
                            <dd className="order-1 m-0 text-xl leading-9 font-black sm:text-2xl">هزاران ساعت</dd>
                            <dt className="order-2 text-sm leading-7 text-surface/70">پادکست و آموزش</dt>
                        </div>
                        <div className="grid gap-1 bg-ink px-1 py-5 sm:px-5">
                            <dd className="order-1 m-0 text-xl leading-9 font-black sm:text-2xl">۶ سطح استاندارد</dd>
                            <dt className="order-2 text-sm leading-7 text-surface/70">از A1 تا C2</dt>
                        </div>
                    </dl>
                </div>
            </section>

            <section aria-labelledby="landing-library" className="border-b border-line bg-canvas">
                <div className="mx-auto grid w-full max-w-[1120px] gap-7 px-4 py-14 sm:px-6 sm:py-18">
                    <div className="grid gap-3 sm:max-w-[58ch]">
                        <h2 id="landing-library" className="fe-title m-0 text-[2rem] leading-[1.4] font-black tracking-[-0.02em] text-balance">
                            کتابخانهٔ فست انگلیش
                        </h2>
                        <p className="m-0 text-[1.0625rem] leading-9 text-pretty text-muted">
                            از داستان کوتاه و آزمون‌های آیلتس تا سخنرانی TED و یونیت‌های گرامر و…
                        </p>
                    </div>

                    {podcasts.length + talks.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {podcasts.map((sample, index) => (
                                <PodcastCard key={sample.slug} sample={sample} href={urls.login} eager={index === 0} />
                            ))}
                            {talks.map((talk, index) => (
                                <TalkCard key={talk.title_en} talk={talk} href={urls.login} eager={podcasts.length + index === 0} />
                            ))}
                        </div>
                    ) : (
                        <ul aria-label="شش سطح A1 تا C2" className="m-0 grid list-none grid-cols-3 gap-px border-y border-line bg-line p-0 sm:grid-cols-6">
                            {LEVELS.map((level) => (
                                <li key={level.code} className="grid gap-1 bg-canvas px-3 py-4">
                                    <span lang="en" dir="ltr" className="font-en text-[1.6rem] leading-none font-black tracking-[-0.04em] text-ink">
                                        {level.code}
                                    </span>
                                    <span className="text-xs leading-5 text-muted">{level.label}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <p className="m-0 text-sm leading-7 text-muted">
                        برای دیدن متن، شنیدن صوت و استفاده از آموزش واژگان، وارد حساب شو و اشتراک را فعال کن.
                    </p>
                </div>
            </section>

            <section aria-labelledby="landing-levels" className="border-b border-line bg-surface">
                <div className="mx-auto grid w-full max-w-[1120px] gap-7 px-4 py-14 sm:px-6 sm:py-18">
                    <h2 id="landing-levels" className="fe-title m-0 max-w-[24ch] text-[2rem] leading-[1.4] font-black tracking-[-0.02em] text-balance">
                        زبان را در سطح استاندارد خودت یاد بگیر
                    </h2>
                    <ul aria-label="شش سطح استاندارد" className="m-0 grid list-none grid-cols-2 gap-px border-y border-line bg-line p-0 sm:grid-cols-3 lg:grid-cols-6">
                        {LEVELS.map((level) => (
                            <li key={level.code} className="grid gap-1 bg-surface px-4 py-5">
                                <span lang="en" dir="ltr" className="font-en text-[2rem] leading-none font-black tracking-[-0.04em] text-ink">
                                    {level.code}
                                </span>
                                <span className="text-xs leading-5 text-muted">{level.label}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section aria-labelledby="landing-features" className="border-b border-line bg-canvas">
                <div className="mx-auto grid w-full max-w-[1120px] gap-10 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-14">
                    <div className="grid content-start gap-6">
                        <div className="grid gap-3">
                            <h2
                                id="landing-features"
                                className="fe-title m-0 text-[2rem] leading-[1.4] font-black tracking-[-0.02em] text-balance sm:text-[2.4rem]"
                            >
                                Fast English، بهترین و استانداردترین اپلیکیشن یادگیری زبان انگلیسی
                            </h2>
                            <p className="m-0 text-[1.0625rem] leading-9 text-pretty text-muted">
                                هزاران ساعت پادکست و آموزش صوتی، همراه با کتاب، برنامهٔ روزانه، واژنامهٔ شخصی، تمرین و مرور تا یادگیری
                                را شروع کنی، ادامه بدهی و پیشرفتت را ببینی.
                            </p>
                        </div>

                        <ul className="m-0 grid list-none border-t border-line p-0">
                            {FEATURES.map((feature) => (
                                <li key={feature.title} className="flex items-start gap-3 border-b border-line py-4">
                                    <span aria-hidden="true" className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-primary">
                                        {feature.icon}
                                    </span>
                                    <span className="grid gap-1">
                                        <span className="text-[0.98rem] leading-7 font-bold text-ink">{feature.title}</span>
                                        <span className="text-sm leading-7 text-muted">{feature.body}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <article id="pricing" aria-label="اشتراک ماهیانه" className="grid scroll-mt-24 content-start gap-5 rounded-[1.75rem] border border-line bg-surface p-6 sm:p-7 lg:sticky lg:top-24">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
                            <p className="m-0 text-lg font-extrabold text-ink">اشتراک ماهیانه</p>
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">دسترسی کامل</span>
                        </div>

                        <div className="grid gap-2">
                            <p className="m-0 text-sm text-muted">قیمت قبل</p>
                            <p className="m-0 text-xl font-bold text-muted line-through decoration-2">{offer.compare_label}</p>
                            <p className="m-0 text-sm font-bold text-ink">قیمت فعلی</p>
                            <p className="m-0 text-[2.9rem] leading-[1.15] font-black tracking-[-0.02em] tabular-nums text-ink sm:text-[3.3rem]">
                                {offer.price_label}
                            </p>
                        </div>

                        <Link href={urls.start} className={`${primaryCta} w-full`}>
                            <BookOpen size={19} aria-hidden="true" />
                            {startLabel}
                        </Link>

                        <p className="m-0 text-sm leading-7 text-muted">
                            مبلغ و شمارهٔ کارت پس از ورود، در پنل کاربری نمایش داده می‌شود. تصویر رسید را همان‌جا بارگذاری می‌کنی و بعد از
                            تأیید، اشتراک فعال می‌شود.
                        </p>

                        <div className="grid gap-2 rounded-2xl border border-line bg-canvas p-4">
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-ink">
                                <Download size={16} aria-hidden="true" className="text-primary" />
                                روی گوشی هم هست.
                            </p>
                            <p className="m-0 text-sm leading-7 text-muted">
                                نسخهٔ وب را نصب کن (PWA) یا از{' '}
                                {releasePublished ? (
                                    <a href={downloadHref} download className="font-bold text-primary">
                                        فایل اندروید
                                    </a>
                                ) : (
                                    <Link href={urls.install} className="font-bold text-primary">
                                        راهنمای نصب
                                    </Link>
                                )}{' '}
                                استفاده کن.
                            </p>
                        </div>

                        <SupportBox support={support} />
                    </article>
                </div>
            </section>

            <section aria-labelledby="landing-faq" className="border-b border-line bg-surface">
                <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14">
                    <div className="grid content-start gap-4">
                        <h2 id="landing-faq" className="fe-title m-0 text-[2rem] leading-[1.4] font-black tracking-[-0.02em] text-balance">
                            پرسش‌های شما
                        </h2>
                        <p className="m-0 leading-8 text-muted">جواب چهار پرسش اصلی، کوتاه و روشن. اگر جوابت را پیدا نکردی، به پشتیبانی پیام بده.</p>
                        <Link href={urls.faq} className={`${secondaryCta} mt-1 self-start`}>
                            همهٔ پرسش‌ها
                        </Link>
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

            <section aria-label="شروع" className="bg-ink text-surface">
                <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-14">
                    <div className="grid content-start gap-4">
                        <h2 className="fe-title m-0 max-w-[20ch] text-[2.1rem] leading-[1.35] font-black tracking-[-0.02em] text-balance sm:text-[2.8rem]">
                            از همین امروز، با گوش‌دادن یاد بگیر.
                        </h2>
                        <p className="m-0 max-w-[54ch] text-[1.0625rem] leading-9 text-pretty text-surface/75">
                            یک اشتراک ماهیانه، همهٔ مسیر: پادکست‌های شش‌سطحی، داستان، آیلتس، Inside Reading، TED Talk، گرامر، واژنامه و
                            مرور.
                        </p>
                    </div>

                    <div className="grid gap-3">
                        <Link href={urls.start} className={primaryOnInk}>
                            <BookOpen size={19} aria-hidden="true" />
                            {startLabel}
                        </Link>
                        <Link href={urls.install} className={secondaryOnInk}>
                            <Smartphone size={18} aria-hidden="true" />
                            راهنمای نصب روی گوشی
                        </Link>
                    </div>
                </div>

                <div className="mx-auto w-full max-w-[1120px] px-4 pb-14 sm:px-6">
                    <div className="border-t border-surface/20 pt-6">
                        <SupportBox support={support} />
                    </div>
                </div>
            </section>
        </>
    );
};

LandingIndex.layout = publicLayout;

export default LandingIndex;
