import { Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen, Headphones, Mic, Sparkles } from 'lucide-react';
import type { LibraryCollection } from '@/types';

const ICONS = {
    aef: BookOpen,
    story: Sparkles,
    ielts: BookOpen,
    inside_reading: Headphones,
    ted: Mic,
} as const;

/**
 * One shelf item. The cover is a real, owner-supplied image when present;
 * the typographic panel is the honest fallback, never an invented cover.
 */
export function CollectionCard({ collection }: { collection: LibraryCollection }): React.JSX.Element {
    const Icon = ICONS[collection.key as keyof typeof ICONS] ?? BookOpen;
    const ready = collection.status === 'ready';
    const percent = collection.total === 0 ? 0 : Math.round((collection.ready / collection.total) * 100);
    const badge =
        collection.ready === 0 ? 'در حال آماده‌سازی' : collection.ready < collection.total ? 'در حال تکمیل' : 'آماده';

    return (
        <Link
            href={collection.url}
            className="fe-press group grid overflow-hidden rounded-[1.75rem] border border-line bg-surface no-underline shadow-[0_1px_2px_rgb(23_34_56_/_0.06)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            <div className="relative aspect-[16/10] overflow-hidden bg-ink">
                {collection.cover_url !== null ? (
                    <img
                        src={collection.cover_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                ) : (
                    <div className="grid h-full place-items-center bg-ink text-surface/80">
                        <Icon size={44} aria-hidden="true" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-surface sm:p-5">
                    <div className="min-w-0">
                        <p className="m-0 font-en text-[0.62rem] font-bold tracking-[0.16em] text-surface/70 uppercase">
                            {collection.title_en}
                        </p>
                        <h2 className="m-0 truncate text-xl leading-8 font-black sm:text-2xl">{collection.title_fa}</h2>
                    </div>
                    <span
                        className={`shrink-0 rounded-full px-3 py-1 text-[0.7rem] font-bold ${
                            collection.ready > 0 ? 'bg-surface/90 text-ink' : 'bg-surface/15 text-surface'
                        }`}
                    >
                        {badge}
                    </span>
                </div>
            </div>

            <div className="grid gap-3 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                    <p className="m-0 inline-flex items-center gap-1.5 text-sm font-bold text-accent-strong">
                        <Icon size={17} aria-hidden="true" />
                        {collection.subtitle_fa}
                    </p>
                    <span className="font-en text-xs font-bold text-muted" dir="ltr">
                        {collection.ready}/{collection.total}
                    </span>
                </div>
                <p className="m-0 text-sm leading-7 text-muted">{collection.description_fa}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {collection.chips.map((chip) => (
                        <span key={chip} className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[0.7rem] font-bold text-muted">
                            {chip}
                        </span>
                    ))}
                </div>
                <div className="grid gap-2">
                    <div
                        role="progressbar"
                        aria-label={`آمادگی ${collection.title_fa}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-line"
                    >
                        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-primary">
                        {ready ? 'ورود به بخش' : 'دیدن فهرست'}
                        <ArrowLeft size={16} aria-hidden="true" />
                    </span>
                </div>
            </div>
        </Link>
    );
}
