import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BookOpen, Layers } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import { BookTabs } from '@/components/library/BookTabs';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { BookRow, LibraryTab, SharedProps } from '@/types';

/**
 * The American English File shelf. Six coursebooks, one exercise track:
 * the learner opens a book, picks a unit and answers the grammar questions
 * in place. This is the item the shelf used to render directly.
 */

interface BooksIndexProps extends SharedProps {
    books: BookRow[];
    tabs: LibraryTab[];
}

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

function bookLabel(slug: string): string {
    if (slug.endsWith('-starter')) {
        return 'Starter';
    }

    const match = /-(\d+)$/.exec(slug);

    return match?.[1] ?? slug;
}

function percent(answered: number, questions: number): number {
    return questions === 0 ? 0 : Math.min(100, Math.round((answered / questions) * 100));
}

export const BooksAefIndex: FunctionComponent<BooksIndexProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({ books, tabs }: BooksIndexProps): React.JSX.Element => {
    return (
        <>
            <Head title="کتاب — American English File" />
            <ScreenHeader title="کتاب" back={{ href: '/app/books', label: 'بازگشت به کتاب‌ها' }} />
            <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-5 px-4 py-5 sm:gap-6">
                <header className="grid min-w-0 grid-cols-1 gap-1.5">
                    <p className="fe-meta m-0 inline-flex items-center gap-1.5 text-accent-strong">
                        <BookOpen size={18} aria-hidden="true" />
                        American English File · گرامر با تمرین
                    </p>
                    <h1 className="fe-title m-0 text-2xl sm:text-3xl">گرامر را در جمله تمرین کن.</h1>
                    <p className="fe-prose m-0 max-w-[62ch] text-muted">
                        هر یونیت یک درس کوتاه است: توضیح فارسی مبحث، فرمول و مثال، و بعد سؤال‌هایی که همان‌جا
                        جواب می‌دهی و بازخورد می‌گیری. پیشرفت با اولین پاسخ هر سؤال شمرده می‌شود.
                    </p>
                    <Link href="/app/review" className="w-fit text-xs font-bold text-primary no-underline hover:underline">
                        مرور واژه‌ها و تمرین‌ها
                    </Link>
                    <div className="pt-1">
                        <BookTabs tabs={tabs} />
                    </div>
                </header>

                {books.length === 0 ? (
                    <section className="grid justify-items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <Layers size={28} aria-hidden="true" />
                        <h2 className="m-0 text-xl font-extrabold">هنوز کتابی اضافه نشده.</h2>
                        <p className="m-0 leading-8 text-muted">به‌زودی کتاب‌ها اینجا ظاهر می‌شوند.</p>
                    </section>
                ) : (
                    <section aria-label="کتاب‌ها" className="grid gap-4 sm:grid-cols-2">
                        {books.map((book) => {
                            const exercise = book.exercise;
                            const answered = exercise?.answered ?? 0;
                            const questions = exercise?.questions ?? 0;
                            const progress = percent(answered, questions);
                            const action = answered === 0 ? 'شروع' : answered >= questions ? 'مرور' : 'ادامه';

                            return (
                                <article
                                    key={book.slug}
                                    className="grid overflow-hidden rounded-3xl border border-line bg-surface"
                                >
                                    <Link href={book.url} className="block no-underline" tabIndex={-1} aria-hidden="true">
                                        {book.cover_url !== null ? (
                                            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-canvas p-3">
                                                <img
                                                    src={book.cover_url}
                                                    alt=""
                                                    loading="lazy"
                                                    className="max-h-full max-w-full rounded-sm object-contain shadow-[0_10px_24px_rgb(23_34_56_/_0.18)]"
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="relative flex aspect-[4/3] flex-col justify-between bg-ink p-4 text-surface"
                                                dir="ltr"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="font-en text-[0.6rem] font-bold tracking-[0.18em] text-surface/70">
                                                        AMERICAN ENGLISH FILE
                                                    </span>
                                                    {book.level !== null && (
                                                        <span className="rounded-full bg-surface/15 px-2.5 py-0.5 font-en text-[0.65rem] font-extrabold">
                                                            {book.level}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="m-0 font-en text-5xl leading-none font-black">
                                                    {bookLabel(book.slug)}
                                                </p>
                                                <div className="flex items-center justify-between font-en text-[0.6rem] font-bold tracking-wide text-surface/70">
                                                    <span>THIRD EDITION</span>
                                                    <span>{book.units_count} UNITS</span>
                                                </div>
                                            </div>
                                        )}
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
                                                {fa(book.units_count)} یونیت
                                                {exercise !== null && ` · ${fa(questions)} سؤال`}
                                                {exercise === null && ' · تمرین‌ها به‌زودی'}
                                            </p>
                                        </div>

                                        {exercise !== null && questions > 0 && (
                                            <div className="grid gap-1.5">
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
                                                <p data-book-exercise className="m-0 text-xs leading-6 text-muted">
                                                    {fa(answered)} از {fa(questions)} سؤال · {fa(progress)}٪
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs text-muted">
                                                {exercise !== null && questions > 0 && answered === questions
                                                    ? 'همهٔ سؤال‌ها پاسخ داده شده'
                                                    : 'هر زمان می‌توانی ادامه بدهی'}
                                            </span>
                                            {exercise !== null && questions > 0 ? (
                                                <Link
                                                    href={book.url}
                                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface no-underline hover:bg-primary-hover"
                                                >
                                                    {action}
                                                    <ArrowLeft size={16} aria-hidden="true" />
                                                </Link>
                                            ) : (
                                                <span className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs text-muted">
                                                    به‌زودی
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                )}
            </div>
        </>
    );
};

BooksAefIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default BooksAefIndex;
