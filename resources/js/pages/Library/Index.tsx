import { Head, Link, router } from '@inertiajs/react';
import { Clock, Search, SlidersHorizontal, X } from 'lucide-react';
import * as React from 'react';
import type { FormEvent, FunctionComponent, ReactNode } from 'react';
import { Pagination } from '@/components/Pagination';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { PaginationMeta, SharedProps, TopicRow } from '@/types';

/**
 * M1 library (LIB-01/02): the Discover surface. One quiet editorial row
 * per topic — cover, English title, Persian meta — never six results per
 * topic and never a dashboard of cards. Browse state (level, category,
 * query, page) lives in the URL, so reload, back/forward, and sharing
 * preserve it; the active filter always renders from the URL.
 *
 * The filter card is gone: a sticky search row stays at hand, the screen
 * header opens a bottom sheet for level/category, and active filters read
 * as removable chips so the first result sits above the fold.
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

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
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
    const dialogRef = React.useRef<HTMLDialogElement | null>(null);
    const [filtersOpen, setFiltersOpen] = React.useState(false);
    const [selectedLevel, setSelectedLevel] = React.useState<string | null>(activeLevel);
    const [selectedCategory, setSelectedCategory] = React.useState<string | null>(activeCategory);

    const activeFilterCount =
        (activeLevel !== null ? 1 : 0) + (activeCategory !== null ? 1 : 0) + (activeQuery !== null ? 1 : 0);

    const focusResults = (): void => {
        window.requestAnimationFrame(() => {
            const target = document.getElementById('library-results');
            target?.scrollIntoView({ block: 'start' });
            target?.focus({ preventScroll: true });
        });
    };

    // Native dialog: focus trap + Escape are browser-provided. Lock the
    // page scroll only while the sheet is open.
    React.useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null) {
            return;
        }
        if (filtersOpen) {
            if (!dialog.open) {
                dialog.showModal();
            }
            document.body.style.overflow = 'hidden';
        } else {
            if (dialog.open) {
                dialog.close();
            }
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [filtersOpen]);

    const openFilters = (): void => {
        setSelectedLevel(activeLevel);
        setSelectedCategory(activeCategory);
        setFiltersOpen(true);
    };

    const applyFilters = (): void => {
        setFiltersOpen(false);
        router.get(
            libraryHref({ level: selectedLevel, category: selectedCategory, q: activeQuery }),
            {},
            { preserveScroll: true, preserveState: true, onSuccess: focusResults },
        );
    };

    const clearFilters = (): void => {
        setFiltersOpen(false);
        router.get('/app', {}, { preserveScroll: true, preserveState: true, onSuccess: focusResults });
    };

    const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const q = String(data.get('q') ?? '').trim();
        // A native GET would reload the document and stop the persistent
        // player; router.get keeps the SPA and the audio element alive.
        router.get(
            libraryHref({ level: activeLevel, category: activeCategory, q }),
            {},
            { preserveState: true, preserveScroll: true, onSuccess: focusResults },
        );
    };

    const selectedCategoryName = categories.find((category) => category.slug === activeCategory)?.name_fa ?? activeCategory;

    return (
        <>
            <Head title="کشف مطالب" />
            <ScreenHeader
                title="کشف مطالب"
                actions={
                    <button
                        type="button"
                        onClick={openFilters}
                        aria-label={activeFilterCount > 0 ? `فیلترها، ${fa(activeFilterCount)} فعال` : 'فیلترها'}
                        aria-haspopup="dialog"
                        aria-expanded={filtersOpen}
                        className="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-surface"
                    >
                        <SlidersHorizontal size={20} aria-hidden="true" />
                        {activeFilterCount > 0 && (
                            <span
                                aria-hidden="true"
                                className="absolute -top-0.5 -end-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[0.6875rem] font-bold text-surface"
                            >
                                {fa(activeFilterCount)}
                            </span>
                        )}
                    </button>
                }
            />

            {/* Sticky search: the one control that stays while scanning. */}
            <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-line bg-canvas">
                <div className="mx-auto w-full max-w-[1024px] px-4 py-2">
                    <form onSubmit={submitSearch} role="search" aria-label="جست‌وجوی مطالب" className="flex items-center gap-2">
                        <label htmlFor="filter-q" className="sr-only">
                            جست‌وجو در عنوان
                        </label>
                        <input
                            key={activeQuery ?? ''}
                            id="filter-q"
                            name="q"
                            type="search"
                            defaultValue={activeQuery ?? ''}
                            placeholder="جست‌وجو در عنوان انگلیسی"
                            autoComplete="off"
                            maxLength={120}
                            className="min-h-11 w-full min-w-0 flex-1 rounded-full border border-field bg-surface px-4 py-2 text-base text-ink placeholder:text-muted"
                        />
                        <button
                            type="submit"
                            aria-label="جست‌وجو"
                            className="inline-flex h-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover"
                        >
                            <Search size={18} aria-hidden="true" />
                            <span className="hidden text-sm sm:inline">جست‌وجو</span>
                        </button>
                    </form>
                </div>
            </div>

            <div className="mx-auto grid max-w-[1024px] gap-3 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p role="status" aria-live="polite" data-total={pagination.total} className="m-0 text-sm text-muted">
                        {fa(pagination.total)} مطلب
                    </p>
                    {hasFilters && (
                        <Link
                            href="/app"
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-sm font-bold text-muted no-underline hover:text-ink"
                        >
                            <X size={16} aria-hidden="true" />
                            پاک کردن فیلترها
                        </Link>
                    )}
                </div>

                {hasFilters && (
                    <div className="flex flex-wrap gap-2" aria-label="فیلترهای فعال">
                        {activeLevel !== null && (
                            <Link
                                href={libraryHref({ category: activeCategory, q: activeQuery })}
                                aria-label={`حذف فیلتر سطح ${activeLevel}`}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm no-underline hover:bg-canvas"
                            >
                                سطح <span lang="en" dir="ltr" className="font-en font-bold">{activeLevel}</span>
                                <X size={14} aria-hidden="true" />
                            </Link>
                        )}
                        {activeCategory !== null && (
                            <Link
                                href={libraryHref({ level: activeLevel, q: activeQuery })}
                                aria-label={`حذف فیلتر دسته ${selectedCategoryName ?? activeCategory}`}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm no-underline hover:bg-canvas"
                            >
                                {selectedCategoryName}
                                <X size={14} aria-hidden="true" />
                            </Link>
                        )}
                        {activeQuery !== null && (
                            <Link
                                href={libraryHref({ level: activeLevel, category: activeCategory })}
                                aria-label="حذف فیلتر جست‌وجو"
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm no-underline hover:bg-canvas"
                            >
                                «{activeQuery}»
                                <X size={14} aria-hidden="true" />
                            </Link>
                        )}
                    </div>
                )}

                <section
                    id="library-results"
                    tabIndex={-1}
                    aria-label="نتایج مطالب"
                    className="scroll-mt-32 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
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
                        <ul className="m-0 grid list-none p-0 md:grid-cols-2 md:gap-x-6 md:[&>li:nth-last-child(-n+2)]:border-b-0">
                            {topics.map((topic) => (
                                <li key={topic.slug} className="border-b border-line last:border-b-0">
                                    <article className="fe-card">
                                        <Link
                                            href={topic.reader_url}
                                            aria-label={topic.title_en}
                                            className="flex min-h-11 items-center gap-3 py-3.5 text-inherit no-underline sm:gap-4"
                                        >
                                            <span className="fe-card-media relative block aspect-video w-24 shrink-0 overflow-hidden rounded-xl bg-canvas sm:w-32">
                                                {topic.cover_url !== null ? (
                                                    <img
                                                        src={topic.cover_url}
                                                        alt=""
                                                        loading="lazy"
                                                        className="block h-full w-full bg-canvas object-cover"
                                                    />
                                                ) : (
                                                    <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-canvas">
                                                        <img
                                                            src="/icons/icon-192.png"
                                                            alt=""
                                                            width={36}
                                                            height={36}
                                                            loading="lazy"
                                                            className="block h-9 w-9 rounded-[9px]"
                                                        />
                                                    </span>
                                                )}
                                            </span>
                                            <span className="grid min-w-0 flex-1 content-start gap-1">
                                                <h2
                                                    lang="en"
                                                    dir="ltr"
                                                    className="m-0 line-clamp-2 text-right font-en text-[1.0625rem] leading-7 font-bold sm:text-lg"
                                                >
                                                    {topic.title_en}
                                                </h2>
                                                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
                                                    <Clock size={14} aria-hidden="true" />
                                                    {fa(topic.minutes)} دقیقه
                                                    {topic.levels.length > 0 && (
                                                        <span>
                                                            · <span lang="en" dir="ltr" className="font-en">{topic.levels.join('، ')}</span>
                                                        </span>
                                                    )}
                                                    {topic.category_name !== null && <span>· {topic.category_name}</span>}
                                                </span>
                                            </span>
                                        </Link>
                                    </article>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <Pagination
                    pagination={pagination}
                    hrefFor={(page) => libraryHref({ level: activeLevel, category: activeCategory, q: activeQuery, page })}
                    label="صفحه‌های مطالب"
                    resultsId="library-results"
                />
            </div>

            <dialog
                ref={dialogRef}
                aria-labelledby="library-filter-title"
                onClose={() => setFiltersOpen(false)}
                onClick={(event) => {
                    if (event.target === dialogRef.current) {
                        setFiltersOpen(false);
                    }
                }}
                className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-0 bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 sm:bottom-6 sm:rounded-3xl"
            >
                <div className="grid gap-5 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                    <div className="flex items-center justify-between gap-3">
                        <h2 id="library-filter-title" className="m-0 text-xl font-extrabold">
                            فیلترها
                        </h2>
                        <button
                            type="button"
                            onClick={() => setFiltersOpen(false)}
                            aria-label="بستن فیلترها"
                            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                        >
                            <X size={22} aria-hidden="true" />
                        </button>
                    </div>

                    <div role="group" aria-label="سطح" className="grid gap-2">
                        <p className="m-0 text-sm font-bold text-muted">سطح</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedLevel(null)}
                                aria-pressed={selectedLevel === null}
                                className={
                                    selectedLevel === null
                                        ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-primary bg-primary/10 px-4 py-2 font-bold text-primary'
                                        : 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-canvas px-4 py-2 text-ink hover:bg-surface'
                                }
                            >
                                همه
                            </button>
                            {levels.map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => setSelectedLevel(level)}
                                    aria-pressed={selectedLevel === level}
                                    className={
                                        selectedLevel === level
                                            ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-primary bg-primary/10 px-4 py-2 font-en font-bold text-primary'
                                            : 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-canvas px-4 py-2 font-en text-ink hover:bg-surface'
                                    }
                                >
                                    <span lang="en" dir="ltr">
                                        {level}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div role="group" aria-label="دسته" className="grid gap-2 border-t border-line pt-4">
                        <p className="m-0 text-sm font-bold text-muted">دسته</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory(null)}
                                aria-pressed={selectedCategory === null}
                                className={
                                    selectedCategory === null
                                        ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-primary bg-primary/10 px-4 py-2 font-bold text-primary'
                                        : 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-canvas px-4 py-2 text-ink hover:bg-surface'
                                }
                            >
                                همه دسته‌ها
                            </button>
                            {categories.map((category) => (
                                <button
                                    key={category.slug}
                                    type="button"
                                    onClick={() => setSelectedCategory(category.slug)}
                                    aria-pressed={selectedCategory === category.slug}
                                    className={
                                        selectedCategory === category.slug
                                            ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-primary bg-primary/10 px-4 py-2 font-bold text-primary'
                                            : 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-canvas px-4 py-2 text-ink hover:bg-surface'
                                    }
                                >
                                    {category.name_fa}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                        <button
                            type="button"
                            onClick={applyFilters}
                            className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full bg-primary px-5 py-2 font-bold text-surface hover:bg-primary-hover"
                        >
                            اعمال فیلترها
                        </button>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 py-2 text-sm font-bold text-muted hover:bg-canvas hover:text-ink"
                        >
                            پاک کردن فیلترها
                        </button>
                    </div>
                </div>
            </dialog>
        </>
    );
};

LibraryIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default LibraryIndex;
