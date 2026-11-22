import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Clock, Mic, Sparkles } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { BookTabs } from '@/components/library/BookTabs';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { LibraryTab, SharedProps, TedArea, TedTalkCard } from '@/types';

interface TedIndexProps extends SharedProps {
    talks: TedTalkCard[];
    areas: TedArea[];
    active_area: string;
    total: number;
    tabs: LibraryTab[];
}

/**
 * The standalone TED shelf. Talks are articles, not podcast levels: this
 * page is the only entry point and every card opens its own talk page.
 * The area filter is a URL, so back/refresh/share keep working.
 */
export const TedIndex: FunctionComponent<TedIndexProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    talks,
    areas,
    active_area: activeArea,
    total,
    tabs,
}: TedIndexProps): React.JSX.Element => {
    return (
        <>
            <Head title="TED Talk" />
            <ScreenHeader title="TED Talk" />
            <div className="mx-auto grid w-full max-w-[1120px] gap-6 px-4 py-5 sm:gap-8">
                <header className="grid gap-3">
                    <p className="fe-meta m-0 inline-flex items-center gap-1.5 text-accent-strong">
                        <Mic size={17} aria-hidden="true" />
                        بخش مستقل · {total.toLocaleString('fa-IR')} گفتار
                    </p>
                    <h1 className="fe-title m-0 max-w-[20ch] text-3xl leading-[1.35] sm:text-[2.6rem]">
                        ایده‌های بزرگ، هر کدام یک صفحهٔ جدا.
                    </h1>
                    <p className="fe-prose m-0 text-muted">
                        هر TED Talk یک مقالهٔ مستقل با متن، ده واژهٔ کلیدی و صدای اصلی است؛ نه سطح CEFR و نه تبِ داخل
                        درس‌های پادکست. یک گفتار را انتخاب کن و از نوار صوتی پایین گوش کن.
                    </p>
                    <BookTabs tabs={tabs} />
                </header>

                <nav aria-label="موضوع‌های TED" className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-1">
                    <Link
                        href="/app/ted"
                        aria-current={activeArea === '' ? 'page' : undefined}
                        className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold no-underline transition-colors ${
                            activeArea === ''
                                ? 'border-ink bg-ink text-surface'
                                : 'border-line bg-surface text-muted hover:border-ink/30 hover:text-ink'
                        }`}
                    >
                        همه
                    </Link>
                    {areas.map((area) => (
                        <Link
                            key={area.key}
                            href={`/app/ted?area=${area.key}`}
                            aria-current={activeArea === area.key ? 'page' : undefined}
                            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold no-underline transition-colors ${
                                activeArea === area.key
                                    ? 'border-ink bg-ink text-surface'
                                    : 'border-line bg-surface text-muted hover:border-ink/30 hover:text-ink'
                            }`}
                        >
                            {area.label}
                            <span className="font-en text-[0.68rem] opacity-70">{area.count.toLocaleString('fa-IR')}</span>
                        </Link>
                    ))}
                </nav>

                {talks.length === 0 ? (
                    <section className="grid gap-2 rounded-3xl border border-line bg-surface p-6 text-center">
                        <h2 className="m-0 text-lg font-extrabold">در این موضوع گفتاری نیست</h2>
                        <p className="m-0 text-sm leading-7 text-muted">فیلتر را بردار و همهٔ گفتارها را ببین.</p>
                    </section>
                ) : (
                    <section aria-label="فهرست گفتارها" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {talks.map((talk) => (
                            <Link
                                key={talk.slug}
                                href={talk.url}
                                className="fe-press group grid overflow-hidden rounded-[1.6rem] border border-line bg-surface no-underline shadow-[0_1px_2px_rgb(23_34_56_/_0.06)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                                <div className="relative aspect-video overflow-hidden bg-ink">
                                    {talk.cover_url !== null ? (
                                        <img
                                            src={talk.cover_url}
                                            alt=""
                                            loading="lazy"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                        />
                                    ) : (
                                        <div className="grid h-full place-items-center bg-ink text-surface/80">
                                            <Mic size={38} aria-hidden="true" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                                    <span className="absolute start-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[0.68rem] font-bold text-ink">
                                        {talk.area_label}
                                    </span>
                                </div>
                                <div className="grid gap-2 p-4">
                                    <h2
                                        lang="en"
                                        dir="ltr"
                                        className="m-0 min-h-[3.4rem] text-left font-en text-[1.05rem] leading-7 font-extrabold text-balance"
                                    >
                                        {talk.title_en}
                                    </h2>
                                    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] font-bold text-muted">
                                        {talk.speaker !== '' && (
                                            <span lang="en" dir="ltr" className="font-en">
                                                {talk.speaker}
                                            </span>
                                        )}
                                        <span aria-hidden="true">·</span>
                                        <span className="inline-flex items-center gap-1">
                                            <Clock size={13} aria-hidden="true" />
                                            {talk.minutes.toLocaleString('fa-IR')} دقیقه
                                        </span>
                                    </p>
                                    <span className="inline-flex items-center gap-1 text-[0.75rem] font-bold text-primary">
                                        خواندن و شنیدن
                                        <ArrowLeft size={14} aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5" />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </section>
                )}

                <p className="m-0 inline-flex items-center gap-1.5 text-[0.7rem] text-muted">
                    <Sparkles size={13} aria-hidden="true" />
                    متن هر گفتار از کوی رسمی TED ساخته شده و صدای اصلی روی دیسک خصوصی نگه‌داری می‌شود.
                </p>
            </div>
        </>
    );
};

TedIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default TedIndex;
