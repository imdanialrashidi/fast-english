import * as React from 'react';
import { Check, Eye, X } from 'lucide-react';
import type { ReadingChapter, ReadingWord } from '@/types';

export interface StoryQuestion {
    id: string;
    number: number | null;
    type: string;
    prompt: string;
    answer: string;
    explanation_fa: string | null;
    evidence: { page_key: string; start_utf16: number; end_utf16: number } | null;
}

interface EvidenceTarget {
    pageKey: string;
    start: number;
    end: number;
}

interface TrueFalseProps {
    questions: StoryQuestion[];
    onShowEvidence: (target: EvidenceTarget) => void;
}

/**
 * True/False practice at the end of an Inside Reading text. The learner can
 * answer any subset, submit once, see the result, and jump to the exact
 * sentence in the text for every question. Answers live in the published
 * document; they are practice feedback, not an access control.
 */
export function InsideReadingTrueFalse({ questions, onShowEvidence }: TrueFalseProps): React.JSX.Element | null {
    const [answers, setAnswers] = React.useState<Record<string, 'TRUE' | 'FALSE'>>({});
    const [submitted, setSubmitted] = React.useState(false);

    if (questions.length === 0) {
        return null;
    }

    const answered = Object.keys(answers).length;
    const score = questions.reduce((total, question) => (answers[question.id] === question.answer ? total + 1 : total), 0);

    return (
        <section aria-label="سوال‌های درست یا نادرست" className="grid gap-3 rounded-3xl border border-line bg-surface p-4 sm:p-5">
            <div className="grid gap-1">
                <h2 className="m-0 text-xl leading-8 font-extrabold">درست یا نادرست؟</h2>
                <p className="m-0 text-sm leading-7 text-muted">
                    دربارهٔ متن تصمیم بگیر. هر وقت خواستی، جای پاسخ در متن را ببین.
                </p>
            </div>

            {questions.map((question) => {
                const given = answers[question.id];
                const correct = submitted && given === question.answer;
                return (
                    <article
                        key={question.id}
                        className={`grid gap-2 rounded-2xl border p-3.5 ${
                            submitted ? (correct ? 'border-success/40' : 'border-danger/40') : 'border-line'
                        }`}
                    >
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5 grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-ink px-1 font-en text-[0.65rem] font-black text-surface">
                                {(question.number ?? 0).toLocaleString('fa-IR')}
                            </span>
                            <p lang="en" dir="ltr" className="m-0 font-en text-sm leading-7 text-ink">
                                {question.prompt}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2" role="group" aria-label={`پاسخ سوال ${question.number ?? ''}`}>
                            {(['TRUE', 'FALSE'] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    aria-pressed={given === option}
                                    onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                                    className={
                                        given === option
                                            ? 'inline-flex min-h-10 items-center rounded-full border border-primary bg-primary/10 px-4 text-sm font-bold text-primary'
                                            : 'inline-flex min-h-10 items-center rounded-full border border-line bg-canvas px-4 text-sm font-bold text-ink hover:bg-surface'
                                    }
                                >
                                    <span lang="en" dir="ltr" className="font-en">
                                        {option === 'TRUE' ? 'True' : 'False'}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {submitted && (
                            <div className="grid gap-1.5 rounded-xl border border-line bg-canvas p-2.5">
                                <p className={`m-0 inline-flex items-center gap-1.5 text-xs font-bold ${correct ? 'text-success' : 'text-danger'}`}>
                                    {correct ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
                                    {correct ? 'درست است.' : `پاسخ درست: ${question.answer === 'TRUE' ? 'True' : 'False'}`}
                                </p>
                                {question.explanation_fa !== null && question.explanation_fa !== '' && (
                                    <p className="m-0 text-[0.78rem] leading-6 text-muted">{question.explanation_fa}</p>
                                )}
                                {question.evidence !== null && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onShowEvidence({
                                                pageKey: question.evidence!.page_key,
                                                start: question.evidence!.start_utf16,
                                                end: question.evidence!.end_utf16,
                                            })
                                        }
                                        className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[0.7rem] font-bold text-primary"
                                    >
                                        <Eye size={13} aria-hidden="true" />
                                        نمایش جای پاسخ در متن
                                    </button>
                                )}
                            </div>
                        )}
                    </article>
                );
            })}

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    disabled={answered === 0}
                    onClick={() => setSubmitted(true)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-surface hover:bg-primary-hover disabled:opacity-50"
                >
                    <Check size={16} aria-hidden="true" />
                    ثبت پاسخ‌ها
                </button>
                {submitted && (
                    <span role="status" className="text-sm font-bold text-muted">
                        نتیجه: {score.toLocaleString('fa-IR')} از {questions.length.toLocaleString('fa-IR')}
                    </span>
                )}
            </div>
        </section>
    );
}

const POS_LABELS: Record<string, string> = {
    n: 'اسم',
    noun: 'اسم',
    v: 'فعل',
    verb: 'فعل',
    adj: 'صفت',
    adjective: 'صفت',
    adv: 'قید',
    adverb: 'قید',
    prep: 'حرف اضافه',
    preposition: 'حرف اضافه',
    pron: 'ضمیر',
    pronoun: 'ضمیر',
    conj: 'حرف ربط',
    conjunction: 'حرف ربط',
    num: 'عدد',
    number: 'عدد',
    det: 'حرف تعریف',
    determiner: 'حرف تعریف',
};

function posLabel(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    return POS_LABELS[value.toLowerCase()] ?? POS_LABELS[value.toLowerCase().slice(0, 3)] ?? value;
}

interface PosTableProps {
    chapters: ReadingChapter[];
}

/**
 * Part-of-speech table: the book's vocabulary rows with the label blank.
 * The learner writes the label (Persian or n/v/adj/adv) and can reveal the
 * answer at any time. Words keep the order they first appear in the book.
 */
export function PartOfSpeechTable({ chapters }: PosTableProps): React.JSX.Element | null {
    const rows = React.useMemo<ReadingWord[]>(() => {
        const seen = new Set<string>();
        const out: ReadingWord[] = [];
        for (const chapter of chapters) {
            for (const page of chapter.pages) {
                for (const word of page.words) {
                    const key = word.word.toLowerCase();
                    if (seen.has(key) || posLabel(word.part_of_speech) === null) {
                        continue;
                    }
                    seen.add(key);
                    out.push(word);
                    if (out.length >= 12) {
                        return out;
                    }
                }
            }
        }

        return out;
    }, [chapters]);

    const [values, setValues] = React.useState<Record<string, string>>({});
    const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});
    const [checked, setChecked] = React.useState(false);

    if (rows.length === 0) {
        return null;
    }

    const normalized = (value: string): string => value.trim().toLowerCase();
    const isCorrect = (word: ReadingWord): boolean => {
        const expected = posLabel(word.part_of_speech);
        const given = normalized(values[word.word] ?? '');
        if (expected === null || given === '') {
            return false;
        }

        return given === normalized(expected) || given === normalized(word.part_of_speech ?? '');
    };

    return (
        <details className="group rounded-3xl border border-line bg-surface">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="font-extrabold text-ink">جدول part of speech</span>
                <span className="text-xs text-muted">جای خالی را کامل کن</span>
            </summary>
            <div className="grid gap-3 border-t border-line p-4">
                <p className="m-0 text-sm leading-7 text-muted">
                    نقش هر واژه را بنویس: اسم، فعل، صفت، قید یا حرف اضافه. هر وقت خواستی، جواب را ببین.
                </p>
                <div className="grid gap-2">
                    {rows.map((word) => {
                        const expected = posLabel(word.part_of_speech);
                        const correct = isCorrect(word);
                        return (
                            <div key={word.word} className="grid gap-2 rounded-2xl border border-line bg-canvas p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                                <div className="min-w-0">
                                    <p lang="en" dir="ltr" className="m-0 font-en text-sm font-bold text-ink">
                                        {word.word}
                                    </p>
                                    {word.meaning_fa !== null && word.meaning_fa !== '' && (
                                        <p className="m-0 text-xs leading-6 text-muted">{word.meaning_fa}</p>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="sr-only" htmlFor={`pos-${word.word}`}>نقش واژه {word.word}</label>
                                    <input
                                        id={`pos-${word.word}`}
                                        type="text"
                                        value={values[word.word] ?? ''}
                                        onChange={(event) => setValues((current) => ({ ...current, [word.word]: event.target.value }))}
                                        placeholder="نقش واژه"
                                        className="min-h-10 w-36 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setRevealed((current) => ({ ...current, [word.word]: !current[word.word] }))}
                                        className="inline-flex min-h-10 items-center gap-1 rounded-full border border-line bg-surface px-3 text-xs font-bold text-primary"
                                    >
                                        <Eye size={13} aria-hidden="true" />
                                        {revealed[word.word] === true ? 'پنهان کردن' : 'دیدن جواب'}
                                    </button>
                                    {revealed[word.word] === true && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink">
                                            {expected}
                                        </span>
                                    )}
                                    {checked && (
                                        <span className={correct ? 'text-xs font-bold text-success' : 'text-xs font-bold text-danger'}>
                                            {correct ? 'درست' : 'دوباره تلاش کن'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={() => setChecked(true)}
                    className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-surface hover:bg-primary-hover"
                >
                    <Check size={16} aria-hidden="true" />
                    بررسی پاسخ‌ها
                </button>
            </div>
        </details>
    );
}
