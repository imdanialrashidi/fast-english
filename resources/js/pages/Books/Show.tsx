import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen, Check } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { BookRow, BookUnitRow, SharedProps } from '@/types';

/**
 * One book's unit list. Units are quiet rows: number, both titles and the
 * exercise state. The unit page is the only destination; there is no card
 * deck path anymore.
 */

interface BooksShowProps extends SharedProps {
    book: BookRow;
    units: BookUnitRow[];
}

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

function percent(answered: number, questions: number): number {
    return questions === 0 ? 0 : Math.min(100, Math.round((answered / questions) * 100));
}

function bookLabel(slug: string): string {
    if (slug.endsWith('-starter')) {
        return 'Starter';
    }

    const match = /-(\d+)$/.exec(slug);

    return match?.[1] ?? slug;
}

export const BooksShow: FunctionComponent<BooksShowProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ book, units }: BooksShowProps): React.JSX.Element => {
    const questions = units.reduce((total, unit) => total + (unit.exercise?.questions ?? 0), 0);
    const answered = units.reduce((total, unit) => total + (unit.exercise?.answered ?? 0), 0);
    const progress = percent(answered, questions);
    const next =
        units.find((unit) => unit.exercise !== null && unit.exercise.answered < unit.exercise.questions) ?? units[0];

    return (
        <>
            <Head title={book.title_en} />
            <ScreenHeader
                title={book.title_fa ?? book.title_en}
                back={{ href: '/app/books', label: 'بازگشت به کتاب‌ها' }}
            />
            <div className="mx-auto grid w-full max-w-[900px] gap-5 px-4 py-5">
                <section className="grid gap-4 rounded-3xl border border-line bg-surface p-4 sm:grid-cols-[180px_1fr] sm:items-center sm:p-5">
                    <div
                        className="relative flex aspect-[4/3] w-full flex-col justify-between rounded-2xl bg-ink p-4 text-surface"
                        dir="ltr"
                        aria-hidden="true"
                    >
                        <span className="font-en text-[0.55rem] font-bold tracking-[0.18em] text-surface/70">
                            AMERICAN ENGLISH FILE
                        </span>
                        <p className="m-0 font-en text-3xl leading-none font-black">{bookLabel(book.slug)}</p>
                        <span className="font-en text-[0.55rem] font-bold tracking-wide text-surface/70">
                            {book.level ?? ''}
                        </span>
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
                        {book.title_fa !== null && book.title_fa !== '' && (
                            <p className="m-0 text-sm leading-7 text-muted">{book.title_fa}</p>
                        )}
                        <p className="m-0 text-sm leading-7 text-muted">
                            {fa(book.units_count)} یونیت · {fa(questions)} سؤال
                            {questions > 0 && ` · ${fa(progress)}٪ پاسخ داده‌شده`}
                        </p>
                        {questions > 0 && (
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
                        )}
                        {next !== undefined && next.exercise !== null && next.exercise.questions > 0 && (
                            <div className="pt-1">
                                <Link
                                    href={next.hub_url}
                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    {answered === 0 ? 'شروع تمرین' : 'ادامهٔ تمرین'}
                                    <ArrowLeft size={16} aria-hidden="true" />
                                </Link>
                            </div>
                        )}
                    </div>
                </section>

                <section aria-label="یونیت‌ها" className="grid gap-2">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <h2 className="m-0 text-lg font-extrabold">یونیت‌ها</h2>
                        <p className="m-0 text-xs text-muted">هر یونیت: توضیح، فرمول، مثال و سؤال.</p>
                    </div>

                    <ul className="m-0 grid list-none gap-2 p-0">
                        {units.map((unit) => {
                            const exercise = unit.exercise;
                            const unitQuestions = exercise?.questions ?? 0;
                            const unitAnswered = exercise?.answered ?? 0;
                            const unitProgress = percent(unitAnswered, unitQuestions);
                            const ready = exercise !== null && unitQuestions > 0;

                            return (
                                <li
                                    key={unit.number}
                                    data-book-unit={unit.number}
                                    className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                                                {fa(unit.number)}
                                            </span>
                                            <h3 lang="en" dir="ltr" className="m-0 truncate text-base font-extrabold">
                                                {unit.title_en}
                                            </h3>
                                        </div>
                                        {unit.title_fa !== null && unit.title_fa !== '' && (
                                            <p className="m-0 mt-1 text-sm leading-6 text-muted">{unit.title_fa}</p>
                                        )}
                                        {ready ? (
                                            <>
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
                                                    <p data-unit-exercise-status className="m-0 shrink-0 text-xs text-muted">
                                                        {fa(unitAnswered)} از {fa(unitQuestions)} سؤال
                                                    </p>
                                                </div>
                                                {unitAnswered === unitQuestions && (
                                                    <p className="m-0 mt-1 inline-flex items-center gap-1 text-xs text-success">
                                                        <Check size={14} aria-hidden="true" />
                                                        کامل پاسخ داده شد
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="m-0 mt-1 inline-flex items-center gap-1 text-xs text-muted">
                                                <BookOpen size={14} aria-hidden="true" />
                                                تمرین این یونیت آماده نیست
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center sm:justify-end">
                                        {ready ? (
                                            <Link
                                                href={unit.hub_url}
                                                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                                            >
                                                {unitAnswered === 0 ? 'شروع' : unitAnswered >= unitQuestions ? 'مرور' : 'ادامه'}
                                                <ArrowLeft size={16} aria-hidden="true" />
                                            </Link>
                                        ) : (
                                            <span className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs text-muted">
                                                به‌زودی
                                            </span>
                                        )}
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

BooksShow.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default BooksShow;
