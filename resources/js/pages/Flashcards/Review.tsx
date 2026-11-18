import { Head } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';
import { FlashcardPlayer } from '@/components/FlashcardPlayer';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { FlashcardCardRow, FlashcardStudyConfig, SharedProps } from '@/types';

/**
 * The daily review queue. Cards are due learning/relearning first, then due
 * reviews; the player is the same component as a unit session, but there is
 * no book results link and the end screen is a session summary.
 */

interface FlashcardReviewPageProps extends SharedProps {
    cards: FlashcardCardRow[];
    study: FlashcardStudyConfig;
    counts: {
        due_total: number;
        returned: number;
        reviewed_today: number;
    };
    next_due_at: string | null;
    books_url: string;
}

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

export const FlashcardReviewPage: FunctionComponent<FlashcardReviewPageProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ cards, study, counts, next_due_at, books_url }: FlashcardReviewPageProps): React.JSX.Element => {
    const remaining = Math.max(0, counts.due_total - counts.returned);

    return (
        <>
            <Head title="مرور امروز" />
            <ScreenHeader title="مرور امروز" back={{ href: books_url, label: 'بازگشت به کتاب‌ها' }} />

            <div className="mx-auto grid w-full max-w-[680px] gap-3 px-4 py-4">
                {remaining > 0 && (
                    <p className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-center text-xs leading-6 text-muted">
                        {fa(counts.due_total)} کارت موعد دارد؛ {fa(counts.returned)} کارت در این نوبت است و{' '}
                        {fa(remaining)} کارت دیگر بعد از این نوبت می‌آید.
                    </p>
                )}

                <FlashcardPlayer
                    cards={cards}
                    study={study}
                    mode="review"
                    title="مرور امروز"
                    subtitle={
                        counts.returned > 0
                            ? `${fa(counts.returned)} کارت از کتاب‌ها`
                            : null
                    }
                    backHref={books_url}
                    backLabel="بازگشت به کتاب‌ها"
                    reviewedToday={counts.reviewed_today}
                    nextDueAt={next_due_at}
                />
            </div>
        </>
    );
};

FlashcardReviewPage.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default FlashcardReviewPage;
