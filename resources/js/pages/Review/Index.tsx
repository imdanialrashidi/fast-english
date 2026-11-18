import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen, Check, ClipboardList, Languages, Layers, RotateCcw } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * The cross-track review hub (owner request 2026-11-15): due words, due
 * book cards and exercise mistakes in one place. Each queue keeps its own
 * session; the hub only reads and links, so the two schedulers stay intact.
 */

interface ReviewProps extends SharedProps {
    total: number;
    primary: { label: string; url: string } | null;
    words: {
        due: number;
        learning: number;
        review_url: string;
        notebook_url: string;
    };
    cards: {
        due: number;
        next_due_at: string | null;
        review_url: string;
        books_url: string;
    };
    exercises: {
        wrong: number;
        sets: number;
        retry_url: string | null;
        result_url: string | null;
    };
}

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

function formatDue(iso: string | null): string {
    if (iso === null || iso === '') {
        return '';
    }

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export const ReviewIndex: FunctionComponent<ReviewProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ total, primary, words, cards, exercises }: ReviewProps): React.JSX.Element => {
    return (
        <>
            <Head title="مرور" />
            <ScreenHeader title="مرور" back={{ href: '/app/today', label: 'بازگشت به امروز' }} />

            <div className="mx-auto grid w-full max-w-[680px] gap-4 px-4 py-5">
                <section className="grid gap-4 rounded-3xl border border-line bg-surface p-6 text-center">
                    <div className="grid gap-1">
                        <p className="m-0 text-xs leading-6 text-accent-strong">مرور امروز</p>
                        <p className="m-0 text-2xl leading-9 font-extrabold">
                            {total > 0 ? `${fa(total)} مورد برای مرور` : 'چیزی برای مرور نمانده.'}
                        </p>
                        <p className="m-0 text-sm leading-7 text-muted">
                            {total > 0
                                ? 'واژه‌های موعددار، کارت‌های کتاب و اشتباه‌های تمرین، همه یک‌جا.'
                                : 'وقتی موعد واژه یا کارتی برسد یا تمرینی غلط داشته باشد، همین‌جا ظاهر می‌شود.'}
                        </p>
                    </div>

                    {primary !== null ? (
                        <Link
                            href={primary.url}
                            data-review-primary
                            className="mx-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 font-bold text-surface no-underline hover:bg-primary-hover"
                        >
                            <RotateCcw size={18} aria-hidden="true" />
                            {primary.label}
                        </Link>
                    ) : (
                        <Link
                            href="/app/words"
                            className="mx-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-canvas px-6 py-2.5 font-bold text-ink no-underline hover:bg-surface"
                        >
                            <Languages size={18} aria-hidden="true" />
                            رفتن به دفترچهٔ واژه‌ها
                        </Link>
                    )}
                </section>

                <section aria-label="واژه‌ها" className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
                    <div className="flex items-start gap-3">
                        <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Languages size={22} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h2 className="m-0 text-base font-bold">واژه‌های من</h2>
                            <p className="m-0 text-xs leading-6 text-muted">
                                {words.due > 0 ? `${fa(words.due)} واژه موعددار` : 'واژه‌ای برای مرور نیست'}
                                {words.learning > 0 ? ` · ${fa(words.learning)} در حال یادگیری` : ''}
                            </p>
                        </div>
                        <span
                            data-review-count="words"
                            className={
                                words.due > 0
                                    ? 'inline-flex min-w-9 items-center justify-center rounded-full bg-accent-strong px-2 py-0.5 text-xs font-bold text-surface'
                                    : 'inline-flex min-w-9 items-center justify-center rounded-full bg-line px-2 py-0.5 text-xs font-bold text-muted'
                            }
                        >
                            {fa(words.due)}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {words.due > 0 ? (
                            <Link
                                href={words.review_url}
                                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                شروع مرور واژه‌ها
                            </Link>
                        ) : (
                            <span className="inline-flex min-h-11 items-center gap-1 text-xs text-success">
                                <Check size={16} aria-hidden="true" />
                                امروز چیزی نمانده
                            </span>
                        )}
                        <Link
                            href={words.notebook_url}
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-canvas px-5 py-2 text-sm font-bold text-ink no-underline hover:bg-surface"
                        >
                            دفترچهٔ واژه‌ها
                        </Link>
                    </div>
                </section>

                <section aria-label="کارت‌های کتاب" className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
                    <div className="flex items-start gap-3">
                        <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Layers size={22} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h2 className="m-0 text-base font-bold">کارت‌های کتاب</h2>
                            <p className="m-0 text-xs leading-6 text-muted">
                                {cards.due > 0
                                    ? `${fa(cards.due)} کارت آمادهٔ مرور`
                                    : cards.next_due_at !== null
                                      ? `موعد بعدی: ${formatDue(cards.next_due_at)}`
                                      : 'کارتی در برنامه نیست'}
                            </p>
                        </div>
                        <span
                            data-review-count="cards"
                            className={
                                cards.due > 0
                                    ? 'inline-flex min-w-9 items-center justify-center rounded-full bg-accent-strong px-2 py-0.5 text-xs font-bold text-surface'
                                    : 'inline-flex min-w-9 items-center justify-center rounded-full bg-line px-2 py-0.5 text-xs font-bold text-muted'
                            }
                        >
                            {fa(cards.due)}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {cards.due > 0 ? (
                            <Link
                                href={cards.review_url}
                                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                شروع مرور کارت‌ها
                            </Link>
                        ) : (
                            <span className="inline-flex min-h-11 items-center gap-1 text-xs text-success">
                                <Check size={16} aria-hidden="true" />
                                امروز چیزی نمانده
                            </span>
                        )}
                        <Link
                            href={cards.books_url}
                            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full border border-line bg-canvas px-5 py-2 text-sm font-bold text-ink no-underline hover:bg-surface"
                        >
                            <BookOpen size={16} aria-hidden="true" />
                            کتاب‌ها
                        </Link>
                    </div>
                </section>

                <section aria-label="تمرین‌های کتاب" className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
                    <div className="flex items-start gap-3">
                        <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent-strong">
                            <ClipboardList size={22} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <h2 className="m-0 text-base font-bold">تمرین‌های کتاب</h2>
                            <p className="m-0 text-xs leading-6 text-muted">
                                {exercises.wrong > 0
                                    ? `${fa(exercises.wrong)} غلط در ${fa(exercises.sets)} تمرین`
                                    : 'غلطی در آخرین تمرین‌ها نیست.'}
                            </p>
                        </div>
                        <span
                            data-review-count="exercises"
                            className={
                                exercises.wrong > 0
                                    ? 'inline-flex min-w-9 items-center justify-center rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-surface'
                                    : 'inline-flex min-w-9 items-center justify-center rounded-full bg-line px-2 py-0.5 text-xs font-bold text-muted'
                            }
                        >
                            {fa(exercises.wrong)}
                        </span>
                    </div>
                    {exercises.wrong > 0 && exercises.result_url !== null ? (
                        <div className="flex flex-wrap gap-2">
                            {exercises.retry_url !== null && (
                                <Link
                                    href={exercises.retry_url}
                                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    تلاش دوبارهٔ تمرین
                                </Link>
                            )}
                            <Link
                                href={exercises.result_url}
                                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full border border-line bg-canvas px-5 py-2 text-sm font-bold text-ink no-underline hover:bg-surface"
                            >
                                <ArrowLeft size={16} aria-hidden="true" />
                                دیدن نتیجه
                            </Link>
                        </div>
                    ) : (
                        <span className="inline-flex min-h-11 items-center gap-1 text-xs text-success">
                            <Check size={16} aria-hidden="true" />
                            تمرین‌ها پاک است
                        </span>
                    )}
                </section>
            </div>
        </>
    );
};

ReviewIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default ReviewIndex;
