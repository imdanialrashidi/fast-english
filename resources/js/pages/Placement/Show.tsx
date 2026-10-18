import { Head, useForm, usePage } from '@inertiajs/react';
import { Check, GraduationCap } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import { postJson } from '@/lib/http';
import type { SharedProps } from '@/types';

/**
 * Placement questions (PLACE-01): the pinned version's questions with
 * per-question saves. Only id/position/prompt/options render — the
 * answer key never leaves the server. Saves post to the JSON answer
 * endpoint without leaving the page; the final submit is a real POST
 * that lands on the result page.
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
    answeredCount: number;
    totalCount: number;
}

export const PlacementShow: FunctionComponent<PlacementShowProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    attempt,
    questions,
    selected,
    answeredCount,
    totalCount,
}: PlacementShowProps): React.JSX.Element => {
    const { status } = usePage<SharedProps>().props;
    const [choices, setChoices] = React.useState<Record<string, number>>(selected);
    const [notice, setNotice] = React.useState('');
    const [saving, setSaving] = React.useState<Record<number, boolean>>({});
    const submitForm = useForm({});

    React.useEffect(() => {
        setChoices(selected);
    }, [selected]);

    const saveAnswer = async (question: Question): Promise<void> => {
        const chosen = choices[String(question.id)];
        if (chosen === undefined || saving[question.id] === true) {
            return;
        }
        setSaving((previous) => ({ ...previous, [question.id]: true }));
        try {
            const response = await postJson(`/app/placement/${attempt.id}/answer`, {
                question_id: question.id,
                selected_option: chosen,
            });
            if (response.ok) {
                setNotice('پاسخ ذخیره شد.');
            } else {
                const data = (await response.json().catch(() => null)) as { message?: string } | null;
                setNotice(data?.message ?? 'ذخیره پاسخ ممکن نشد. دوباره تلاش کنید.');
            }
        } catch {
            setNotice('ذخیره پاسخ ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.');
        } finally {
            setSaving((previous) => ({ ...previous, [question.id]: false }));
        }
    };

    const submit = (event: React.FormEvent): void => {
        event.preventDefault();
        submitForm.post(`/app/placement/${attempt.id}/submit`);
    };

    return (
        <>
            <Head title="سؤالات تعیین سطح" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <div>
                    <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">سؤالات تعیین سطح</h1>
                    <p role="status" className="m-0 mt-2 text-[1.0625rem] leading-8 text-muted">
                        {answeredCount} از {totalCount} پاسخ ذخیره شده است.
                    </p>
                </div>

                {(status !== null || notice !== '') && (
                    <p role="status" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-muted">
                        {notice !== '' ? notice : status}
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
                                        required
                                        checked={choices[String(question.id)] === index}
                                        onChange={() => setChoices((previous) => ({ ...previous, [String(question.id)]: index }))}
                                        className="h-5 w-5 shrink-0 accent-primary"
                                    />
                                    <span className="text-left">{option}</span>
                                </label>
                            ))}
                        </div>
                        <div>
                            <button
                                type="button"
                                disabled={saving[question.id] === true || choices[String(question.id)] === undefined}
                                onClick={() => void saveAnswer(question)}
                                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink hover:bg-canvas disabled:opacity-60"
                            >
                                <Check size={20} aria-hidden="true" />
                                ذخیره پاسخ سؤال {question.position}
                            </button>
                        </div>
                    </section>
                ))}

                <div className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-10 text-center">
                    <GraduationCap size={24} aria-hidden="true" />
                    <p className="m-0 leading-8 text-muted">پس از ذخیره همه پاسخ‌ها، نتیجه را ثبت کنید. پاسخ ناقص نتیجه‌ای ندارد.</p>
                    <form onSubmit={submit} className="m-0">
                        <button
                            type="submit"
                            disabled={submitForm.processing}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                        >
                            <Check size={20} aria-hidden="true" />
                            ثبت نهایی پاسخ‌ها
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
};

PlacementShow.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default PlacementShow;
