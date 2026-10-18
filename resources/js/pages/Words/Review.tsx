import { Head, Link, router } from '@inertiajs/react';
import { BookOpen, CircleCheck, Eye } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import { postJson } from '@/lib/http';
import type { SharedProps } from '@/types';

/**
 * Vocabulary review (VOCAB-01): one due card at a time with
 * Again/Hard/Good/Easy grading. The meaning stays hidden until asked;
 * the grade posts to the JSON endpoint and the next due card loads only
 * after the server confirms the deterministic SRS reschedule.
 */

interface ReviewCard {
    id: number;
    word: string;
    meaning_fa: string | null;
    example_en: string | null;
    reader_url: string | null;
}

interface ReviewProps extends SharedProps {
    card: ReviewCard | null;
    remaining: number;
    grades: string[];
}

const GRADE_LABELS: Record<string, string> = {
    again: 'دوباره',
    hard: 'سخت',
    good: 'خوب',
    easy: 'آسان',
};

const GRADE_SHORTCUTS: Record<string, string> = {
    again: '1',
    hard: '2',
    good: '3',
    easy: '4',
};

export const WordsReview: FunctionComponent<ReviewProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    card,
    remaining,
    grades,
}: ReviewProps): React.JSX.Element => {
    const [revealed, setRevealed] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [gradeStatus, setGradeStatus] = React.useState('');

    React.useEffect(() => {
        setRevealed(false);
        setGradeStatus('');
    }, [card?.id]);

    const grade = React.useCallback(
        async (value: string): Promise<void> => {
            if (card === null || busy) {
                return;
            }
            setBusy(true);
            try {
                const response = await postJson(`/app/words/${card.id}/grade`, { grade: value });
                if (response.ok) {
                    router.reload({ only: ['card', 'remaining'] });
                } else {
                    const data = (await response.json().catch(() => null)) as { message?: string } | null;
                    setGradeStatus(data?.message ?? 'ثبت نتیجه مرور ممکن نشد. دوباره تلاش کنید.');
                }
            } catch {
                setGradeStatus('ثبت نتیجه مرور ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.');
            } finally {
                setBusy(false);
            }
        },
        [card, busy],
    );

    React.useEffect(() => {
        if (card === null || !revealed) {
            return;
        }
        const onKey = (event: KeyboardEvent): void => {
            const entry = Object.entries(GRADE_SHORTCUTS).find(([, shortcut]) => shortcut === event.key);
            if (entry !== undefined) {
                event.preventDefault();
                void grade(entry[0]);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [card, revealed, grade]);

    return (
        <>
            <Head title="مرور واژه‌ها" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <div>
                    <p lang="en" dir="ltr" className="m-0 font-en text-sm font-bold tracking-[0.18em] text-accent-strong uppercase">
                        Review
                    </p>
                    <h1 className="m-0 mt-1 text-3xl leading-[1.6] font-extrabold tracking-tight">مرور واژه‌ها</h1>
                    <p role="status" className="m-0 mt-2 text-[1.0625rem] leading-8 text-muted">
                        {remaining} واژه برای مرور
                    </p>
                </div>

                {card === null ? (
                    <div role="status" className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <CircleCheck size={24} aria-hidden="true" />
                        <p className="m-0 text-xl font-bold">واژه‌ای برای مرور نیست.</p>
                        <p className="m-0 leading-8 text-muted">واژه‌های جدید را از درس‌ها ذخیره کن تا اینجا مرور شوند.</p>
                        <p className="m-0 mt-2">
                            <Link
                                href="/app/words"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                بازگشت به دفترچه
                            </Link>
                        </p>
                    </div>
                ) : (
                    <>
                        <section aria-label="کارت مرور" data-word-id={card.id} className="grid gap-4 rounded-3xl border border-line bg-surface p-6 text-center">
                            <h2 lang="en" dir="ltr" className="fe-flash-word m-0 text-center font-en text-3xl leading-[1.4] font-extrabold">
                                {card.word}
                            </h2>
                            <div id="flash-meaning" hidden={!revealed} className="grid gap-2">
                                <p dir="auto" className="m-0 text-lg leading-9">
                                    {card.meaning_fa ?? '—'}
                                </p>
                                {card.example_en !== null && card.example_en !== '' && (
                                    <p lang="en" dir="ltr" className="m-0 text-center font-en leading-7 text-muted">
                                        {card.example_en}
                                    </p>
                                )}
                                {card.reader_url !== null && (
                                    <p className="m-0">
                                        <Link href={card.reader_url} className="inline-flex min-h-11 min-w-11 items-center gap-1.5 text-[0.9375rem] text-primary no-underline">
                                            <BookOpen size={16} aria-hidden="true" />
                                            دیدن در متن اصلی
                                        </Link>
                                    </p>
                                )}
                            </div>
                            {!revealed && (
                                <p className="m-0">
                                    <button
                                        id="flash-show"
                                        type="button"
                                        onClick={() => setRevealed(true)}
                                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface hover:bg-primary-hover"
                                    >
                                        <Eye size={20} aria-hidden="true" />
                                        نمایش معنی
                                    </button>
                                </p>
                            )}
                            <div id="flash-grades" role="group" aria-label="نتیجه مرور" hidden={!revealed} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {grades.map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void grade(value)}
                                        data-grade={value}
                                        data-word-id={card.id}
                                        aria-keyshortcuts={GRADE_SHORTCUTS[value] ?? ''}
                                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-4 py-2.5 font-bold text-ink hover:bg-surface disabled:opacity-60"
                                    >
                                        {GRADE_LABELS[value] ?? value}
                                        <span aria-hidden="true" className="font-en text-xs text-muted">
                                            {GRADE_SHORTCUTS[value] ?? ''}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            {revealed && (
                                <p id="flash-grades-hint" className="m-0 text-sm leading-7 text-muted">
                                    کلیدهای ۱ تا ۴ هم کار می‌کنند.
                                </p>
                            )}
                            <p id="grade-status" role="status" className="m-0 text-sm leading-7 text-muted">
                                {gradeStatus}
                            </p>
                        </section>
                        <p className="m-0">
                            <Link
                                href="/app/words"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                            >
                                بازگشت به دفترچه
                            </Link>
                        </p>
                    </>
                )}
            </div>
        </>
    );
};

WordsReview.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default WordsReview;
