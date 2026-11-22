import { Head, Link } from '@inertiajs/react';
import { ChevronLeft, Clock3, Layers } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { BookTabs } from '@/components/library/BookTabs';
import { LibraryCard } from '@/components/library/LibraryCard';
import { LibraryRow } from '@/components/library/LibraryRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { LibraryBreadcrumb, LibraryCard as LibraryCardData, LibraryTab, SharedProps } from '@/types';

/**
 * One generic browse level: levels, books, variants, tests, units or
 * passages. The item kind chooses a card grid or a quiet row list; an empty
 * node says it is preparing instead of inventing content.
 */

interface BrowseProps extends SharedProps {
    track: string;
    track_key: string;
    track_label: string;
    tabs: LibraryTab[];
    node: LibraryCardData;
    breadcrumbs: LibraryBreadcrumb[];
    children: LibraryCardData[];
}

const ROW_KINDS = new Set(['test', 'unit']);

export const LibraryBrowse: FunctionComponent<BrowseProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ node, breadcrumbs, children, tabs, track_label }: BrowseProps): React.JSX.Element => {
    const title = node.title_fa ?? node.title_en ?? track_label;
    const parent = [...breadcrumbs].reverse().find((crumb) => crumb.url !== null);
    const useRows = children.length > 0 && ROW_KINDS.has(children[0]?.kind ?? '');
    const showCover = node.cover_url !== null && ['book', 'variant'].includes(node.kind);

    return (
        <>
            <Head title={title} />
            <ScreenHeader
                title={title}
                back={{ href: parent?.url ?? '/app/books', label: parent?.title ?? 'بازگشت به کتاب‌ها' }}
            />
            <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-5 px-4 py-5 sm:gap-6">
                <BookTabs tabs={tabs} />

                <nav aria-label="مسیر" className="flex flex-wrap items-center gap-1 text-[0.72rem] text-muted">
                    {breadcrumbs.map((crumb, index) => (
                        <span key={`${crumb.title}-${index}`} className="inline-flex items-center gap-1">
                            {index > 0 && <ChevronLeft size={12} aria-hidden="true" />}
                            {crumb.url !== null ? (
                                <Link href={crumb.url} className="text-muted no-underline hover:text-ink hover:underline">
                                    {crumb.title}
                                </Link>
                            ) : (
                                <span className="font-bold text-ink">{crumb.title}</span>
                            )}
                        </span>
                    ))}
                </nav>

                <section
                    className={`grid gap-4 rounded-3xl border border-line bg-surface p-4 sm:items-center sm:p-5 ${
                        showCover ? 'sm:grid-cols-[150px_1fr]' : ''
                    }`}
                >
                    {showCover && (
                        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-canvas sm:aspect-[3/4]">
                            <img src={node.cover_url ?? ''} alt="" className="h-full w-full object-cover object-top" />
                        </div>
                    )}

                    <div className="grid gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="m-0 text-xl leading-8 font-extrabold sm:text-2xl">{title}</h2>
                            {node.status === 'preparing' && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2.5 py-0.5 text-[0.68rem] font-bold text-muted">
                                    <Clock3 size={12} aria-hidden="true" />
                                    در حال آماده‌سازی
                                </span>
                            )}
                        </div>
                        {node.title_en !== null && node.title_en !== title && (
                            <p lang="en" dir="ltr" className="m-0 font-en text-sm font-semibold text-muted">
                                {node.title_en}
                            </p>
                        )}
                        {node.subtitle_fa !== null && node.subtitle_fa !== '' && (
                            <p className="m-0 text-sm leading-7 text-muted">{node.subtitle_fa}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {node.chips.map((chip) => (
                                <span key={chip} className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[0.7rem] font-bold text-muted">
                                    {chip}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {children.length === 0 ? (
                    <section className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
                        <Layers size={26} aria-hidden="true" className="text-muted" />
                        <h2 className="m-0 text-lg font-extrabold">محتوای این بخش هنوز آماده نیست.</h2>
                        <p className="m-0 max-w-[46ch] text-sm leading-7 text-muted">
                            ساختار و سطح این بخش ثبت شده؛ متن، صدا و واژه‌ها بعد از بازبینی همین‌جا منتشر می‌شوند. برای
                            دیدن بخش‌های آماده به قفسه برگرد.
                        </p>
                        <Link
                            href="/app/books"
                            className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                        >
                            بازگشت به قفسه
                        </Link>
                    </section>
                ) : useRows ? (
                    <section aria-label="فهرست" className="grid gap-2">
                        {children.map((child) => (
                            <LibraryRow key={child.id} card={child} />
                        ))}
                    </section>
                ) : (
                    <section aria-label="فهرست" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                        {children.map((child) => (
                            <LibraryCard key={child.id} card={child} />
                        ))}
                    </section>
                )}
            </div>
        </>
    );
};

LibraryBrowse.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default LibraryBrowse;
