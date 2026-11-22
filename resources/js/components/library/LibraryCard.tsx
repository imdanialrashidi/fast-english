import { Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, Clock3 } from 'lucide-react';
import type { LibraryCard as LibraryCardData } from '@/types';

/**
 * One browse card. A real cover when the owner delivered one; otherwise a
 * quiet typographic panel that names the item instead of an invented image.
 */
export function LibraryCard({ card }: { card: LibraryCardData }): React.JSX.Element {
    const title = card.title_fa ?? card.title_en ?? '';
    const english = card.title_en ?? '';
    const started = card.progress !== null;
    const showStatus = !['level', 'test', 'unit'].includes(card.kind);
    // A level without a CEFR badge (Inside Reading) still needs an honest
    // typographic cover. Use the level's own title, never the internal kind.
    const fallbackLabel = card.level ?? (card.kind === 'level' ? (card.title_en ?? '') : card.kind.toUpperCase());
    const fallbackSub = card.kind === 'level' ? (card.title_fa ?? '') : english;

    return (
        <Link
            href={card.url ?? '#'}
            className="fe-press group grid overflow-hidden rounded-3xl border border-line bg-surface no-underline transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            <div className="relative aspect-[3/4] overflow-hidden bg-canvas">
                {card.cover_url !== null ? (
                    <img
                        src={card.cover_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                ) : (
                    <div className="grid h-full w-full place-items-center bg-ink px-4 text-center text-surface">
                        <div className="grid gap-2">
                            <span className="font-en text-[1.65rem] leading-none font-black text-surface/90">
                                {fallbackLabel}
                            </span>
                            <span lang="en" dir="ltr" className="font-en text-xs leading-5 font-bold text-surface/70">
                                {fallbackSub || title}
                            </span>
                        </div>
                    </div>
                )}

                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
                    {showStatus && card.status === 'preparing' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink/80 px-2.5 py-1 text-[0.65rem] font-bold text-surface backdrop-blur">
                            <Clock3 size={12} aria-hidden="true" />
                            در حال آماده‌سازی
                        </span>
                    ) : showStatus && started ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-[0.65rem] font-bold text-primary">
                            <CheckCircle2 size={12} aria-hidden="true" />
                            ادامه
                        </span>
                    ) : showStatus ? (
                        <span className="inline-flex items-center rounded-full bg-surface/95 px-2.5 py-1 text-[0.65rem] font-bold text-ink">
                            آماده
                        </span>
                    ) : null}
                    {card.level !== null && card.kind !== 'level' && (
                        <span className="rounded-full bg-ink/80 px-2 py-1 font-en text-[0.65rem] font-extrabold text-surface backdrop-blur">
                            {card.level}
                        </span>
                    )}
                </div>
            </div>

            <div className="grid gap-1.5 p-3.5">
                <h3 className="m-0 line-clamp-2 text-[0.95rem] leading-6 font-extrabold text-ink">{title}</h3>
                {english !== '' && english !== title && (
                    <p lang="en" dir="ltr" className="m-0 line-clamp-1 font-en text-[0.72rem] font-semibold text-muted">
                        {english}
                    </p>
                )}
                {card.chips.length > 0 && (
                    <p className="m-0 line-clamp-2 text-[0.68rem] leading-5 text-muted">{card.chips.join(' · ')}</p>
                )}
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary">
                    {card.readable ? 'خواندن' : 'دیدن'}
                    <ArrowLeft size={14} aria-hidden="true" />
                </span>
            </div>
        </Link>
    );
}
