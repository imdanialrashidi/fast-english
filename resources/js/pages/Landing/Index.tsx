import { Head, Link } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Bookmark,
    Clock,
    Compass,
    CreditCard,
    Download,
    FileText,
    Gauge,
    Headphones,
    Info,
    Languages,
    Play,
    Sparkles,
    Timer,
    User,
} from 'lucide-react';
import type { SharedProps } from '@/types';
import { publicLayout } from '@/layouts/PublicLayout';

/**
 * Landing (GET /): the bespoke marketing page for Fast English.
 *
 * Softly-inspired composition — floating pill chrome, spacious centered
 * hero, dual CTA (sample + download), live product preview, horizontal
 * topic shelf, stacked experience cards, rotated real-sentence notes,
 * calm conversion, FAQ accordion — rebuilt entirely from the twelve
 * owner-approved palette tokens (no hex literals, no dark: variant) and
 * only real checkable product data (staged sample, featured topics, DB
 * plans). Nothing invented: no counts, testimonials, ratings, or prices
 * beyond the owner-approved single-package label.
 *
 * Excluded by owner rule (DESIGN.md): grain overlay, backdrop blur,
 * giant blurred blobs, looping/floating animation. Motion is press-only
 * and dies under prefers-reduced-motion via the global stylesheet rule.
 *
 * Browser contracts preserved: fa/rtl document, «شروع با نمونه رایگان»
 * primary CTA, preview labelled «پیش‌نمایش روش یادگیری با نمونه واقعی»,
 * the three-sentence ol, sample section «نمونه واقعی» with heading
 * «یک نمونه واقعی، بدون ثبت‌نام», featured heading «تازه‌ترین مطالب»,
 * sales lanes (plan CTA «مشاهده پلن‌ها و خرید» / «در دست آماده‌سازی»),
 * «بدون اشتراک می‌توانم امتحان کنم؟», «صفحه دانلود»,
 * «مشاهده همه پرسش‌ها», 44px targets, no h-scroll.
 */
interface SampleProps {
    title_en: string;
    level: string;
    duration_seconds: number;
    cover_url: string | null;
    reader_url: string;
}

interface FeaturedTopicProps {
    title_en: string;
    url: string;
    cover_url: string | null;
    first_level: string | null;
    extra_levels: number;
    levels_fa: string;
    minutes: number;
}

interface PlanProps {
    id: number;
    name_fa: string;
    duration_days: number;
}

interface LandingProps extends SharedProps {
    sample: SampleProps | null;
    sampleSentences: string[];
    featured: FeaturedTopicProps[];
    plans: PlanProps[];
    salesOn: boolean;
    singlePackageLabel: string;
    urls: {
        sample: string;
        library: string;
        subscribe: string;
        register: string;
        download: string;
        faq: string;
    };
}

function Cover({ src, title, tall }: { src: string | null; title: string; tall?: boolean }): React.JSX.Element {
    return (
        <span className={`relative block w-full overflow-hidden ${tall ? 'aspect-[4/5]' : 'aspect-[16/10]'}`} aria-hidden="true">
            {src !== null ? (
                <img className="block h-full w-full object-cover" src={src} alt="" loading="lazy" />
            ) : (
                <span className="flex h-full w-full items-center justify-center bg-ink">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-strong font-en text-3xl font-extrabold text-surface">
                        F
                    </span>
                </span>
            )}
            <span className="sr-only">{title}</span>
        </span>
    );
}

export const LandingIndex: FunctionComponent<LandingProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    sample,
    sampleSentences,
    featured,
    plans,
    salesOn,
    singlePackageLabel,
    urls,
}: LandingProps): React.JSX.Element => {
    const minutes = sample !== null ? Math.max(1, Math.round(sample.duration_seconds / 60)) : null;
    return (
        <>
            <Head title="Fast English — انگلیسی را با داستان کوتاه و صوت هماهنگ یاد بگیر">
                <meta
                    name="description"
                    content="Fast English — متن‌های کوتاه انگلیسی در سطح A1 تا C2 با صوت همان نسخه؛ جمله‌به‌جمله بخوان و بشنو، سرعت را تنظیم کن، واژه بساز"
                />
            </Head>

            {/* 1. Hero — spacious centered Softly-style stage, flat warm paper. */}
            <section className="px-4 pt-8 sm:px-6 md:pt-12" aria-label="معرفی Fast English">
                <div className="mx-auto grid max-w-[880px] justify-items-center gap-5 text-center">
                    <p className="m-0 flex flex-wrap items-center justify-center gap-2">
                        <span className="inline-flex flex-row-reverse items-center gap-1.5 rounded-full bg-accent-strong px-3.5 py-1.5 text-[0.8125rem] font-bold text-surface">
                            <Headphones size={16} aria-hidden="true" />
                            خواندن و شنیدن هم‌زمان
                        </span>
                        <span className="inline-flex flex-row-reverse items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[0.8125rem] text-muted">
                            <Sparkles size={16} aria-hidden="true" />
                            سطح A1 تا C2
                        </span>
                    </p>
                    <h1 className="m-0 max-w-[20ch] text-4xl leading-[1.45] font-extrabold tracking-tight text-balance sm:text-5xl sm:leading-[1.35]">
                        انگلیسی را با داستان‌های کوتاه و صوت هماهنگ یاد بگیر
                    </h1>
                    <p className="m-0 max-w-[52ch] text-lg leading-9 text-muted">
                        هر مطلب یک متن انگلیسی در سطح توست با صوت همان نسخه. جمله‌به‌جمله بخوان و بشنو، سرعت را تنظیم کن، واژه بساز — هر روز فقط چند دقیقه.
                    </p>
                    <p className="m-0 flex flex-wrap items-center justify-center gap-3 pt-1">
                        <Link
                            href={urls.sample}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-accent-strong px-7 py-3.5 text-lg font-extrabold text-surface no-underline shadow-sm hover:brightness-110"
                        >
                            <Play size={22} aria-hidden="true" />
                            شروع با نمونه رایگان
                        </Link>
                        <Link
                            href={urls.download}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-6 py-3.5 text-lg font-bold text-ink no-underline shadow-sm hover:bg-canvas"
                        >
                            <Download size={22} aria-hidden="true" />
                            صفحه دانلود
                        </Link>
                    </p>
                    <p className="m-0 text-sm text-muted">نمونه بدون ثبت‌نام باز می‌شود — اول امتحان کن، بعد تصمیم بگیر.</p>
                </div>

                {/* Live staged preview of the real sample (not a mock player). */}
                <div className="mx-auto mt-8 max-w-[720px] overflow-hidden rounded-[2.5rem] border border-line bg-surface shadow-sm" aria-label="پیش‌نمایش روش یادگیری با نمونه واقعی">
                    <div className="flex items-center gap-3 border-b border-line px-5 py-4 text-start">
                        <img
                            className="h-[52px] w-[52px] shrink-0 rounded-2xl bg-canvas object-cover"
                            src={sample?.cover_url ?? '/icons/icon-192.png'}
                            alt={sample ? '' : 'Fast English'}
                            width={52}
                            height={52}
                            loading="eager"
                            fetchPriority="high"
                        />
                        <div className="min-w-0">
                            {sample ? (
                                <>
                                    <p className="m-0 truncate text-base leading-6 font-bold" lang="en" dir="ltr">
                                        {sample.title_en}
                                    </p>
                                    <p className="m-0 flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-muted">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 font-en text-xs font-bold text-surface" lang="en" dir="ltr">
                                            {sample.level}
                                        </span>
                                        خواندن هم‌گام با صوت
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="m-0 text-base leading-6 font-bold" lang="en" dir="ltr">
                                        Fast English
                                    </p>
                                    <p className="m-0 text-[0.8125rem] text-muted">نمونه عمومی به‌زودی آماده می‌شود</p>
                                </>
                            )}
                        </div>
                    </div>
                    {sampleSentences.length > 0 && (
                        <ol className="m-0 grid list-none gap-2 p-5 text-start" lang="en" dir="ltr" aria-label="سه جمله از نمونه واقعی">
                            {sampleSentences.map((line, index) => (
                                <li
                                    key={index}
                                    aria-current={index === 1 ? 'true' : 'false'}
                                    className={
                                        index === 1
                                            ? 'rounded-2xl border border-line border-s-4 border-s-accent-strong bg-canvas px-4 py-2.5 font-en text-[0.9375rem] leading-7'
                                            : 'rounded-2xl border border-transparent border-s-4 px-4 py-2.5 font-en text-[0.9375rem] leading-7 text-muted'
                                    }
                                >
                                    {line}
                                </li>
                            ))}
                        </ol>
                    )}
                    <div className="flex items-center gap-3 border-t border-line px-5 py-4">
                        <Link
                            href={urls.sample}
                            className="inline-flex h-12 w-12 min-h-11 min-w-11 items-center justify-center rounded-full bg-primary text-surface no-underline hover:bg-primary-hover"
                            aria-label={sample ? `شنیدن نمونه واقعی: ${sample.title_en}` : 'باز کردن نمونه واقعی'}
                        >
                            <Play size={22} aria-hidden="true" />
                        </Link>
                        <span aria-hidden="true" className="h-2 flex-auto overflow-hidden rounded-full bg-line">
                            <span className="block h-full w-[38%] rounded-full bg-accent-strong" />
                        </span>
                        <span dir="ltr" title="سرعت پخش از ۰٫۷۵ تا ۱٫۵ برابر قابل تنظیم است" className="rounded-full border border-line px-3 py-1.5 font-en text-[0.8125rem] tabular-nums">
                            1×
                        </span>
                    </div>
                    <p className="m-0 border-t border-line bg-canvas px-5 py-3 text-center text-sm text-muted">
                        پیش‌نمایش روش کار با متن واقعی نمونه — برای شنیدن، نمونه را باز کن.
                    </p>
                </div>

                {/* Level strip: the product's core promise in one glance. */}
                <ol className="mx-auto mt-6 grid max-w-[720px] list-none grid-cols-3 gap-2 sm:grid-cols-6" dir="ltr" aria-label="شش سطح از A1 تا C2">
                    {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => (
                        <li
                            key={level}
                            lang="en"
                            dir="ltr"
                            className={`rounded-full border px-3 py-2 text-center font-en text-sm font-bold ${
                                sample?.level === level ? 'border-accent-strong bg-accent-strong text-surface' : 'border-line bg-surface text-muted'
                            }`}
                        >
                            {level}
                            {sample?.level === level && <span className="sr-only"> (سطح نمونه فعلی)</span>}
                        </li>
                    ))}
                </ol>
            </section>

            <div className="mx-auto grid max-w-[1160px] gap-14 px-4 py-10 sm:px-6 md:py-14">
                {/* 2. Why it works — three soft promises. */}
                <section className="grid gap-6" aria-label="چرا Fast English">
                    <div className="grid mx-auto max-w-[64ch] justify-items-center gap-2 text-center">
                        <p className="m-0 flex items-center gap-2 text-sm font-bold text-accent-strong">
                            <Sparkles size={16} aria-hidden="true" />
                            چرا Fast English
                        </p>
                        <h2 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">مغزت با شنیدن هم‌زمان، سریع‌تر یاد می‌گیرد</h2>
                        <p className="m-0 text-[1.0625rem] leading-8 text-muted">
                            خواندنِ تنها، نصف ماجراست. وقتی چشم جمله را می‌بیند و گوش همان لحظه همان جمله را می‌شنود، تلفظ، ریتم و معنی با هم جا می‌افتند.
                        </p>
                    </div>
                    <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
                        {[
                            { icon: <BookOpen size={24} aria-hidden="true" />, title: 'متن کوتاه در سطح خودت', text: 'هر مطلب نسخه خودش را در هر سطح دارد؛ نه خیلی سخت که جا بزنی، نه خیلی آسان که حوصله‌ات سر برود. اگر سطحی آماده نباشد، همان پیام را می‌بینی — جایگزین پنهان نمی‌شود.' },
                            { icon: <Headphones size={24} aria-hidden="true" />, title: 'جمله‌به‌جمله با صوت واقعی', text: 'جمله در حال پخش مشخص است؛ روی هر جمله بزن تا همان بازه پخش شود. سرعت را از ۰٫۷۵ تا ۱٫۵ برابر تنظیم کن و با ریتم خودت پیش برو.' },
                            { icon: <Bookmark size={24} aria-hidden="true" />, title: 'واژه بساز، سر موعد مرور کن', text: 'واژه‌های هر درس را در دفترچه‌ات ذخیره کن؛ کارت‌ها با دوباره، سخت، خوب یا آسان زمان‌بندی می‌شوند و دقیقاً سر موعد برمی‌گردند.' },
                        ].map((card) => (
                            <li key={card.title} className="grid content-start justify-items-center gap-3 rounded-[2.5rem] border border-line bg-surface p-7 text-center shadow-sm">
                                <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-surface">
                                    {card.icon}
                                </span>
                                <h3 className="m-0 text-xl leading-8 font-extrabold">{card.title}</h3>
                                <p className="m-0 leading-8 text-muted">{card.text}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* 3. How it works — calm ritual band on deep navy. */}
                <section className="grid gap-6 overflow-hidden rounded-[2.5rem] bg-ink p-6 text-surface sm:p-10" aria-label="روش کار">
                    <div className="grid mx-auto max-w-[64ch] justify-items-center gap-2 text-center">
                        <p className="m-0 flex items-center gap-2 text-sm font-bold text-surface">
                            <Compass size={16} aria-hidden="true" />
                            روش کار
                        </p>
                        <h2 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">در سه قدم، از امروز شروع کن</h2>
                    </div>
                    <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3 md:gap-8">
                        {[
                            { n: '01', icon: <Compass size={22} aria-hidden="true" />, title: 'مطلب و سطحت را انتخاب کن', text: 'هر موضوع نسخه‌های خودش را از A1 تا C2 دارد؛ همان سطحی را بخوان که برایت مناسب است.' },
                            { n: '02', icon: <Play size={22} aria-hidden="true" />, title: 'بخوان و هم‌زمان بشنو', text: 'هر جمله با صوت همان نسخه هماهنگ است؛ روی جمله بزن تا همان‌جا پخش شود و سرعت را تنظیم کن.' },
                            { n: '03', icon: <Languages size={22} aria-hidden="true" />, title: 'واژه بساز و سر موعد مرور کن', text: 'واژه‌های هر درس در دفترچه‌ات ذخیره می‌شوند و کارت‌ها سر موعد برمی‌گردند؛ برنامه امروزت فقط از پیشرفت واقعی تو ساخته می‌شود.' },
                        ].map((step) => (
                            <li key={step.title} className="grid content-start justify-items-center gap-3 border-t-2 border-accent-strong pt-5 text-center">
                                <p className="m-0 flex items-center gap-2.5">
                                    <span aria-hidden="true" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-strong font-en text-lg font-extrabold text-surface">
                                        {step.icon}
                                    </span>
                                    <span aria-hidden="true" className="font-en text-4xl font-extrabold text-surface/20" lang="en" dir="ltr">
                                        {step.n}
                                    </span>
                                </p>
                                <h3 className="m-0 text-xl leading-8 font-extrabold">{step.title}</h3>
                                <p className="m-0 leading-8 text-surface/75">{step.text}</p>
                            </li>
                        ))}
                    </ol>
                    <p className="m-0 flex flex-wrap justify-center gap-3 pt-1">
                        <Link
                            href={urls.sample}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-accent-strong px-6 py-3 font-bold text-surface no-underline hover:brightness-110"
                        >
                            <Play size={20} aria-hidden="true" />
                            شروع با نمونه رایگان
                        </Link>
                        <Link
                            href={urls.download}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-surface/30 px-6 py-3 text-surface no-underline hover:bg-surface/10"
                        >
                            <Download size={20} aria-hidden="true" />
                            صفحه دانلود
                        </Link>
                    </p>
                </section>

                {/* 4. Real sample — the proof, staged like a magazine feature. */}
                {sample && (
                    <section className="grid gap-6 md:grid-cols-[0.95fr_1.05fr] md:items-center" aria-label="نمونه واقعی">
                        <Link
                            href={sample.reader_url}
                            className="block min-h-11 overflow-hidden rounded-[2.5rem] border border-line text-inherit no-underline shadow-sm"
                            aria-label={sample.title_en}
                        >
                            <Cover src={sample.cover_url} title={sample.title_en} tall />
                        </Link>
                        <div className="grid content-start gap-4">
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-accent-strong">
                                <BookOpen size={16} aria-hidden="true" />
                                نمونه رایگان
                            </p>
                            <h2 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">یک نمونه واقعی، بدون ثبت‌نام</h2>
                            <p className="m-0 font-en text-xl leading-8 font-bold" lang="en" dir="ltr">
                                {sample.title_en}
                            </p>
                            <p className="m-0 flex flex-wrap items-center gap-2 text-muted">
                                <span className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 font-en text-sm font-bold text-surface" lang="en" dir="ltr">
                                    {sample.level}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Timer size={16} aria-hidden="true" />
                                    حدود {minutes} دقیقه صوت هماهنگ
                                </span>
                            </p>
                            <p className="m-0 leading-8 text-muted">
                                همین حالا بازش کن: متن کامل انگلیسی، صوت همان نسخه، و واژه‌های کلیدی — دقیقاً همان چیزی که بعد از اشتراک هر روز می‌بینی.
                            </p>
                            <p className="m-0 flex flex-wrap gap-3 pt-1">
                                <Link
                                    href={sample.reader_url}
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    <Play size={20} aria-hidden="true" />
                                    خواندن و شنیدن نمونه
                                </Link>
                                <Link
                                    href={urls.download}
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-6 py-3 font-bold text-ink no-underline hover:bg-canvas"
                                >
                                    <Download size={20} aria-hidden="true" />
                                    صفحه دانلود
                                </Link>
                            </p>
                        </div>
                    </section>
                )}

                {/* 5. Fresh shelf — horizontal scroll on mobile, calm grid on desktop. */}
                {featured.length > 0 && (
                    <section className="grid gap-6" aria-label="تازه‌ترین مطالب">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="grid max-w-[64ch] gap-2">
                                <h2 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">تازه‌ترین مطالب</h2>
                                <p className="m-0 leading-8 text-muted">هر مطلب در چند سطح منتشر می‌شود؛ سطح خودت را انتخاب کن و همان نسخه را بخوان و بشنو.</p>
                            </div>
                            <Link
                                href={urls.library}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-bold text-ink no-underline hover:bg-canvas"
                            >
                                مشاهده همه مطالب
                                <ArrowLeft size={20} aria-hidden="true" />
                            </Link>
                        </div>
                        <ul className="m-0 flex list-none snap-x gap-5 overflow-x-auto p-0 pb-2 md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
                            {featured.map((topic) => (
                                <li key={topic.url} className="min-w-[288px] snap-start md:min-w-0">
                                    <article className="grid content-start overflow-hidden rounded-[2.5rem] border border-line bg-surface shadow-sm">
                                        <Link href={topic.url} className="block min-h-11 text-inherit no-underline" aria-label={topic.title_en}>
                                            <Cover src={topic.cover_url} title={topic.title_en} />
                                            <div className="grid gap-2 p-5">
                                                <p className="m-0 flex flex-wrap items-center gap-2">
                                                    {topic.first_level && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 font-en text-xs font-bold text-surface" lang="en" dir="ltr">
                                                            {topic.first_level}
                                                            {topic.extra_levels > 0 ? ` · +${topic.extra_levels}` : ''}
                                                        </span>
                                                    )}
                                                    <span className="inline-flex items-center gap-1 text-[0.8125rem] text-muted">
                                                        <Clock size={14} aria-hidden="true" />
                                                        حدود {topic.minutes} دقیقه
                                                    </span>
                                                </p>
                                                <h3 className="m-0 font-en text-lg leading-7 font-bold" lang="en" dir="ltr">
                                                    {topic.title_en}
                                                </h3>
                                                {topic.levels_fa !== '' && (
                                                    <p className="m-0 text-sm text-muted">
                                                        سطح‌ها:{' '}
                                                        <span lang="en" dir="ltr">
                                                            {topic.levels_fa}
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        </Link>
                                    </article>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* 6. Experience — three stacked product moments, real features only. */}
                <section className="grid gap-6" aria-label="تجربه یادگیری">
                    <div className="grid mx-auto max-w-[64ch] justify-items-center gap-2 text-center">
                        <p className="m-0 flex items-center gap-2 text-sm font-bold text-accent-strong">
                            <Gauge size={16} aria-hidden="true" />
                            تجربه یادگیری
                        </p>
                        <h2 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">یک محیط آرام برای خواندن و شنیدن</h2>
                        <p className="m-0 leading-8 text-muted">متن، صوت، واژه و برنامه روزانه — هر کدام سر جای خودش، بدون شلوغی.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3 md:items-start">
                        <div className="grid content-start gap-2 rounded-[2.5rem] border border-line bg-surface p-6 shadow-sm md:translate-y-6">
                            <p className="m-0 inline-flex items-center gap-1.5 font-bold">
                                <Gauge size={20} aria-hidden="true" />
                                برنامه امروز
                            </p>
                            <p className="m-0 leading-8 text-muted">هدف ۵، ۱۰ یا ۱۵ دقیقه؛ هر روز از درس‌های نیمه‌تمام، واژه‌های موعد و سطح خودت ساخته می‌شود.</p>
                        </div>
                        <div className="grid content-start gap-3 rounded-[2.5rem] bg-ink p-6 text-surface shadow-sm">
                            <p className="m-0 inline-flex items-center gap-1.5 font-bold">
                                <Play size={20} aria-hidden="true" />
                                پخش‌کننده جمله‌به‌جمله
                            </p>
                            <ol className="m-0 grid list-none gap-2 p-0" lang="en" dir="ltr" aria-label="نمای پخش‌کننده">
                                <li className="rounded-2xl bg-surface/10 px-4 py-2.5 font-en text-sm leading-7">Read the sentence…</li>
                                <li className="rounded-2xl bg-accent-strong px-4 py-2.5 font-en text-sm leading-7 text-surface">…hear the same sentence.</li>
                            </ol>
                            <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-surface/80">
                                <span className="inline-flex min-h-11 items-center rounded-full bg-surface/15 px-4">‎−۱۰ ثانیه</span>
                                <span className="inline-flex min-h-11 items-center rounded-full bg-surface/15 px-4">سرعت ۱× تا ۱٫۵×</span>
                                <span className="inline-flex min-h-11 items-center rounded-full bg-surface/15 px-4">‎+۱۰ ثانیه</span>
                            </p>
                        </div>
                        <div className="grid content-start gap-2 rounded-[2.5rem] border border-line bg-surface p-6 shadow-sm md:translate-y-12">
                            <p className="m-0 inline-flex items-center gap-1.5 font-bold">
                                <Languages size={20} aria-hidden="true" />
                                مرور واژه
                            </p>
                            <p className="m-0 leading-8 text-muted">هر کارت با دوباره، سخت، خوب یا آسان زمان‌بندی می‌شود و سر موعد برمی‌گردد.</p>
                        </div>
                    </div>
                </section>

                {/* 7. Real-sentence notes — playful tilt, zero invention. */}
                {sampleSentences.length > 0 && (
                    <section className="grid gap-6" aria-label="یادداشت‌های واقعی">
                        <div className="grid mx-auto max-w-[64ch] justify-items-center gap-2 text-center">
                            <p className="m-0 flex items-center gap-2 text-sm font-bold text-accent-strong">
                                <BookOpen size={16} aria-hidden="true" />
                                خط‌های واقعی
                            </p>
                            <h2 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">خط‌هایی که واقعاً خواهی خواند</h2>
                            <p className="m-0 leading-8 text-muted">از دل همان نمونه رایگان — بدون هیچ جمله تبلیغاتی ساختگی.</p>
                        </div>
                        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
                            {sampleSentences.slice(0, 3).map((line, index) => (
                                <li
                                    key={index}
                                    lang="en"
                                    dir="ltr"
                                    className={`grid content-start gap-3 rounded-[2rem] border border-line bg-surface p-6 text-start shadow-sm ${index % 2 === 0 ? 'md:rotate-1' : 'md:-rotate-1'}`}
                                >
                                    <p className="m-0 font-en text-[1.0625rem] leading-8">{line}</p>
                                    <p className="m-0 flex items-center gap-2 text-sm text-muted">
                                        <span aria-hidden="true" className="inline-block h-px w-8 bg-line" />
                                        <span>
                                            نمونه Fast English
                                            {sample?.level ? ` · سطح ${sample.level}` : ''}
                                        </span>
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* 8. Daily path — the habit pitch. */}
                <section className="grid gap-6 rounded-[2.5rem] border border-line bg-surface p-6 shadow-sm sm:p-10" aria-label="مسیر روزانه">
                    <div className="grid max-w-[68ch] gap-2">
                        <p className="m-0 flex items-center gap-2 text-sm font-bold text-accent-strong">
                            <Gauge size={18} aria-hidden="true" />
                            مسیر روزانه
                        </p>
                        <h2 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">مسیر روزانه‌ات از پیشرفت واقعی ساخته می‌شود</h2>
                        <p className="m-0 text-[1.0625rem] leading-8 text-muted">
                            هدف ۵، ۱۰ یا ۱۵ دقیقه را خودت انتخاب می‌کنی. برنامه هر روز از درس‌های نیمه‌تمام، واژه‌های موعد مرور و سطح خودت ساخته می‌شود — نه یک برنامه تکراری برای همه.
                        </p>
                    </div>
                    <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
                        {[
                            { icon: <BookOpen size={22} aria-hidden="true" />, title: 'ادامه درس نیمه‌تمام', text: 'از همان جمله‌ای که مانده‌ای ادامه می‌دهی؛ موقعیت ذخیره‌شده پس از ورود دوباره برمی‌گردد.' },
                            { icon: <Headphones size={22} aria-hidden="true" />, title: 'شنیدن همان نسخه', text: 'متن و صوت همیشه از یک نسخه‌اند؛ تغییر سطح، صوت قبلی را متوقف می‌کند تا چیزی قاطی نشود.' },
                            { icon: <Languages size={22} aria-hidden="true" />, title: 'مرور واژه‌های موعد', text: 'هر واژه با دوباره، سخت، خوب یا آسان زمان‌بندی می‌شود و سر موعد برمی‌گردد.' },
                            { icon: <Compass size={22} aria-hidden="true" />, title: 'درس بعدی در سطح خودت', text: 'سطح، ویژگی محتواست نه اجازه؛ همه سطح‌های منتشرشده برای مشترک فعال باز است.' },
                        ].map((row) => (
                            <li key={row.title} className="grid grid-cols-[3rem_1fr] items-start gap-3 rounded-[2rem] bg-canvas p-5">
                                <span aria-hidden="true" className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-strong text-surface">
                                    {row.icon}
                                </span>
                                <div className="grid gap-1">
                                    <h3 className="m-0 text-[1.0625rem] font-extrabold">{row.title}</h3>
                                    <p className="m-0 leading-8 text-muted">{row.text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* 9. Plans: real DB names + durations only, never amounts. */}
                <section className="grid gap-5" aria-label="پلن‌ها">
                    <div className="grid mx-auto max-w-[64ch] justify-items-center gap-2 text-center">
                        <p className="m-0 flex items-center gap-2 text-sm font-bold text-accent-strong">
                            <CreditCard size={18} aria-hidden="true" />
                            پلن‌ها
                        </p>
                        <h2 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">یک اشتراک ساده، بدون پیچیدگی</h2>
                    </div>
                    {!salesOn ? (
                        <div className="grid mx-auto w-full max-w-[720px] gap-2 rounded-[2.5rem] border border-line bg-surface p-6 text-center shadow-sm sm:p-8">
                            <p className="m-0 text-xl font-extrabold">
                                <strong>در دست آماده‌سازی</strong>
                            </p>
                            <p className="m-0 leading-8 text-muted">
                                فروش هنوز فعال نشده است. بسته واحد {singlePackageLabel} (پیشنهاد محدود) پس از اعلام رسمی قابل خرید خواهد بود؛ نمونه رایگان همیشه در دسترس است.
                            </p>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="grid gap-2 rounded-[2.5rem] border border-line bg-surface p-6 text-center shadow-sm sm:p-8">
                            <p className="m-0 leading-8 text-muted">در حال حاضر پلن فعالی وجود ندارد.</p>
                        </div>
                    ) : (
                        <>
                            <p className="m-0 flex flex-wrap items-center justify-center gap-2 text-center text-[1.0625rem] leading-8 text-muted">
                                بسته واحد {singlePackageLabel}{' '}
                                <span className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-sm font-bold text-surface">پیشنهاد محدود</span>
                            </p>
                            <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
                                {plans.map((plan) => (
                                    <li key={plan.id} className="grid content-start justify-items-center gap-2 rounded-[2.5rem] border-2 border-ink bg-surface p-6 text-center shadow-sm">
                                        <h3 className="m-0 text-xl leading-8 font-extrabold" lang="fa" dir="rtl">
                                            {plan.name_fa}
                                        </h3>
                                        <p className="m-0 flex items-center gap-1.5 text-muted">
                                            <Clock size={16} aria-hidden="true" />
                                            {plan.duration_days} روز دسترسی پس از تأیید
                                        </p>
                                        <p className="m-0 pt-1">
                                            <Link
                                                href={urls.subscribe}
                                                className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                            >
                                                مشاهده پلن‌ها و خرید
                                            </Link>
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>

                {/* 10. FAQ — calm accordion, no invented answers. */}
                <section className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]" aria-label="پرسش‌های پرتکرار">
                    <div className="grid content-start gap-2">
                        <p className="m-0 flex items-center gap-2 text-sm font-bold text-accent-strong">
                            <Info size={18} aria-hidden="true" />
                            سؤال‌های پرتکرار
                        </p>
                        <h2 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">پرسش‌های پرتکرار</h2>
                        <p className="m-0 leading-8 text-muted">جواب کوتاه سؤال‌هایی که همه اول می‌پرسند؛ بقیه را در صفحه پرسش‌ها بخوان.</p>
                        <p className="m-0 pt-1">
                            <Link
                                href={urls.faq}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-bold text-ink no-underline hover:bg-canvas"
                            >
                                مشاهده همه پرسش‌ها
                                <ArrowLeft size={20} aria-hidden="true" />
                            </Link>
                        </p>
                    </div>
                    <div className="grid content-start gap-3">
                        {[
                            { q: 'بدون اشتراک می‌توانم امتحان کنم؟', a: 'بله — نمونه واقعی همیشه رایگان است و بدون ثبت‌نام باز می‌شود.', open: true },
                            { q: 'سطح‌ها یعنی چه؟', a: 'شش سطح از A1 تا C2؛ هر مطلب نسخه خودش را در هر سطح دارد و متن و صوت همیشه از یک نسخه‌اند.', open: false },
                            { q: 'واژه‌ها چطور مرور می‌شوند؟', a: 'هر واژه‌ای که ذخیره کنی سر موعد با کارت مرور برمی‌گردد؛ دوباره، سخت، خوب یا آسان را خودت ثبت می‌کنی.', open: false },
                        ].map((item) => (
                            <details
                                key={item.q}
                                open={item.open === true ? true : undefined}
                                className="group rounded-[1.5rem] border border-line bg-surface shadow-sm"
                            >
                                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-5 font-extrabold [&::-webkit-details-marker]:hidden [&::marker]:hidden">
                                    {item.q}
                                    <span
                                        aria-hidden="true"
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-en text-lg font-bold text-surface"
                                    >
                                        +
                                    </span>
                                </summary>
                                <p className="m-0 px-5 pb-5 leading-8 text-muted">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                {/* 11. Final CTA — deep navy closer. */}
                <section className="grid gap-6 overflow-hidden rounded-[2.5rem] bg-ink p-6 text-surface sm:p-10 md:grid-cols-[1.2fr_0.8fr] md:items-center" aria-label="شروع">
                    <div className="grid content-start justify-items-center gap-3 text-center md:justify-items-start md:text-start">
                        <p className="m-0 flex items-center gap-2 text-sm font-bold text-surface">
                            <Play size={16} aria-hidden="true" />
                            شروع رایگان
                        </p>
                        <h2 className="m-0 max-w-[24ch] text-3xl leading-[1.6] font-extrabold tracking-tight text-balance">با همان نمونه رایگان شروع کن</h2>
                        <p className="m-0 max-w-[52ch] text-[1.0625rem] leading-8 text-surface/80">
                            یک داستان کوتاه در سطح خودت بخوان و بشنو؛ اگر دوست داشتی، حساب بساز و ادامه بده. اپلیکیشن را هم هر وقت خواستی نصب کن.
                        </p>
                    </div>
                    <div className="grid content-center gap-3">
                        <Link
                            href={urls.sample}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-accent-strong px-6 py-3.5 text-lg font-extrabold text-surface no-underline hover:brightness-110"
                        >
                            <Play size={22} aria-hidden="true" />
                            شروع با نمونه رایگان
                        </Link>
                        <Link
                            href={urls.register}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-surface/30 px-6 py-3 text-surface no-underline hover:bg-surface/10"
                        >
                            <User size={20} aria-hidden="true" />
                            ساخت حساب
                        </Link>
                        <Link
                            href={urls.download}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-surface/30 px-6 py-3 text-surface no-underline hover:bg-surface/10"
                        >
                            <Download size={20} aria-hidden="true" />
                            صفحه دانلود
                        </Link>
                        <p className="m-0 text-center text-sm text-surface/65">نسخه وب بدون نصب اضافه باز می‌شود.</p>
                    </div>
                </section>

                {/* 12. Install strip. */}
                <section className="flex flex-wrap items-center justify-between gap-4 rounded-[2.5rem] border border-line bg-surface px-6 py-5 shadow-sm" aria-label="نصب و دانلود">
                    <div className="grid gap-1">
                        <h2 className="m-0 flex items-center gap-2 text-xl font-extrabold">
                            <FileText size={22} aria-hidden="true" />
                            نصب و دانلود
                        </h2>
                        <p className="m-0 leading-8 text-muted">نسخه وب روی مرورگر موبایل کار می‌کند و بدون نصب اضافه باز می‌شود. فایل نصب اندروید هم از صفحه دانلود اعلام می‌شود.</p>
                    </div>
                    <p className="m-0 flex flex-wrap gap-2">
                        <Link
                            href={urls.download}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-bold text-surface no-underline hover:opacity-90"
                        >
                            <Download size={20} aria-hidden="true" />
                            صفحه دانلود
                        </Link>
                        <Link
                            href={urls.library}
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line px-5 py-2.5 font-bold text-ink no-underline hover:bg-canvas"
                        >
                            باز کردن نسخه وب
                        </Link>
                    </p>
                </section>
            </div>
        </>
    );
};

LandingIndex.layout = publicLayout;

export default LandingIndex;
