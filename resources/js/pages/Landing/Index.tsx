import { Head, Link } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';
import {
    ArrowLeft,
    BookOpen,
    Bookmark,
    CircleCheck,
    Clock,
    Compass,
    CreditCard,
    FileText,
    Headphones,
    Info,
    Languages,
    Play,
    User,
} from 'lucide-react';
import type { SharedProps } from '@/types';
import { publicLayout } from '@/layouts/PublicLayout';

/**
 * M0 landing page (GET /): the public introduction, ported 1:1 from the
 * Blade landing. Same gating, same real data, same Persian copy — only
 * the transport changed (Blade → Inertia props + React). Props are an
 * allowlist: no bodies, glossaries, audio URLs, amounts, or private paths.
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

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }): React.JSX.Element {
    return (
        <h2 className="flex items-center gap-2 text-xl leading-8">
            <span aria-hidden="true" className="inline-flex text-ink">
                {icon}
            </span>
            {children}
        </h2>
    );
}

function WorkflowRow({
    icon,
    title,
    text,
}: {
    icon: React.ReactNode;
    title: string;
    text: string;
}): React.JSX.Element {
    return (
        <li className="grid grid-cols-[2.5rem_1fr] items-start gap-3 px-4 py-3.5">
            <span aria-hidden="true" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface">
                {icon}
            </span>
            <div>
                <h3 className="mb-0.5 text-[1.0625rem]">{title}</h3>
                <p className="m-0 leading-8 text-muted">{text}</p>
            </div>
        </li>
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
    return (
        <>
            <Head title="Fast English — انگلیسی را با داستان کوتاه و صوت هماهنگ یاد بگیر">
                <meta
                    name="description"
                    content="Fast English — متن‌های کوتاه انگلیسی در سطح A1 تا C2 با صوت همان نسخه؛ جمله‌به‌جمله بخوان و بشنو، سرعت را تنظیم کن، واژه بساز"
                />
            </Head>
            <div className="mx-auto grid max-w-[1024px] gap-12 px-4 py-6 pb-14">
                {/* 1. Hero: promise + staged real reader. */}
                <section className="grid items-center gap-6 pt-2 md:grid-cols-[1.02fr_0.98fr] md:gap-10" aria-label="معرفی Fast English">
                    <div>
                        <p className="inline-flex items-center gap-1.5 self-start rounded-full border border-line bg-surface px-3.5 py-1.5 text-[0.8125rem] font-bold">
                            <Headphones size={16} aria-hidden="true" />
                            Fast English — خواندن و شنیدن هم‌زمان
                        </p>
                        <h1 className="m-0 mt-4 text-balance text-3xl leading-[1.55] tracking-tight md:text-[2.75rem]">
                            انگلیسی را با داستان‌های کوتاه و صوت هماهنگ یاد بگیر
                        </h1>
                        <p className="m-0 mt-3 text-[1.0625rem] leading-8 text-muted">هر مطلب یک متن انگلیسی در سطح توست با صوت همان نسخه.</p>
                        <p className="m-0 mt-4 flex flex-wrap gap-2">
                            <Link
                                href={urls.sample}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-3.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <Play size={20} aria-hidden="true" />
                                شروع با نمونه رایگان
                            </Link>
                            <Link
                                href={urls.library}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                            >
                                <Compass size={20} aria-hidden="true" />
                                دیدن مطالب
                            </Link>
                        </p>
                        <p className="m-0 mt-2 text-sm text-muted">نمونه بدون ثبت‌نام باز می‌شود.</p>
                    </div>

                    <div className="grid gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-lg" aria-label="پیش‌نمایش روش یادگیری با نمونه واقعی">
                        <div className="flex items-center gap-3">
                            <img
                                className="h-[52px] w-[52px] shrink-0 rounded-[14px] bg-canvas object-cover"
                                src={sample?.cover_url ?? '/icons/icon-192.png'}
                                alt={sample ? '' : 'Fast English'}
                                width={52}
                                height={52}
                                loading="eager"
                                fetchPriority="high"
                            />
                            <div>
                                {sample ? (
                                    <>
                                        <p className="m-0 text-base leading-6" lang="en" dir="ltr">
                                            {sample.title_en}
                                        </p>
                                        <p className="m-0 text-[0.8125rem] text-muted">
                                            سطح{' '}
                                            <span lang="en" dir="ltr">
                                                {sample.level}
                                            </span>{' '}
                                            · خواندن هم‌گام با صوت
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="m-0 text-base leading-6" lang="en" dir="ltr">
                                            Fast English
                                        </p>
                                        <p className="m-0 text-[0.8125rem] text-muted">نمونه عمومی به‌زودی آماده می‌شود</p>
                                    </>
                                )}
                            </div>
                        </div>
                        {sampleSentences.length > 0 && (
                            <ol className="m-0 grid list-none gap-1.5 p-0" lang="en" dir="ltr" aria-label="سه جمله از نمونه واقعی">
                                {sampleSentences.map((line, index) => (
                                    <li
                                        key={index}
                                        aria-current={index === 1 ? 'true' : 'false'}
                                        className={
                                            index === 1
                                                ? 'rounded-[0.625rem] border border-line border-s-4 border-s-accent bg-canvas px-2.5 py-1.5 font-en text-[0.9375rem] leading-7'
                                                : 'rounded-[0.625rem] border border-transparent border-s-4 px-2.5 py-1.5 font-en text-[0.9375rem] leading-7'
                                        }
                                    >
                                        {line}
                                    </li>
                                ))}
                            </ol>
                        )}
                        <div className="flex items-center gap-2.5">
                            <Link
                                href={urls.sample}
                                className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-primary bg-primary text-surface no-underline"
                                aria-label={sample ? `شنیدن نمونه واقعی: ${sample.title_en}` : 'باز کردن نمونه واقعی'}
                            >
                                <Play size={20} aria-hidden="true" />
                            </Link>
                            <span aria-hidden="true" className="h-1 flex-auto overflow-hidden rounded-full bg-line">
                                <span className="block h-full w-[38%] rounded-full bg-primary" />
                            </span>
                            <span dir="ltr" title="سرعت پخش از ۰٫۷۵ تا ۱٫۵ برابر قابل تنظیم است" className="whitespace-nowrap rounded-full border border-line px-2.5 py-1.5 font-en text-[0.8125rem] tabular-nums">
                                1×
                            </span>
                        </div>
                        <p className="m-0 text-sm text-muted">پیش‌نمایش روش کار با متن واقعی نمونه — برای شنیدن، نمونه را باز کن.</p>
                    </div>
                </section>

                {/* 2. How it works. */}
                <section className="grid gap-4 border-t border-line pt-8" aria-label="روش کار">
                    <SectionTitle icon={<Compass size={20} aria-hidden="true" />}>روش کار در سه قدم</SectionTitle>
                    <ol className="m-0 grid list-none p-0 [counter-reset:fe-how]">
                        {[
                            { title: 'مطلب و سطحت را انتخاب کن', text: 'هر موضوع نسخه‌های خودش را از A1 تا C2 دارد؛ همان سطحی را بخوان که برایت مناسب است.' },
                            { title: 'بخوان و هم‌زمان بشنو', text: 'هر جمله با صوت همان نسخه هماهنگ است؛ روی جمله بزن تا همان‌جا پخش شود و سرعت را از ۰٫۷۵ تا ۱٫۵ برابر تنظیم کن.' },
                            { title: 'واژه بساز و سر موعد مرور کن', text: 'واژه‌های هر درس را در دفترچه‌ات ذخیره کن؛ کارت‌ها سر موعد برمی‌گردند و برنامه امروزت فقط از پیشرفت واقعی تو ساخته می‌شود.' },
                        ].map((step, index) => (
                            <li key={step.title} className="grid grid-cols-[2.5rem_1fr] items-start gap-3 py-3.5 [counter-increment:fe-how] [&+li]:border-t [&+li]:border-line">
                                <span
                                    aria-hidden="true"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface font-en text-lg font-extrabold text-primary"
                                >
                                    {index + 1}
                                </span>
                                <div>
                                    <h3 className="m-0 mb-0.5 text-[1.0625rem]">{step.title}</h3>
                                    <p className="m-0 leading-8 text-muted">{step.text}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* 3. Real sample. */}
                {sample && (
                    <section className="grid gap-4 border-t border-line pt-8" aria-label="نمونه واقعی">
                        <SectionTitle icon={<BookOpen size={20} aria-hidden="true" />}>یک نمونه واقعی، بدون ثبت‌نام</SectionTitle>
                        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow">
                            <Link href={sample.reader_url} className="block min-h-11 text-inherit no-underline" aria-label={sample.title_en}>
                                <span className="relative block aspect-video w-full overflow-hidden bg-canvas">
                                    {sample.cover_url ? (
                                        <img className="block h-full w-full bg-canvas object-cover" src={sample.cover_url} alt="" loading="lazy" />
                                    ) : (
                                        <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-canvas">
                                            <img className="block h-14 w-14 rounded-[14px]" src="/icons/icon-192.png" alt="" width={56} height={56} loading="lazy" />
                                        </span>
                                    )}
                                </span>
                                <div className="grid gap-1 px-4 pt-3 pb-4">
                                    <h3 className="m-0 font-en text-lg leading-6 font-semibold" lang="en" dir="ltr">
                                        {sample.title_en}
                                    </h3>
                                    <p className="m-0 text-ink">
                                        سطح {sample.level} · حدود {sample.duration_seconds} ثانیه صوت
                                    </p>
                                </div>
                            </Link>
                        </div>
                    </section>
                )}

                {/* 4. Featured topics. */}
                {featured.length > 0 && (
                    <section className="grid gap-4 border-t border-line pt-8" aria-label="تازه‌ترین مطالب">
                        <SectionTitle icon={<FileText size={20} aria-hidden="true" />}>تازه‌ترین مطالب</SectionTitle>
                        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                            {featured.map((topic) => (
                                <li key={topic.url}>
                                    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow">
                                        <Link href={topic.url} className="block min-h-11 text-inherit no-underline" aria-label={topic.title_en}>
                                            <span className="relative block aspect-video w-full overflow-hidden bg-canvas">
                                                {topic.cover_url ? (
                                                    <img className="block h-full w-full bg-canvas object-cover" src={topic.cover_url} alt="" loading="lazy" />
                                                ) : (
                                                    <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-canvas">
                                                        <img className="block h-14 w-14 rounded-[14px]" src="/icons/icon-192.png" alt="" width={56} height={56} loading="lazy" />
                                                    </span>
                                                )}
                                                {topic.first_level && (
                                                    <span aria-hidden="true" className="absolute start-3 top-3 inline-flex">
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 font-en text-sm font-bold shadow" lang="en" dir="ltr">
                                                            {topic.first_level}
                                                            {topic.extra_levels > 0 ? ` · +${topic.extra_levels}` : ''}
                                                        </span>
                                                    </span>
                                                )}
                                            </span>
                                            <div className="grid gap-1 px-4 pt-3 pb-4">
                                                <h3 className="m-0 font-en text-lg leading-6 font-semibold" lang="en" dir="ltr">
                                                    {topic.title_en}
                                                </h3>
                                                <p className="m-0 inline-flex items-center gap-1.5 text-[0.9375rem] text-muted">
                                                    <Clock size={16} aria-hidden="true" />
                                                    حدود {topic.minutes} دقیقه مطالعه
                                                    {topic.levels_fa !== '' && (
                                                        <>
                                                            {' — سطح‌ها: '}
                                                            <span lang="en" dir="ltr">
                                                                {topic.levels_fa}
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </Link>
                                    </article>
                                </li>
                            ))}
                        </ul>
                        <p className="m-0 flex flex-wrap gap-2">
                            <Link
                                href={urls.library}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                            >
                                مشاهده همه مطالب
                                <ArrowLeft size={20} aria-hidden="true" />
                            </Link>
                        </p>
                    </section>
                )}

                {/* 5. Daily path. */}
                <section className="grid gap-4 border-t border-line pt-8" aria-label="مسیر روزانه">
                    <SectionTitle icon={<Clock size={20} aria-hidden="true" />}>مسیر روزانه‌ات از پیشرفت واقعی ساخته می‌شود</SectionTitle>
                    <p className="m-0 text-[1.0625rem] leading-8 text-muted">هدف ۵، ۱۰ یا ۱۵ دقیقه را خودت انتخاب می‌کنی. برنامه هر روز از درس‌های نیمه‌تمام، واژه‌های موعد مرور و سطح خودت ساخته می‌شود.</p>
                    <ul className="m-0 grid list-none divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface p-0">
                        <WorkflowRow icon={<BookOpen size={20} aria-hidden="true" />} title="ادامه درس نیمه‌تمام" text="از همان جمله‌ای که مانده‌ای ادامه می‌دهی؛ موقعیت ذخیره‌شده پس از ورود دوباره برمی‌گردد." />
                        <WorkflowRow icon={<Headphones size={20} aria-hidden="true" />} title="شنیدن همان نسخه" text="متن و صوت همیشه از یک نسخه‌اند؛ تغییر سطح، صوت قبلی را متوقف می‌کند." />
                        <WorkflowRow icon={<Languages size={20} aria-hidden="true" />} title="مرور واژه‌های موعد" text="هر واژه با دوباره، سخت، خوب یا آسان زمان‌بندی می‌شود و سر موعد برمی‌گردد." />
                        <WorkflowRow icon={<Compass size={20} aria-hidden="true" />} title="درس بعدی در سطح خودت" text="سطح، ویژگی محتواست نه اجازه؛ همه سطح‌های منتشرشده برای مشترک فعال باز است." />
                    </ul>
                </section>

                {/* 6. Benefits. */}
                <section className="grid gap-4 border-t border-line pt-8" aria-label="چرا Fast English">
                    <SectionTitle icon={<CircleCheck size={20} aria-hidden="true" />}>برای خواندن و شنیدن واقعی ساخته شده</SectionTitle>
                    <ul className="m-0 grid list-none divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface p-0">
                        <WorkflowRow icon={<FileText size={20} aria-hidden="true" />} title="متن کوتاه در سطح خودت" text="هر مطلب نسخه خودش را در هر سطح دارد؛ اگر سطحی آماده نباشد، همان پیام را می‌بینی و جایگزین پنهان نمی‌شود." />
                        <WorkflowRow icon={<Play size={20} aria-hidden="true" />} title="جمله‌به‌جمله با صوت واقعی" text="جمله در حال پخش مشخص است و با انتخاب جمله، همان بازه پخش می‌شود. اگر زمان‌بندی آماده نباشد، پخش عادی فعال است." />
                        <WorkflowRow icon={<Bookmark size={20} aria-hidden="true" />} title="ذخیره و ادامه بدون گم شدن" text="موقعیت هر نسخه جدا ذخیره می‌شود و مطلب‌های ذخیره‌شده در صفحه خودت می‌مانند." />
                    </ul>
                </section>

                {/* 7. Plans: real DB names + durations only, never amounts. */}
                <section className="grid gap-4 border-t border-line pt-8" aria-label="پلن‌ها">
                    <SectionTitle icon={<CreditCard size={20} aria-hidden="true" />}>پلن‌ها</SectionTitle>
                    {!salesOn ? (
                        <div className="grid gap-3 rounded-2xl border border-line bg-surface p-6 shadow">
                            <p className="m-0">
                                <strong>در دست آماده‌سازی</strong>
                            </p>
                            <p className="m-0 text-muted">
                                فروش هنوز فعال نشده است. بسته واحد {singlePackageLabel} (پیشنهاد محدود) پس از اعلام رسمی قابل خرید خواهد بود؛ نمونه رایگان همیشه در دسترس است.
                            </p>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="grid gap-3 rounded-2xl border border-line bg-surface p-6 shadow">
                            <p className="m-0 text-muted">در حال حاضر پلن فعالی وجود ندارد.</p>
                        </div>
                    ) : (
                        <>
                            <p className="m-0 text-[1.0625rem] leading-8 text-muted">
                                بسته واحد {singlePackageLabel}{' '}
                                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2.5 py-0.5 text-sm">پیشنهاد محدود</span>
                            </p>
                            <ul className="m-0 grid list-none gap-4 p-0">
                                {plans.map((plan) => (
                                    <li key={plan.id} className="rounded-2xl border border-line bg-surface shadow">
                                        <div className="grid gap-1 px-4 py-3">
                                            <h3 className="m-0 font-en text-lg leading-6 font-semibold" lang="fa" dir="rtl">
                                                {plan.name_fa}
                                            </h3>
                                            <p className="m-0 text-muted">{plan.duration_days} روز دسترسی پس از تأیید</p>
                                            <p className="m-0 mt-1 flex flex-wrap gap-2">
                                                <Link
                                                    href={urls.subscribe}
                                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-4 py-2 font-bold text-surface no-underline hover:bg-primary-hover"
                                                >
                                                    مشاهده پلن‌ها و خرید
                                                </Link>
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>

                {/* 8. FAQ. */}
                <section className="grid gap-4 border-t border-line pt-8" aria-label="پرسش‌های پرتکرار">
                    <SectionTitle icon={<Info size={20} aria-hidden="true" />}>پرسش‌های پرتکرار</SectionTitle>
                    <ul className="m-0 grid list-none p-0">
                        {[
                            { q: 'بدون اشتراک می‌توانم امتحان کنم؟', a: 'بله — نمونه واقعی همیشه رایگان است و بدون ثبت‌نام باز می‌شود.' },
                            { q: 'سطح‌ها یعنی چه؟', a: 'شش سطح از A1 تا C2؛ هر مطلب نسخه خودش را در هر سطح دارد و متن و صوت همیشه از یک نسخه‌اند.' },
                            { q: 'واژه‌ها چطور مرور می‌شوند؟', a: 'هر واژه‌ای که ذخیره کنی سر موعد با کارت مرور برمی‌گردد؛ دوباره، سخت، خوب یا آسان را خودت ثبت می‌کنی.' },
                        ].map((item, index) => (
                            <li key={item.q} className="grid grid-cols-[2.5rem_1fr] items-start gap-3 py-3.5 [&+li]:border-t [&+li]:border-line">
                                <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface font-en text-lg font-extrabold text-primary">
                                    {index + 1}
                                </span>
                                <div>
                                    <h3 className="m-0 mb-0.5 text-[1.0625rem]">{item.q}</h3>
                                    <p className="m-0 leading-8 text-muted">{item.a}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <p className="m-0 flex flex-wrap gap-2">
                        <Link
                            href={urls.faq}
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                        >
                            مشاهده همه پرسش‌ها
                        </Link>
                    </p>
                </section>

                {/* 9. Final CTA. */}
                <section className="grid justify-items-start gap-3 rounded-2xl border border-line bg-surface p-7 shadow-lg" aria-label="شروع">
                    <h2 className="m-0 text-balance text-[1.375rem] leading-7">با همان نمونه رایگان شروع کن</h2>
                    <p className="m-0 text-[1.0625rem] leading-8 text-muted">یک داستان کوتاه در سطح خودت بخوان و بشنو؛ اگر دوست داشتی، حساب بساز و ادامه بده.</p>
                    <p className="m-0 flex flex-wrap gap-2">
                        <Link
                            href={urls.sample}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-surface no-underline hover:bg-primary-hover"
                        >
                            <Play size={20} aria-hidden="true" />
                            شروع با نمونه رایگان
                        </Link>
                        <Link
                            href={urls.register}
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                        >
                            <User size={20} aria-hidden="true" />
                            ساخت حساب
                        </Link>
                    </p>
                </section>

                {/* 10. Install. */}
                <section className="grid gap-4 border-t border-line pt-8" aria-label="نصب و دانلود">
                    <SectionTitle icon={<FileText size={20} aria-hidden="true" />}>نصب و دانلود</SectionTitle>
                    <p className="m-0 text-[1.0625rem] leading-8 text-muted">نسخه وب روی مرورگر موبایل کار می‌کند و بدون نصب اضافه باز می‌شود. فایل نصب اندروید هم از صفحه دانلود اعلام می‌شود.</p>
                    <p className="m-0 flex flex-wrap gap-2">
                        <Link
                            href={urls.download}
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                        >
                            صفحه دانلود
                        </Link>
                        <Link
                            href={urls.library}
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
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
