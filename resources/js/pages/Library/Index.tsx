import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Search, X } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import type { PaginationMeta, SharedProps, TopicRow } from '@/types';

/**
 * M1 library (LIB-01/02): the Discover surface. One quiet editorial row
 * per topic — cover, English title, Persian meta — never six results per
 * topic and never a dashboard of cards. Browse state (level, category,
 * query, page) lives in the URL, so reload, back/forward, and sharing
 * preserve it; the active filter always renders from the URL.
 *
 * Props are metadata only (titles, levels, minutes, covers); bodies,
 * glossaries, and audio never enter this page (S5PrivacyTest).
 */

interface CategoryOption {
    slug: string;
    name_fa: string;
}

interface LibraryProps extends SharedProps {
    topics: TopicRow[];
    pagination: PaginationMeta;
    categories: CategoryOption[];
    levels: string[];
    activeLevel: string | null;
    activeCategory: string | null;
    activeQuery: string | null;
    hasFilters: boolean;
}

function libraryHref(query: { level?: string | null; category?: string | null; q?: string | null; page?: number }): string {
    const params = new URLSearchParams();
    if (query.level !== undefined && query.level !== null && query.level !== '') {
        params.set('level', query.level);
    }
    if (query.category !== undefined && query.category !== null && query.category !== '') {
        params.set('category', query.category);
    }
    if (query.q !== undefined && query.q !== null && query.q !== '') {
        params.set('q', query.q);
    }
    if (query.page !== undefined && query.page > 1) {
        params.set('page', String(query.page));
    }
    const suffix = params.toString();
    return suffix === '' ? '/app' : `/app?${suffix}`;
}

export const LibraryIndex: FunctionComponent<LibraryProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    topics,
    pagination,
    categories,
    levels,
    activeLevel,
    activeCategory,
    activeQuery,
    hasFilters,
}: LibraryProps): React.JSX.Element => {
    const pages: number[] = [];
    for (let page = 1; page <= pagination.last_page; page += 1) {
        pages.push(page);
    }

    return (
        <>
            <Head title="کشف مطالب" />
            <div className="mx-auto grid max-w-[1024px] gap-6 px-4 py-6">
                <div>
                    <p lang="en" dir="ltr" className="m-0 font-en text-sm font-bold tracking-[0.18em] text-accent-strong uppercase">
                        Discover
                    </p>
                    <h1 className="m-0 mt-1 text-3xl leading-[1.6] font-extrabold tracking-tight">کشف مطالب</h1>
                    <p className="m-0 mt-2 text-[1.0625rem] leading-8 text-muted">
                        یک مطلب کوتاه در سطح خودت پیدا کن — هر موضوع یک‌بار، با سطح‌های موجودش.
                    </p>
                </div>

                <form
                    className="grid gap-5 rounded-3xl border border-line bg-surface p-5"
                    method="get"
                    action="/app"
                    role="search"
                    aria-label="جست‌وجو و فیلتر مطالب"
                >
                    <div className="grid gap-2">
                        <label htmlFor="filter-q" className="inline-flex items-center gap-1.5 font-bold">
                            <Search size={16} aria-hidden="true" />
                            جست‌وجو در عنوان
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                id="filter-q"
                                name="q"
                                type="search"
                                defaultValue={activeQuery ?? ''}
                                placeholder="مثلاً park"
                                autoComplete="off"
                                maxLength={120}
                                className="min-h-11 w-full min-w-0 flex-1 rounded-full border border-field bg-surface px-4 py-2 text-base text-ink placeholder:text-muted"
                            />
                            {activeLevel !== null && <input type="hidden" name="level" value={activeLevel} />}
                            {activeCategory !== null && <input type="hidden" name="category" value={activeCategory} />}
                            <button
                                type="submit"
                                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover"
                            >
                                <Search size={20} aria-hidden="true" />
                                جست‌وجو
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <p id="filter-level-label" className="m-0 font-bold">
                            سطح
                        </p>
                        <div role="group" aria-labelledby="filter-level-label" className="flex flex-wrap gap-2">
                            <Link
                                href={libraryHref({ category: activeCategory, q: activeQuery })}
                                aria-current={activeLevel === null ? 'page' : undefined}
                                className={
                                    activeLevel === null
                                        ? 'inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-4 py-2 font-bold text-surface no-underline'
                                        : 'inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-canvas px-4 py-2 text-ink no-underline hover:bg-surface'
                                }
                            >
                                همه
                            </Link>
                            {levels.map((level) => (
                                <Link
                                    key={level}
                                    href={libraryHref({ level, category: activeCategory, q: activeQuery })}
                                    aria-current={activeLevel === level ? 'page' : undefined}
                                    className={
                                        activeLevel === level
                                            ? 'inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-4 py-2 font-en font-bold text-surface no-underline'
                                            : 'inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-canvas px-4 py-2 font-en text-ink no-underline hover:bg-surface'
                                    }
                                >
                                    <span lang="en" dir="ltr">
                                        {level}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <p id="filter-category-label" className="m-0 font-bold">
                            دسته
                        </p>
                        <div role="group" aria-labelledby="filter-category-label" className="flex flex-wrap gap-2">
                            <Link
                                href={libraryHref({ level: activeLevel, q: activeQuery })}
                                aria-current={activeCategory === null ? 'page' : undefined}
                                className={
                                    activeCategory === null
                                        ? 'inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-4 py-2 font-bold text-surface no-underline'
                                        : 'inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-canvas px-4 py-2 text-ink no-underline hover:bg-surface'
                                }
                            >
                                همه دسته‌ها
                            </Link>
                            {categories.map((category) => (
                                <Link
                                    key={category.slug}
                                    href={libraryHref({ level: activeLevel, category: category.slug, q: activeQuery })}
                                    aria-current={activeCategory === category.slug ? 'page' : undefined}
                                    className={
                                        activeCategory === category.slug
                                            ? 'inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-4 py-2 font-bold text-surface no-underline'
                                            : 'inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-canvas px-4 py-2 text-ink no-underline hover:bg-surface'
                                    }
                                >
                                    {category.name_fa}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {hasFilters && (
                        <p className="m-0">
                            <Link
                                href="/app"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                            >
                                <X size={20} aria-hidden="true" />
                                پاک کردن فیلترها
                            </Link>
                        </p>
                    )}
                </form>

                <p role="status" className="m-0 text-muted">
                    {pagination.total} مطلب
                </p>

                {topics.length === 0 ? (
                    <div role="status" className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <p className="m-0 text-xl font-bold">مطلبی با این مشخصات پیدا نشد.</p>
                        <p className="m-0 leading-8 text-muted">فیلتر دیگری را امتحان کن یا از اول شروع کن.</p>
                        <p className="m-0 mt-2">
                            <Link
                                href="/app"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <X size={20} aria-hidden="true" />
                                پاک کردن فیلترها و دیدن همه مطالب
                            </Link>
                        </p>
                    </div>
                ) : (
                    <ul className="m-0 grid list-none p-0">
                        {topics.map((topic) => (
                            <li key={topic.slug} className="border-b border-line py-5 first:pt-1 last:border-b-0">
                                <article className="fe-card">
                                    <Link href={topic.reader_url} aria-label={topic.title_en} className="flex min-h-11 gap-4 text-inherit no-underline">
                                        <span className="fe-card-media relative block aspect-video w-32 shrink-0 self-start overflow-hidden rounded-2xl bg-canvas sm:w-44">
                                            {topic.cover_url !== null ? (
                                                <img src={topic.cover_url} alt="" loading="lazy" className="block h-full w-full bg-canvas object-cover" />
                                            ) : (
                                                <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-canvas">
                                                    <img src="/icons/icon-192.png" alt="" width={44} height={44} loading="lazy" className="block h-11 w-11 rounded-[11px]" />
                                                </span>
                                            )}
                                            {topic.first_level !== null && (
                                                <span aria-hidden="true" className="absolute start-2 top-2 inline-flex">
                                                    <span lang="en" dir="ltr" className="fe-chip inline-flex items-center rounded-full bg-surface px-2 py-0.5 font-en text-xs font-bold shadow">
                                                        {topic.first_level}
                                                        {topic.extra_levels > 0 ? ` · +${topic.extra_levels}` : ''}
                                                    </span>
                                                </span>
                                            )}
                                        </span>
                                        <span className="grid min-w-0 content-start gap-1 py-0.5">
                                            <h2 lang="en" dir="ltr" className="m-0 text-left font-en text-lg leading-7 font-bold">
                                                {topic.title_en}
                                            </h2>
                                            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] text-muted">
                                                <Clock size={16} aria-hidden="true" />
                                                حدود {topic.minutes} دقیقه مطالعه
                                                {topic.levels.length > 0 && (
                                                    <span>
                                                        — سطح‌ها:{' '}
                                                        <span lang="en" dir="ltr" className="font-en">
                                                            {topic.levels.join('، ')}
                                                        </span>
                                                    </span>
                                                )}
                                            </span>
                                            {topic.category_name !== null && <span className="text-sm text-muted">{topic.category_name}</span>}
                                        </span>
                                        <span aria-hidden="true" className="ms-auto inline-flex self-center text-muted">
                                            <ArrowLeft size={20} />
                                        </span>
                                    </Link>
                                </article>
                            </li>
                        ))}
                    </ul>
                )}

                {pagination.last_page > 1 && (
                    <nav aria-label="صفحه‌های مطالب" className="fe-pagination">
                        <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
                            {pagination.current_page > 1 && (
                                <li>
                                    <Link
                                        href={libraryHref({ level: activeLevel, category: activeCategory, q: activeQuery, page: pagination.current_page - 1 })}
                                        rel="prev"
                                        aria-label="صفحه قبلی"
                                        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                                    >
                                        <ChevronRight size={20} aria-hidden="true" />
                                        قبلی
                                    </Link>
                                </li>
                            )}
                            {pages.map((page) => (
                                <li key={page}>
                                    <Link
                                        href={libraryHref({ level: activeLevel, category: activeCategory, q: activeQuery, page })}
                                        aria-label={`صفحه ${page}`}
                                        aria-current={page === pagination.current_page ? 'page' : undefined}
                                        className={
                                            page === pagination.current_page
                                                ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-primary px-4 py-2 font-en font-bold text-surface no-underline'
                                                : 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface px-4 py-2 font-en text-ink no-underline hover:bg-canvas'
                                        }
                                    >
                                        <span lang="en" dir="ltr">
                                            {page}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                            {pagination.current_page < pagination.last_page && (
                                <li>
                                    <Link
                                        href={libraryHref({ level: activeLevel, category: activeCategory, q: activeQuery, page: pagination.current_page + 1 })}
                                        rel="next"
                                        aria-label="صفحه بعدی"
                                        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                                    >
                                        بعدی
                                        <ChevronLeft size={20} aria-hidden="true" />
                                    </Link>
                                </li>
                            )}
                        </ul>
                    </nav>
                )}
            </div>
        </>
    );
};

LibraryIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default LibraryIndex;
