import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { JSX } from 'react';
import type { PaginationMeta } from '@/types';

/**
 * One paginator for Discover, Saved, and Words.
 *
 * Numbered pages stay the default (small catalogue, URL/back/share all
 * work), but mobile gets a compact «صفحه ۲ از ۵» line so twelve 44px
 * circles never wrap into a second row. Page numbers are Persian like the
 * rest of the chrome; the previous/next arrows follow RTL reading order.
 *
 * After a successful visit the results region is focused and scrolled to,
 * so a page change is announced and the learner lands on the new rows
 * instead of the top of the document.
 */
function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

function pageWindow(current: number, last: number): Array<number | '…'> {
    if (last <= 7) {
        return Array.from({ length: last }, (_, index) => index + 1);
    }

    const pages: Array<number | '…'> = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(last - 1, current + 1);

    if (start > 2) {
        pages.push('…');
    }
    for (let page = start; page <= end; page += 1) {
        pages.push(page);
    }
    if (end < last - 1) {
        pages.push('…');
    }
    pages.push(last);

    return pages;
}

export function Pagination({
    pagination,
    hrefFor,
    label,
    resultsId,
}: {
    pagination: PaginationMeta;
    hrefFor: (page: number) => string;
    label: string;
    /** Focus/scroll this element after a successful page visit. */
    resultsId?: string;
}): JSX.Element | null {
    const { current_page: current, last_page: last } = pagination;

    if (last <= 1) {
        return null;
    }

    const moveToResults = (): void => {
        if (resultsId === undefined) {
            return;
        }
        const target = document.getElementById(resultsId);
        if (target === null) {
            return;
        }
        target.scrollIntoView({ block: 'start' });
        target.focus({ preventScroll: true });
    };

    const pages = pageWindow(current, last);

    return (
        <nav aria-label={label} className="fe-pagination grid gap-2 border-t border-line pt-4">
            <p role="status" aria-live="polite" className="m-0 text-center text-sm text-muted">
                صفحه {fa(current)} از {fa(last)}
            </p>
            <ul className="m-0 flex list-none items-center justify-center gap-2 p-0">
                {current > 1 ? (
                    <li>
                        <Link
                            href={hrefFor(current - 1)}
                            rel="prev"
                            aria-label="صفحه قبلی"
                            preserveScroll
                            onSuccess={moveToResults}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-line bg-surface px-3 py-2 text-ink no-underline transition-colors duration-150 hover:bg-canvas"
                        >
                            <ChevronRight size={20} aria-hidden="true" />
                            <span className="hidden sm:inline">قبلی</span>
                        </Link>
                    </li>
                ) : (
                    <li aria-hidden="true" className="w-11" />
                )}

                <li className="hidden items-center gap-2 sm:flex">
                    {pages.map((page, index) =>
                        page === '…' ? (
                            <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted">
                                …
                            </span>
                        ) : (
                            <Link
                                key={page}
                                href={hrefFor(page)}
                                aria-label={`صفحه ${fa(page)}`}
                                aria-current={page === current ? 'page' : undefined}
                                preserveScroll
                                onSuccess={moveToResults}
                                className={
                                    page === current
                                        ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-primary px-4 py-2 font-bold text-surface no-underline'
                                        : 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline transition-colors duration-150 hover:bg-canvas'
                                }
                            >
                                {fa(page)}
                            </Link>
                        ),
                    )}
                </li>

                {current < last ? (
                    <li>
                        <Link
                            href={hrefFor(current + 1)}
                            rel="next"
                            aria-label="صفحه بعدی"
                            preserveScroll
                            onSuccess={moveToResults}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-line bg-surface px-3 py-2 text-ink no-underline transition-colors duration-150 hover:bg-canvas"
                        >
                            <span className="hidden sm:inline">بعدی</span>
                            <ChevronLeft size={20} aria-hidden="true" />
                        </Link>
                    </li>
                ) : (
                    <li aria-hidden="true" className="w-11" />
                )}
            </ul>
        </nav>
    );
}
