import { Head } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';
import { FlashcardPlayer } from '@/components/FlashcardPlayer';
import type { FlashcardRatingOption } from '@/components/FlashcardPlayer';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import { postJson } from '@/lib/http';
import type {
    FlashcardCardRow,
    FlashcardStudyConfig,
    LessonDeckCounts,
    LessonDeckLesson,
    SharedProps,
} from '@/types';

/**
 * One lesson's vocabulary deck (owner clarification 2026-11-15): the
 * article's glossary is the deck, each card is text-first with audio, and
 * the four grades write the same `vocabulary_words` row the notebook reads.
 * Answering a card is what saves the word to the notebook; simply opening
 * the deck never adds rows.
 */

interface LessonFlashcardsProps extends SharedProps {
    lesson: LessonDeckLesson;
    cards: FlashcardCardRow[];
    counts: LessonDeckCounts;
    study: FlashcardStudyConfig;
    review_url: string;
    back_url: string;
}

const RATINGS: FlashcardRatingOption[] = [
    { value: 'again', label: 'دوباره', shortcut: '1', tone: 'again' },
    { value: 'hard', label: 'سخت', shortcut: '2', tone: 'neutral' },
    { value: 'good', label: 'خوب', shortcut: '3', tone: 'good' },
    { value: 'easy', label: 'آسان', shortcut: '4', tone: 'good' },
];

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

export const LessonFlashcardsPage: FunctionComponent<LessonFlashcardsProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ lesson, cards, counts, study, review_url }: LessonFlashcardsProps): React.JSX.Element => {
    const submitRating = async (
        card: FlashcardCardRow,
        rating: string,
    ): Promise<{ ok: boolean; message?: string }> => {
        if (card.word_key === null || card.word_key === undefined || card.word_key === '') {
            return { ok: false, message: 'این کارت کلید واژه ندارد؛ صفحه را دوباره باز کن.' };
        }

        try {
            const response = await postJson(review_url, { word_key: card.word_key, rating });
            if (response.ok) {
                return { ok: true };
            }

            const data = (await response.json().catch(() => null)) as { message?: string } | null;

            return { ok: false, message: data?.message ?? 'ثبت پاسخ ممکن نشد. دوباره تلاش کنید.' };
        } catch {
            return { ok: false, message: 'ثبت پاسخ ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.' };
        }
    };

    return (
        <>
            <Head title={`فلش‌کارت واژه‌های ${lesson.title_en}`} />
            <ScreenHeader
                title="فلش‌کارت واژه‌ها"
                back={{ href: lesson.reader_url, label: 'بازگشت به درس' }}
            />

            <div className="mx-auto grid w-full max-w-[680px] gap-3 px-4 py-4">
                <section className="grid gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-7">
                        <span className="font-bold">{fa(counts.total)} واژه</span>
                        {counts.learning > 0 && (
                            <span className="text-primary">{fa(counts.learning)} در حال یادگیری</span>
                        )}
                        {counts.known > 0 && <span className="text-success">{fa(counts.known)} بلدم</span>}
                        {counts.due > 0 && <span className="font-bold text-danger">{fa(counts.due)} موعد مرور</span>}
                    </div>
                    <p className="m-0 text-xs leading-6 text-muted">
                        هر واژه‌ای که پاسخ بدهی در دفترچهٔ «واژه‌ها» ذخیره می‌شود.
                    </p>
                </section>

                <FlashcardPlayer
                    cards={cards}
                    study={study}
                    mode="lesson"
                    title={lesson.title_en}
                    subtitle={`${lesson.topic_title} · ${lesson.level}`}
                    backHref={lesson.reader_url}
                    backLabel="بازگشت به درس"
                    ratings={RATINGS}
                    onSubmitRating={submitRating}
                    bucketLabels={{ good: 'بلدم', again: 'نیاز به مرور' }}
                    correctRatings={['good', 'easy']}
                    againRatings={['again', 'hard']}
                    startHint={`${fa(counts.total)} واژه از این درس. واژه را ببین و بشنو، معنی را بگو و بعد پاسخ را باز کن.`}
                />
            </div>
        </>
    );
};

LessonFlashcardsPage.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default LessonFlashcardsPage;
