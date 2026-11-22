import { Link } from '@inertiajs/react';
import { ArrowLeft, Clock3 } from 'lucide-react';
import type { LibraryCard as LibraryCardData } from '@/types';

/** A quiet row for a test or a unit; the number leads, the state follows. */
export function LibraryRow({ card }: { card: LibraryCardData }): React.JSX.Element {
    return (
        <Link
            href={card.url ?? '#'}
            className="fe-press flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 no-underline transition-colors hover:border-ink/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-canvas font-en text-sm font-black text-ink">
                {card.kind === 'test' ? card.title_en?.replace('Test ', '') : card.title_en?.replace('Unit ', '')}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-sm font-extrabold text-ink">{card.title_fa ?? card.title_en}</span>
                <span className="truncate text-[0.7rem] leading-5 text-muted">
                    {card.status === 'preparing' ? (
                        <span className="inline-flex items-center gap-1">
                            <Clock3 size={12} aria-hidden="true" />
                            در حال آماده‌سازی
                        </span>
                    ) : (
                        card.chips.join(' · ')
                    )}
                </span>
            </span>
            <ArrowLeft size={16} className="shrink-0 text-muted" aria-hidden="true" />
        </Link>
    );
}
