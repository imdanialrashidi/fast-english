import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CalendarClock, Check, Layers, X } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type {
    FlashcardBookRow,
    FlashcardReviewSummary,
    FlashcardUnitRow,
    SharedProps,
} from '@/types';

/**
 * One book's unit list. Units are quiet rows, not a card wall: the learner
 * opens a unit, works through its picture prompts, and can inspect the
 * latest "درست گفتم / درست نگفتم" bucket for that unit.
 */

interface FlashcardBookProps extends SharedProps {
    book: FlashcardBookRow;
    units: FlashcardUnitRow[];
    review: FlashcardReviewSummary;
}

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

function percent(done: number, total: number): number {
    return total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
}

function formatDue(iso: string | null): string {
    if (iso === null || iso === '') {
        return '—';
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export const FlashcardBookPage: FunctionComponent<FlashcardBookProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ book, units, review }: FlashcardBookProps): React.JSX.Element => {
    const seen = book.known_count + book.unknown_count;
    const progress = percent(seen, book.cards_count);

    return (
        <>
            <Head title={book.title_en} />
            <ScreenHeader
                title={book.title_fa ?? book.title_en}
                back={{ href: '/app/books', label: 'بازگشت به کتاب‌ها' }}
            />
            <div className="mx-auto grid w-full max-w-[900px] gap-5 px-4 py-5">
                <section className="grid gap-4 rounded-3xl border border-line bg-surface p-4 sm:grid-cols-[200px_1fr] sm:items-center sm:p-5">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-canvas">
                        {book.cover_url !== null ? (
                            <img
                                src={book.cover_url}
                                alt=""
                                width={1200}
                                height={900}
                                loading="eager"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="flex h-full w-full items-center justify-center text-muted">
                                <Layers size={32} aria-hidden="true" />
                            </span>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 lang="en" dir="ltr" className="m-0 text-xl leading-8 font-extrabold sm:text-2xl">
                                {book.title_en}
                            </h1>
                            {book.level !== null && (
                                <span
                                    lang="en"
                                    dir="ltr"
                                    className="inline-flex items-center rounded-full border border-line bg-canvas px-2.5 py-0.5 font-en text-xs font-bold"
                                >
                                    {book.level}
                                </span>
                            )}
                        </div>
                        <p className="m-0 text-sm leading-7 text-muted">
                            {fa(book.units_count)} یونیت · {fa(book.cards_count)} کارت · {fa(seen)} کارت دیده‌شده
                        </p>
                        <div
                            role="progressbar"
                            aria-label="پیشرفت کتاب"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                            className="h-1.5 w-full overflow-hidden rounded-full bg-line"
                        >
                            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <p className="m-0 inline-flex items-center gap-3 text-sm">
                                <span className="inline-flex items-center gap-1 text-success">
                                    <Check size={16} aria-hidden="true" />
                                    {fa(book.known_count)} درست
                                </span>
                                <span className="inline-flex items-center gap-1 text-danger">
                                    <X size={16} aria-hidden="true" />
                                    {fa(book.unknown_count)} غلط
                                </span>
                            </p>
                            <Link
                                href="/app/flashcards/review"
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <CalendarClock size={16} aria-hidden="true" />
                                مرور امروز
                                {review.due > 0 && ` (${fa(review.due)})`}
                            </Link>
                        </div>
                        {review.next_due_at !== null && review.due === 0 && (
                            <p className="m-0 text-xs leading-6 text-muted">
                                موعد بعدی: {formatDue(review.next_due_at)}
                            </p>
                        )}
                    </div>
                </section>

                <section aria-label="یونیت‌ها" className="grid gap-2">
                    <div className="flex items-end justify-between gap-2">
                        <h2 className="m-0 text-lg font-extrabold">یونیت‌ها</h2>
                        <p className="m-0 text-xs text-muted">هر یونیت یک جلسهٔ کوتاه است.</p>
                    </div>

                    <ul className="m-0 grid list-none gap-2 p-0">
                        {units.map((unit) => {
                            const unitSeen = unit.known_count + unit.unknown_count;
                            const unitProgress = percent(unitSeen, unit.cards_count);

                            return (
                                <li
                                    key={unit.number}
                                    data-flashcard-unit={unit.number}
                                    className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                                                یونیت {fa(unit.number)}
                                            </span>
                                            <h3 lang="en" dir="ltr" className="m-0 truncate text-base font-extrabold">
                                                {unit.title_en}
                                            </h3>
                                        </div>
                                        {unit.subtitle !== null && unit.subtitle !== '' && (
                                            <p className="m-0 mt-1 text-sm leading-6 text-muted">{unit.subtitle}</p>
                                        )}
                                        <div className="mt-2 flex items-center gap-3">
                                            <div
                                                role="progressbar"
                                                aria-label={`پیشرفت یونیت ${unit.number}`}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                                aria-valuenow={unitProgress}
                                                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-line"
                                            >
                                                <div
                                                    className="h-full rounded-full bg-primary"
                                                    style={{ width: `${unitProgress}%` }}
                                                />
                                            </div>
                                            <p className="m-0 shrink-0 text-xs text-muted">
                                                {fa(unitSeen)} از {fa(unit.cards_count)}
                                            </p>
                                        </div>
                                        {unit.exercise !== null && (
                                            <p className="m-0 mt-1 text-xs leading-6 text-muted" data-unit-exercise-status>
                                                تمرین:{' '}
                                                {unit.exercise.questions > 0
                                                    ? `${fa(Math.round((unit.exercise.answered / unit.exercise.questions) * 100))}٪ · ${fa(unit.exercise.answered)} از ${fa(unit.exercise.questions)} سؤال`
                                                    : `${fa(unit.exercise.questions)} سؤال آماده`}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                        <Link
                                            href={unit.hub_url}
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                                        >
                                            {unitSeen > 0 ? 'ادامه' : 'شروع'}
                                            <ArrowLeft size={16} aria-hidden="true" />
                                        </Link>
                                        <Link
                                            href={unit.results_url}
                                            className="inline-flex min-h-11 items-center rounded-full border border-line bg-canvas px-4 py-2 text-sm font-bold text-ink no-underline hover:bg-surface"
                                        >
                                            نتیجه
                                        </Link>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {units.length === 0 && (
                        <p className="m-0 rounded-2xl border border-line bg-surface px-4 py-8 text-center text-muted">
                            این کتاب هنوز یونیتی ندارد.
                        </p>
                    )}
                </section>
            </div>
        </>
    );
};

FlashcardBookPage.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default FlashcardBookPage;
