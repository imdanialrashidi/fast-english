import { Head, Link } from '@inertiajs/react';
import { RotateCcw } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { FlashcardPlayer } from '@/components/FlashcardPlayer';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type {
    FlashcardBookSummary,
    FlashcardCardRow,
    FlashcardCounts,
    FlashcardStudyConfig,
    FlashcardUnitSummary,
    SharedProps,
} from '@/types';

/**
 * One unit's flashcard session. The player is text-first with an explicit
 * answer reveal; the page supplies the unit context and the results link.
 * `?only=again` turns the player into a retry of the failed bucket.
 */

interface FlashcardUnitProps extends SharedProps {
    book: FlashcardBookSummary;
    unit: FlashcardUnitSummary;
    cards: FlashcardCardRow[];
    study: FlashcardStudyConfig;
    counts: FlashcardCounts;
    only: 'again' | null;
    review_url: string;
}

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

export const FlashcardUnitPage: FunctionComponent<FlashcardUnitProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ book, unit, cards, study, counts, only }: FlashcardUnitProps): React.JSX.Element => {
    return (
        <>
            <Head title={`یونیت ${unit.number} · ${unit.title_en}`} />
            <ScreenHeader
                title={`یونیت ${fa(unit.number)}`}
                back={{ href: unit.hub_url, label: 'بازگشت به یونیت' }}
                actions={
                    <Link
                        href={unit.results_url}
                        className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink no-underline hover:bg-canvas"
                    >
                        نتیجه
                    </Link>
                }
            />

            <div className="mx-auto grid w-full max-w-[680px] gap-3 px-4 py-4">
                {only === 'again' && (
                    <section
                        aria-label="مرور غلط‌ها"
                        className="grid gap-2 rounded-2xl border border-danger/25 bg-danger/5 p-4 sm:flex sm:items-center sm:justify-between"
                    >
                        <div className="grid gap-1">
                            <p className="m-0 inline-flex items-center gap-1.5 text-sm font-bold text-danger">
                                <RotateCcw size={16} aria-hidden="true" />
                                مرور دوبارهٔ کارت‌های «درست نگفتم»
                            </p>
                            <p className="m-0 text-xs leading-6 text-muted">
                                {fa(cards.length)} کارت در این مرور؛ بقیه در باکت «درست گفتم» هستند.
                            </p>
                        </div>
                        <Link
                            href={unit.url}
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink no-underline hover:bg-canvas"
                        >
                            شروع کامل درس
                        </Link>
                    </section>
                )}

                <FlashcardPlayer
                    key={`${unit.number}-${only ?? 'all'}`}
                    cards={cards}
                    study={study}
                    mode="unit"
                    title={unit.title_en}
                    subtitle={`${book.title_en} · یونیت ${fa(unit.number)}`}
                    backHref={unit.hub_url}
                    backLabel="بازگشت به یونیت"
                    resultsHref={unit.results_url}
                />

                {counts.total > 0 && (
                    <p className="m-0 pb-4 text-center text-xs leading-6 text-muted">
                        {fa(counts.known)} درست · {fa(counts.unknown)} غلط · {fa(counts.fresh)} کارت تازه
                    </p>
                )}
            </div>
        </>
    );
};

FlashcardUnitPage.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default FlashcardUnitPage;
