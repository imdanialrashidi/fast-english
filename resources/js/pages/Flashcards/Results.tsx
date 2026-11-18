import { Head, Link } from '@inertiajs/react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type {
    FlashcardBookSummary,
    FlashcardCardRow,
    FlashcardCounts,
    FlashcardUnitSummary,
    SharedProps,
} from '@/types';

/**
 * The unit's two buckets. "درست گفتم" and "درست نگفتم" are the latest
 * self-report per card, so the page always agrees with the scheduler and
 * with the next session. A wrong card can be retried immediately.
 */

interface FlashcardResultsProps extends SharedProps {
    book: FlashcardBookSummary;
    unit: FlashcardUnitSummary;
    known: FlashcardCardRow[];
    unknown: FlashcardCardRow[];
    counts: FlashcardCounts;
    retry_url: string;
}

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

function CardRow({ card, tone }: { card: FlashcardCardRow; tone: 'good' | 'again' }): React.JSX.Element {
    return (
        <li
            data-flashcard-result={tone}
            className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"
        >
            <div className="min-w-0 flex-1">
                <p lang="en" dir="ltr" className="m-0 truncate font-en text-base font-bold">
                    {card.word}
                </p>
                <p dir="auto" className="m-0 truncate text-sm leading-6 text-muted">
                    {card.translation_fa}
                </p>
                {card.phonetic !== null && card.phonetic !== '' && (
                    <p lang="en" dir="ltr" className="m-0 font-en text-xs text-muted">
                        {card.phonetic}
                    </p>
                )}
            </div>
            <span
                aria-hidden="true"
                className={tone === 'good' ? 'text-success' : 'text-danger'}
            >
                {tone === 'good' ? <Check size={18} /> : <X size={18} />}
            </span>
        </li>
    );
}

export const FlashcardResultsPage: FunctionComponent<FlashcardResultsProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({
    unit,
    known,
    unknown,
    counts,
    retry_url,
}: FlashcardResultsProps): React.JSX.Element => {
    const answered = known.length + unknown.length;
    const unseen = Math.max(0, counts.total - answered);

    return (
        <>
            <Head title={`نتیجهٔ ${unit.title_en}`} />
            <ScreenHeader title="نتیجهٔ درس" back={{ href: unit.hub_url, label: 'بازگشت به یونیت' }} />

            <div className="mx-auto grid w-full max-w-[680px] gap-4 px-4 py-5">
                <header className="grid gap-1.5">
                    <p className="m-0 text-xs text-muted">یونیت {fa(unit.number)}</p>
                    <h1 lang="en" dir="ltr" className="m-0 text-2xl leading-9 font-extrabold">
                        {unit.title_en}
                    </h1>
                    <p className="m-0 text-sm leading-7 text-muted">
                        {fa(answered)} از {fa(counts.total)} کارت پاسخ داده شده
                        {unseen > 0 && ` · ${fa(unseen)} کارت بی‌پاسخ`}
                    </p>
                </header>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-success/25 bg-success/5 p-4 text-center">
                        <p className="m-0 inline-flex items-center gap-1.5 text-sm font-bold text-success">
                            <Check size={16} aria-hidden="true" />
                            درست گفتم
                        </p>
                        <p className="m-0 text-3xl font-extrabold text-success">{fa(known.length)}</p>
                    </div>
                    <div className="rounded-2xl border border-danger/25 bg-danger/5 p-4 text-center">
                        <p className="m-0 inline-flex items-center gap-1.5 text-sm font-bold text-danger">
                            <X size={16} aria-hidden="true" />
                            درست نگفتم
                        </p>
                        <p className="m-0 text-3xl font-extrabold text-danger">{fa(unknown.length)}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {unknown.length > 0 && (
                        <Link
                            href={retry_url}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                        >
                            <RotateCcw size={16} aria-hidden="true" />
                            مرور دوبارهٔ غلط‌ها
                        </Link>
                    )}
                    <Link
                        href={unit.url}
                        className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-bold text-ink no-underline hover:bg-canvas"
                    >
                        بازگشت به درس
                    </Link>
                </div>

                <section aria-label="درست گفتم" className="rounded-2xl border border-line bg-surface px-4">
                    <h2 className="m-0 py-3 text-base font-extrabold text-success">
                        درست گفتم <span className="text-muted">({fa(known.length)})</span>
                    </h2>
                    {known.length === 0 ? (
                        <p className="m-0 border-t border-line py-5 text-center text-sm text-muted">
                            هنوز کارتی در این باکت نیست.
                        </p>
                    ) : (
                        <ul className="m-0 list-none p-0">
                            {known.map((card) => (
                                <CardRow key={card.id} card={card} tone="good" />
                            ))}
                        </ul>
                    )}
                </section>

                <section aria-label="درست نگفتم" className="rounded-2xl border border-line bg-surface px-4">
                    <h2 className="m-0 py-3 text-base font-extrabold text-danger">
                        درست نگفتم <span className="text-muted">({fa(unknown.length)})</span>
                    </h2>
                    {unknown.length === 0 ? (
                        <p className="m-0 border-t border-line py-5 text-center text-sm text-muted">
                            چیزی در این باکت نیست؛ عالی بود.
                        </p>
                    ) : (
                        <ul className="m-0 list-none p-0">
                            {unknown.map((card) => (
                                <CardRow key={card.id} card={card} tone="again" />
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
};

FlashcardResultsPage.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default FlashcardResultsPage;
