import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CalendarClock, Check, Layers, Sparkles, X } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type {
    FlashcardBookRow,
    FlashcardCounts,
    FlashcardReviewSummary,
    SharedProps,
} from '@/types';

/**
 * Flashcard bookshelf: the adult AEF decks in Fast English. One card per
 * book with real progress (known / not known / due) and one clear action.
 * The daily review is the first thing on the page when something is due.
 */

interface FlashcardsIndexProps extends SharedProps {
    books: FlashcardBookRow[];
    totals: FlashcardCounts;
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

    return new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function BookCard({ book }: { book: FlashcardBookRow }): React.JSX.Element {
    const seen = book.known_count + book.unknown_count;
    const progress = percent(seen, book.cards_count);

    return (
        <article className="grid overflow-hidden rounded-3xl border border-line bg-surface">
            <Link href={book.url} className="block no-underline">
                <div className="relative aspect-[4/3] w-full bg-canvas">
                    {book.cover_url !== null ? (
                        <img
                            src={book.cover_url}
                            alt=""
                            width={1200}
                            height={900}
                            loading="lazy"
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-muted">
                            <Layers size={40} aria-hidden="true" />
                        </span>
                    )}
                    {book.level !== null && (
                        <span
                            lang="en"
                            dir="ltr"
                            className="absolute end-3 top-3 inline-flex items-center rounded-full bg-surface/95 px-3 py-1 font-en text-xs font-extrabold text-ink"
                        >
                            {book.level}
                        </span>
                    )}
                </div>
            </Link>

            <div className="grid gap-3 p-4">
                <div className="grid gap-1">
                    <Link href={book.url} className="no-underline">
                        <h2 lang="en" dir="ltr" className="m-0 text-lg leading-7 font-extrabold text-ink">
                            {book.title_en}
                        </h2>
                        {book.title_fa !== null && book.title_fa !== '' && (
                            <p className="m-0 text-sm leading-7 text-muted">{book.title_fa}</p>
                        )}
                    </Link>
                    <p className="m-0 text-xs leading-6 text-muted">
                        {fa(book.units_count)} یونیت · {fa(book.cards_count)} کارت
                        {book.due_count > 0 && (
                            <span className="font-bold text-accent-strong"> · {fa(book.due_count)} مرور امروز</span>
                        )}
                    </p>
                    {book.exercise !== null && (
                        <p className="m-0 text-xs leading-6 text-muted" data-book-exercise>
                            تمرین: {fa(book.exercise.questions === 0 ? 0 : Math.round((book.exercise.answered / book.exercise.questions) * 100))}٪
                            {' · '}
                            {fa(book.exercise.answered)} از {fa(book.exercise.questions)} سؤال
                        </p>
                    )}
                </div>

                <div
                    role="progressbar"
                    aria-label={`پیشرفت ${book.title_en}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-line"
                >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 inline-flex items-center gap-3 text-xs text-muted">
                        <span className="inline-flex items-center gap-1 text-success">
                            <Check size={14} aria-hidden="true" />
                            {fa(book.known_count)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-danger">
                            <X size={14} aria-hidden="true" />
                            {fa(book.unknown_count)}
                        </span>
                    </p>
                    <Link
                        href={book.url}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                    >
                        {book.due_count > 0 ? 'مرور امروز' : seen > 0 ? 'ادامه' : 'شروع'}
                        <ArrowLeft size={16} aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </article>
    );
}

export const FlashcardsIndex: FunctionComponent<FlashcardsIndexProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ books, totals, review }: FlashcardsIndexProps): React.JSX.Element => {
    const hasDue = review.due > 0;

    return (
        <>
            <Head title="کتاب‌ها" />
            <ScreenHeader title="کتاب‌ها" />
            <div className="mx-auto grid w-full max-w-[1120px] gap-5 px-4 py-5 sm:gap-6">
                <header className="grid gap-1.5">
                    <p className="fe-meta m-0 inline-flex items-center gap-1.5 text-accent-strong">
                        <Sparkles size={18} aria-hidden="true" />
                        فلش‌کارت واژه با صدا
                    </p>
                    <h1 className="fe-title m-0 text-2xl sm:text-3xl">
                        کلمه را ببین، معنی را بگو.
                    </h1>
                    <p className="fe-prose m-0 max-w-[62ch] text-muted">
                        هر یونیت یک جلسهٔ کوتاه است: واژه را می‌بینی و می‌شنوی، معنی را می‌گویی و بعد
                        پاسخ را باز می‌کنی. جلسهٔ بعدی خودکار از روی پاسخ‌هایت ساخته می‌شود.
                    </p>
                </header>

                <section
                    aria-label="مرور امروز"
                    data-flashcard-review-summary
                    className={`grid gap-4 rounded-3xl border p-4 sm:flex sm:items-center sm:justify-between sm:p-5 ${
                        hasDue ? 'border-primary/30 bg-primary/5' : 'border-line bg-surface'
                    }`}
                >
                    <div className="grid gap-1">
                        <p className="m-0 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                            <CalendarClock size={18} aria-hidden="true" />
                            مرور امروز
                        </p>
                        <p className="m-0 text-lg leading-8 font-extrabold">
                            {hasDue ? `${fa(review.due)} کارت آمادهٔ مرور است.` : 'چیزی برای مرور نمانده.'}
                        </p>
                        <p className="m-0 text-sm leading-7 text-muted">
                            {hasDue
                                ? 'کوتاه است؛ همین حالا شروع کن.'
                                : review.next_due_at !== null
                                  ? `موعد بعدی: ${formatDue(review.next_due_at)}`
                                  : 'با شروع یک یونیت، کارت‌هایت ساخته می‌شوند.'}
                            {review.reviewed_today > 0 && ` امروز ${fa(review.reviewed_today)} مرور ثبت کرده‌ای.`}
                        </p>
                    </div>
                    <div className="grid gap-2 sm:justify-items-end">
                        <Link
                            href="/app/flashcards/review"
                            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover sm:w-auto"
                        >
                            {hasDue ? 'شروع مرور' : 'دیدن مرور امروز'}
                        </Link>
                        <Link
                            href="/app/review"
                            className="text-center text-xs font-bold text-primary no-underline hover:underline"
                        >
                            مرور واژه‌ها و تمرین‌ها
                        </Link>
                    </div>
                </section>

                {books.length === 0 ? (
                    <section className="grid justify-items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <Layers size={28} aria-hidden="true" />
                        <h2 className="m-0 text-xl font-extrabold">هنوز کتابی اضافه نشده.</h2>
                        <p className="m-0 leading-8 text-muted">
                            به‌زودی کتاب‌ها اینجا ظاهر می‌شوند.
                        </p>
                    </section>
                ) : (
                    <section aria-label="کتاب‌ها" className="grid gap-4 sm:grid-cols-2">
                        {books.map((book) => (
                            <BookCard key={book.slug} book={book} />
                        ))}
                    </section>
                )}

                {books.length > 0 && (
                    <section className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-3 text-center">
                        <div>
                            <p className="m-0 text-xl font-extrabold">{fa(totals.total)}</p>
                            <p className="m-0 text-xs text-muted">کارت</p>
                        </div>
                        <div>
                            <p className="m-0 text-xl font-extrabold text-success">{fa(totals.known)}</p>
                            <p className="m-0 text-xs text-muted">درست گفتم</p>
                        </div>
                        <div>
                            <p className="m-0 text-xl font-extrabold text-danger">{fa(totals.unknown)}</p>
                            <p className="m-0 text-xs text-muted">درست نگفتم</p>
                        </div>
                    </section>
                )}
            </div>
        </>
    );
};

FlashcardsIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default FlashcardsIndex;
