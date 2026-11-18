import { Head, Link, router } from '@inertiajs/react';
import { BookOpen, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { MixedText } from '@/components/MixedText';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type {
    ExerciseAnswerResult,
    ExerciseTopicRow,
    SharedProps,
    UnitExerciseItem,
    UnitExerciseSet,
    UnitProgress,
} from '@/types';

/**
 * The unit page: one scrolling lesson in the book's order. Each grammar
 * topic is explained in Persian with formulas and examples, and its
 * questions sit directly under it. A question is marked in place: the first
 * answer is stored and counted, the key and the Persian feedback appear
 * immediately, and retrying the same question never changes progress.
 */

interface BookUnitProps extends SharedProps {
    book: {
        slug: string;
        title_en: string;
        title_fa: string | null;
        level: string | null;
        url: string;
    };
    unit: {
        number: number;
        title_en: string;
        title_fa: string | null;
        subtitle: string | null;
        previous_url: string | null;
        next_url: string | null;
    };
    progress: UnitProgress;
    set: UnitExerciseSet | null;
    topics: ExerciseTopicRow[];
    items: UnitExerciseItem[];
    answer_url: string;
}

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

function percent(done: number, total: number): number {
    return total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
}

function csrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

function answerReady(item: UnitExerciseItem, selection: number | number[] | undefined): boolean {
    if (item.type === 'choice') {
        return typeof selection === 'number';
    }

    return Array.isArray(selection) && selection.length > 0 && selection.every((value) => value !== null);
}

export const BookUnitPage: FunctionComponent<BookUnitProps> & {
    layout?: (page: ReactNode) => ReactNode;
} = ({
    book,
    unit,
    progress,
    set,
    topics,
    items,
    answer_url,
}: BookUnitProps): React.JSX.Element => {
    const [results, setResults] = React.useState<Record<number, ExerciseAnswerResult>>(() => {
        const initial: Record<number, ExerciseAnswerResult> = {};
        for (const item of items) {
            if (item.result !== undefined) {
                initial[item.id] = item.result;
            }
        }
        return initial;
    });
    const [selections, setSelections] = React.useState<Record<number, number | number[]>>({});
    const [busyId, setBusyId] = React.useState<number | null>(null);
    const [errors, setErrors] = React.useState<Record<number, string>>({});

    const answered = Object.keys(results).length;
    const done = percent(answered, progress.questions);
    const finished = progress.questions > 0 && answered >= progress.questions;

    const submit = async (item: UnitExerciseItem): Promise<void> => {
        const selection = selections[item.id];
        if (busyId !== null || !answerReady(item, selection)) {
            return;
        }

        setBusyId(item.id);
        setErrors((previous) => ({ ...previous, [item.id]: '' }));

        try {
            const response = await fetch(answer_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ item_id: item.id, response: selection }),
            });

            const payload = (await response.json()) as
                | {
                      item_id: number;
                      is_correct: boolean;
                      correct: string;
                      explanation_fa: string | null;
                      feedback_fa: string | null;
                      already: boolean;
                  }
                | { errors?: Record<string, string[]>; message?: string };

            if (!response.ok) {
                const message =
                    'errors' in payload && payload.errors !== undefined
                        ? (Object.values(payload.errors)[0]?.[0] ?? 'ثبت پاسخ ممکن نشد.')
                        : 'ثبت پاسخ ممکن نشد. دوباره تلاش کنید.';
                setErrors((previous) => ({ ...previous, [item.id]: message }));
                return;
            }

            const result = payload as {
                item_id: number;
                is_correct: boolean;
                correct: string;
                explanation_fa: string | null;
                feedback_fa: string | null;
            };

            setResults((previous) => ({
                ...previous,
                [item.id]: {
                    is_correct: result.is_correct,
                    response: selection ?? 0,
                    correct: result.correct,
                    explanation_fa: result.explanation_fa,
                    feedback_fa: result.feedback_fa,
                    answered_at: null,
                },
            }));
        } catch {
            setErrors((previous) => ({ ...previous, [item.id]: 'ارتباط برقرار نشد. دوباره تلاش کنید.' }));
        } finally {
            setBusyId(null);
        }
    };

    const topicItems = (key: string): UnitExerciseItem[] => items.filter((item) => item.topic_key === key);
    const orderedTopics = [...topics].sort((a, b) => a.id - b.id);

    return (
        <>
            <Head title={`یونیت ${unit.number} · ${unit.title_en}`} />
            <ScreenHeader
                title={`یونیت ${fa(unit.number)}`}
                back={{ href: book.url, label: 'بازگشت به کتاب' }}
            />

            <div className="mx-auto grid w-full max-w-[760px] gap-5 px-4 py-5">
                <section className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
                    <div className="grid gap-1">
                        <p className="m-0 text-xs font-bold text-primary">{book.title_en}</p>
                        <h1 lang="en" dir="ltr" className="m-0 text-2xl leading-9 font-extrabold">
                            {unit.title_en}
                        </h1>
                        {unit.title_fa !== null && <p className="m-0 text-sm text-muted">{unit.title_fa}</p>}
                    </div>

                    <div className="grid gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-bold">
                                {fa(done)}٪ پیشرفت · {fa(answered)} از {fa(progress.questions)} سؤال
                            </span>
                            {finished && (
                                <span className="inline-flex items-center gap-1 text-success">
                                    <Check size={16} aria-hidden="true" />
                                    همهٔ سؤال‌ها پاسخ داده شد
                                </span>
                            )}
                        </div>
                        <div
                            role="progressbar"
                            aria-label="پیشرفت یونیت"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={done}
                            className="h-2 w-full overflow-hidden rounded-full bg-line"
                        >
                            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${done}%` }} />
                        </div>
                        {set !== null && <p className="m-0 text-xs leading-6 text-muted">{set.instructions_fa}</p>}
                    </div>
                </section>

                {set === null || orderedTopics.length === 0 ? (
                    <section className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-line bg-surface px-6 py-10 text-center">
                        <BookOpen size={28} aria-hidden="true" />
                        <h2 className="m-0 text-lg font-extrabold">محتوای این یونیت در حال آماده‌سازی است.</h2>
                        <p className="m-0 max-w-md text-sm leading-8 text-muted">
                            تمرین‌های گرامر این یونیت به‌زودی اضافه می‌شوند.
                        </p>
                    </section>
                ) : (
                    orderedTopics.map((topic, topicIndex) => (
                        <section key={topic.id} className="grid gap-3">
                            <article className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
                                <div className="grid gap-1">
                                    <p className="m-0 text-xs font-bold text-primary">مبحث {fa(topicIndex + 1)}</p>
                                    <h2 lang="en" dir="ltr" className="m-0 text-xl leading-8 font-extrabold">
                                        {topic.title_en}
                                    </h2>
                                    <p className="m-0 text-sm font-bold text-ink">{topic.title_fa}</p>
                                </div>

                                <p className="m-0 text-sm leading-8 text-ink">
                                    <MixedText text={topic.use_fa} />
                                </p>

                                {topic.formulas.length > 0 && (
                                    <div className="grid gap-2">
                                        {topic.formulas.map((formula, index) => (
                                            <div key={`${topic.key}-f-${index}`} className="grid gap-1 rounded-2xl bg-canvas p-3">
                                                <span className="text-xs font-bold text-muted">{formula.label_fa}</span>
                                                <p
                                                    lang="en"
                                                    dir="ltr"
                                                    className="m-0 whitespace-pre-line text-sm leading-7 font-bold text-ink"
                                                >
                                                    {formula.text}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {topic.examples.length > 0 && (
                                    <div className="grid gap-2">
                                        <p className="m-0 text-xs font-bold text-muted">مثال</p>
                                        <ul className="m-0 grid list-none gap-2 p-0">
                                            {topic.examples.map((example, index) => (
                                                <li key={`${topic.key}-e-${index}`} className="grid gap-0.5 border-s-2 border-primary/30 ps-3">
                                                    <span lang="en" dir="ltr" className="text-sm leading-7 text-ink">
                                                        {example.en}
                                                    </span>
                                                    {example.fa !== null && <span className="text-xs leading-6 text-muted">{example.fa}</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {topic.notes_fa !== null && (
                                    <p className="m-0 rounded-2xl bg-accent/10 p-3 text-xs leading-7 text-ink">
                                        <strong className="font-bold">نکته: </strong>
                                        <MixedText text={topic.notes_fa} />
                                    </p>
                                )}
                            </article>

                            {topicItems(topic.key).map((item, index) => (
                                <QuestionCard
                                    key={item.id}
                                    item={item}
                                    index={index + 1}
                                    result={results[item.id]}
                                    selection={selections[item.id]}
                                    busy={busyId === item.id}
                                    error={errors[item.id]}
                                    onSelect={(value) => {
                                        setSelections((previous) => ({ ...previous, [item.id]: value }));
                                        setErrors((previous) => ({ ...previous, [item.id]: '' }));
                                    }}
                                    onSubmit={() => void submit(item)}
                                />
                            ))}
                        </section>
                    ))
                )}

                <nav aria-label="یونیت‌های کتاب" className="flex items-center justify-between gap-2">
                    {unit.previous_url !== null ? (
                        <button
                            type="button"
                            onClick={() => router.visit(unit.previous_url as string)}
                            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-canvas"
                        >
                            <ChevronRight size={18} aria-hidden="true" />
                            یونیت قبل
                        </button>
                    ) : (
                        <span />
                    )}
                    {unit.next_url !== null ? (
                        <button
                            type="button"
                            onClick={() => router.visit(unit.next_url as string)}
                            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-canvas"
                        >
                            یونیت بعد
                            <ChevronLeft size={18} aria-hidden="true" />
                        </button>
                    ) : (
                        <span />
                    )}
                </nav>
            </div>
        </>
    );
};

BookUnitPage.layout = (page: ReactNode): ReactNode => <AppLayout>{page}</AppLayout>;

export default BookUnitPage;

interface QuestionCardProps {
    item: UnitExerciseItem;
    index: number;
    result: ExerciseAnswerResult | undefined;
    selection: number | number[] | undefined;
    busy: boolean;
    error: string | undefined;
    onSelect: (value: number | number[]) => void;
    onSubmit: () => void;
}

function QuestionCard({
    item,
    index,
    result,
    selection,
    busy,
    error,
    onSelect,
    onSubmit,
}: QuestionCardProps): React.JSX.Element {
    const answered = result !== undefined;
    const chosen = answered ? result.response : selection;
    const ready = !answered && answerReady(item, selection);

    return (
        <article className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-2">
                <p dir="auto" className="m-0 text-base leading-8 font-bold">
                    {item.prompt}
                </p>
                <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{fa(index)}</span>
            </div>

            {item.type === 'choice' ? (
                <div className="grid gap-2">
                    {(item.options ?? []).map((option, optionIndex) => (
                        <OptionButton
                            key={optionIndex}
                            label={option}
                            index={optionIndex}
                            selected={typeof chosen === 'number' && chosen === optionIndex}
                            answered={answered}
                            correct={answered && result !== undefined && result.correct === option}
                            onSelect={() => !answered && onSelect(optionIndex)}
                        />
                    ))}
                </div>
            ) : (
                <MatchingInput
                    left={item.left ?? []}
                    rights={item.rights ?? []}
                    value={Array.isArray(chosen) ? (chosen as number[]) : undefined}
                    disabled={answered}
                    onChange={onSelect}
                />
            )}

            {!answered && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={!ready || busy}
                        className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-2 text-sm font-bold text-surface hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {busy ? 'در حال بررسی…' : 'بررسی پاسخ'}
                    </button>
                    {error !== undefined && error !== '' && (
                        <p role="alert" className="m-0 text-xs text-danger">
                            {error}
                        </p>
                    )}
                </div>
            )}

            {answered && result !== undefined && <AnswerFeedback result={result} />}
        </article>
    );
}

function OptionButton({
    label,
    index,
    selected,
    answered,
    correct,
    onSelect,
}: {
    label: string;
    index: number;
    selected: boolean;
    answered: boolean;
    correct: boolean;
    onSelect: () => void;
}): React.JSX.Element {
    let tone = 'border-line bg-canvas hover:border-primary/50';
    if (answered && correct) {
        tone = 'border-success/60 bg-success/10';
    } else if (answered && selected) {
        tone = 'border-danger/60 bg-danger/10';
    } else if (selected) {
        tone = 'border-primary bg-primary/10';
    }

    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={answered}
            aria-pressed={selected}
            data-option-index={index}
            className={`flex min-h-11 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition-colors duration-150 ${tone} ${answered ? 'cursor-default' : 'cursor-pointer'}`}
        >
            <span
                aria-hidden="true"
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.625rem] font-bold ${
                    selected ? 'border-primary bg-primary text-surface' : 'border-line bg-surface text-muted'
                }`}
            >
                {answered && correct ? <Check size={12} /> : answered && selected ? <X size={12} /> : ''}
            </span>
            <span lang="en" dir="ltr" className="text-sm leading-7">
                {label}
            </span>
        </button>
    );
}

function MatchingInput({
    left,
    rights,
    value,
    disabled,
    onChange,
}: {
    left: string[];
    rights: string[];
    value: number[] | undefined;
    disabled: boolean;
    onChange: (value: number[]) => void;
}): React.JSX.Element {
    const [active, setActive] = React.useState<number | null>(null);
    const pairs = value !== undefined && value.length === left.length ? value : left.map(() => -1);

    const assign = (rightIndex: number): void => {
        if (disabled) {
            return;
        }

        const target = active ?? pairs.findIndex((chosen) => chosen === -1);
        if (target < 0) {
            return;
        }

        const next = [...pairs];
        for (let index = 0; index < next.length; index += 1) {
            if (next[index] === rightIndex) {
                next[index] = -1;
            }
        }
        next[target] = rightIndex;
        onChange(next);

        const following = next.findIndex((chosen) => chosen === -1);
        setActive(following === -1 ? null : following);
    };

    return (
        <div className="grid gap-3">
            <p className="m-0 text-xs leading-6 text-muted">
                روی یک مورد بزن، بعد جفتش را انتخاب کن. تا قبل از «بررسی پاسخ» می‌توانی انتخاب را عوض کنی.
            </p>
            <div className="grid grid-cols-2 gap-2">
                <div className="grid content-start gap-2">
                    {left.map((label, index) => {
                        const chosen = pairs[index];
                        return (
                            <button
                                key={`l-${index}`}
                                type="button"
                                disabled={disabled}
                                onClick={() => setActive(index)}
                                aria-pressed={active === index}
                                className={`grid min-h-11 gap-0.5 rounded-2xl border px-3 py-2 text-start transition-colors ${
                                    active === index ? 'border-primary bg-primary/10' : 'border-line bg-canvas'
                                }`}
                            >
                                <span lang="en" dir="ltr" className="text-sm leading-6">
                                    {label}
                                </span>
                                <span className="text-[0.6875rem] leading-5 text-muted">
                                    {chosen !== undefined && chosen >= 0 ? rights[chosen] : '—'}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="grid content-start gap-2">
                    {rights.map((label, index) => {
                        const used = pairs.includes(index);
                        return (
                            <button
                                key={`r-${index}`}
                                type="button"
                                disabled={disabled}
                                onClick={() => assign(index)}
                                aria-pressed={used}
                                className={`min-h-11 rounded-2xl border px-3 py-2 text-start transition-colors ${
                                    used ? 'border-primary/40 bg-primary/5' : 'border-line bg-canvas'
                                }`}
                            >
                                <span lang="en" dir="ltr" className="text-sm leading-6">
                                    {label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function AnswerFeedback({ result }: { result: ExerciseAnswerResult }): React.JSX.Element {
    return (
        <div
            role="status"
            className={`grid gap-2 rounded-2xl border p-4 ${
                result.is_correct ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10'
            }`}
        >
            <p className="m-0 inline-flex items-center gap-1.5 text-sm font-bold">
                {result.is_correct ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                {result.is_correct ? 'درست است.' : 'پاسخ درست نیست.'}
            </p>

            {!result.is_correct && (
                <p className="m-0 whitespace-pre-line text-sm leading-7">
                    <strong className="font-bold">پاسخ درست: </strong>
                    <span lang="en" dir="ltr">
                        {result.correct}
                    </span>
                </p>
            )}

            {result.feedback_fa !== null && !result.is_correct && (
                <p className="m-0 text-sm leading-7">
                    <MixedText text={result.feedback_fa} />
                </p>
            )}

            {result.explanation_fa !== null && (
                <p className="m-0 text-sm leading-7">
                    <MixedText text={result.explanation_fa} />
                </p>
            )}
        </div>
    );
}
