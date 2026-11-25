import { Head, router, usePage } from '@inertiajs/react';
import { Check, GraduationCap } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * Placement questions (PLACE-01), owner instruction 2026-11-25.
 *
 * One final submit. There is no per-question save button: the learner can
 * leave any question blank, press «ثبت نهایی پاسخ‌ها», and the server saves
 * every chosen option in one transaction and returns the result. Blank
 * questions are allowed and simply do not score.
 *
 * Only id/position/prompt/options render — the answer key never leaves the
 * server.
 */

interface Question {
    id: number;
    position: number;
    prompt: string;
    options: string[];
}

interface PlacementShowProps extends SharedProps {
    attempt: { id: number; status: string };
    questions: Question[];
    selected: Record<string, number>;
    totalCount: number;
}

export const PlacementShow: FunctionComponent<PlacementShowProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    attempt,
    questions,
    selected,
    totalCount,
}: PlacementShowProps): React.JSX.Element => {
    const { status, errors } = usePage<SharedProps>().props;
    const firstError = Object.values(errors)[0] ?? null;
    const [choices, setChoices] = React.useState<Record<string, number>>(selected);
    const [submitting, setSubmitting] = React.useState(false);
    const answeredCount = questions.reduce((total, question) => (choices[String(question.id)] !== undefined ? total + 1 : total), 0);
    const unansweredCount = totalCount - answeredCount;

    React.useEffect(() => {
        setChoices(selected);
    }, [selected]);

    const submit = (event: React.FormEvent): void => {
        event.preventDefault();
        if (submitting) {
            return;
        }

        setSubmitting(true);
        router.post(
            `/app/placement/${attempt.id}/submit`,
            { answers: choices },
            {
                onFinish: () => setSubmitting(false),
            },
        );
    };

    return (
        <>
            <Head title="سؤالات تعیین سطح" />
            <ScreenHeader title="سؤالات تعیین سطح" width="reading" back={{ href: '/app/placement', label: 'بازگشت به تعیین سطح' }} />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-5">
                <div role="status" className="grid gap-1 text-[1.0625rem] leading-8 text-muted">
                    <p className="m-0">
                        {answeredCount.toLocaleString('fa-IR')} از {totalCount.toLocaleString('fa-IR')} پاسخ انتخاب شده است.
                    </p>
                    <p className="m-0 text-sm leading-7">
                        می‌توانی بعضی سؤال‌ها را خالی بگذاری. با زدن دکمهٔ پایین، هر چه انتخاب کرده‌ای ثبت می‌شود و نتیجه را می‌بینی.
                    </p>
                </div>

                {(firstError !== null || status !== null) && (
                    <p
                        role={firstError !== null ? 'alert' : 'status'}
                        className={
                            firstError !== null
                                ? 'm-0 rounded-2xl border border-line bg-surface px-4 py-3 text-danger'
                                : 'm-0 rounded-2xl border border-line bg-surface px-4 py-3 text-muted'
                        }
                    >
                        {firstError ?? status}
                    </p>
                )}

                {questions.map((question) => (
                    <section key={question.id} aria-label={`سؤال ${question.position}`} className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
                        <h2 lang="en" dir="ltr" className="m-0 text-left font-en text-lg leading-8 font-bold">
                            {question.position}. {question.prompt}
                        </h2>
                        <div role="radiogroup" aria-label={`گزینه‌های سؤال ${question.position}`} className="grid gap-2">
                            {question.options.map((option, index) => (
                                <label
                                    key={index}
                                    lang="en"
                                    dir="ltr"
                                    className="fe-option inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-2xl border border-line bg-canvas px-4 py-2.5 font-en hover:bg-surface has-checked:border-primary has-checked:bg-surface"
                                >
                                    <input
                                        type="radio"
                                        name={`question-${question.id}`}
                                        value={index}
                                        checked={choices[String(question.id)] === index}
                                        onChange={() => {
                                            setChoices((previous) => ({ ...previous, [String(question.id)]: index }));
                                        }}
                                        className="h-5 w-5 shrink-0 accent-primary"
                                    />
                                    <span className="text-left">{option}</span>
                                </label>
                            ))}
                        </div>
                        <p className="m-0 text-xs text-muted">
                            {choices[String(question.id)] === undefined ? 'بدون پاسخ' : 'انتخاب شده'}
                        </p>
                    </section>
                ))}

                <div className="grid justify-items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-9 text-center">
                    <GraduationCap size={26} aria-hidden="true" />
                    <p className="m-0 max-w-[44ch] leading-8 text-muted">
                        {unansweredCount === 0
                            ? 'همهٔ سؤال‌ها پاسخ داده شده‌اند. نتیجه را ثبت کن.'
                            : `${unansweredCount.toLocaleString('fa-IR')} سؤال بی‌پاسخ مانده است. با همین وضعیت هم می‌توانی نتیجه را ثبت کنی.`}
                    </p>
                    <form onSubmit={submit} className="m-0">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex min-h-12 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-7 py-3 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                        >
                            <Check size={20} aria-hidden="true" />
                            {submitting ? 'در حال ثبت…' : 'ثبت نهایی پاسخ‌ها'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
};

PlacementShow.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default PlacementShow;
