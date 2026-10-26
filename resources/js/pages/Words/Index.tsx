import { Head, Link, router } from '@inertiajs/react';
import { BookOpen, Check, CheckCheck, Compass, Inbox, Pencil, Play, RotateCcw, Search, X } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { Pagination } from '@/components/Pagination';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Toast } from '@/components/Toast';
import AppLayout from '@/layouts/AppLayout';
import { postJson } from '@/lib/http';
import type { PaginationMeta, SharedProps } from '@/types';

/**
 * Vocabulary notebook (VOCAB-01): the student's own words with
 * due/learning/known tabs and search in the URL. Every mutation (edit,
 * known-toggle, remove) goes to the existing owner-scoped JSON
 * endpoints; the list refreshes only after the server confirms.
 */

interface WordRow {
    id: number;
    word: string;
    meaning_fa: string | null;
    example_en: string | null;
    status: string;
    is_due: boolean;
    due_at: string | null;
    lesson_level: string | null;
    reader_url: string | null;
}

interface WordsProps extends SharedProps {
    words: WordRow[];
    pagination: PaginationMeta;
    tab: string;
    activeQuery: string | null;
    dueCount: number;
    learningCount: number;
    knownCount: number;
}

async function mutateWord(
    id: number,
    method: 'PATCH' | 'DELETE',
    body?: unknown,
): Promise<{ ok: boolean; message: string }> {
    try {
        const response = await postJson(`/app/words/${id}`, body, method);
        if (response.ok) {
            return { ok: true, message: '' };
        }
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        return { ok: false, message: data?.message ?? 'تغییر واژه ممکن نشد. دوباره تلاش کنید.' };
    } catch {
        return { ok: false, message: 'تغییر واژه ممکن نشد. اتصال را بررسی کنید و دوباره تلاش کنید.' };
    }
}

function WordCard({ entry, onChanged }: { entry: WordRow; onChanged: (message: string, ok: boolean) => void }): React.JSX.Element {
    const [editing, setEditing] = React.useState(false);
    const [meaning, setMeaning] = React.useState(entry.meaning_fa ?? '');
    const [example, setExample] = React.useState(entry.example_en ?? '');
    const [busy, setBusy] = React.useState(false);
    const [confirmRemove, setConfirmRemove] = React.useState(false);
    const [formStatus, setFormStatus] = React.useState('');

    const reload = (): void => {
        router.reload({ only: ['words', 'pagination', 'dueCount', 'learningCount', 'knownCount', 'due_words'] });
    };

    const save = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();
        if (busy) {
            return;
        }
        setBusy(true);
        const result = await mutateWord(entry.id, 'PATCH', { meaning_fa: meaning, example_en: example });
        setBusy(false);
        if (result.ok) {
            setEditing(false);
            setFormStatus('');
            onChanged('تغییرات واژه ذخیره شد.', true);
            reload();
        } else {
            setFormStatus(result.message);
        }
    };

    const toggleKnown = async (): Promise<void> => {
        if (busy) {
            return;
        }
        setBusy(true);
        const target = entry.status === 'learning' ? 'known' : 'learning';
        const result = await mutateWord(entry.id, 'PATCH', { status: target });
        setBusy(false);
        if (result.ok) {
            onChanged(target === 'known' ? 'واژه «می‌دانم» شد.' : 'واژه به یادگیری برگشت.', true);
            reload();
        } else {
            onChanged(result.message, false);
        }
    };

    const remove = async (): Promise<void> => {
        if (busy) {
            return;
        }
        setBusy(true);
        const result = await mutateWord(entry.id, 'DELETE');
        setBusy(false);
        if (result.ok) {
            onChanged('واژه حذف شد.', true);
            reload();
        } else {
            onChanged(result.message, false);
        }
    };

    return (
        <li data-word-id={entry.id} className="grid gap-2 border-b border-line py-4 last:border-b-0">
            <div>
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span lang="en" dir="ltr" className="text-left font-en text-[1.0625rem] font-bold">
                        {entry.word}
                    </span>
                    {entry.status === 'known' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-2.5 py-0.5 text-sm">
                            <Check size={16} aria-hidden="true" />
                            می‌دانم
                        </span>
                    ) : entry.is_due ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-strong">
                            <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent-strong" />
                            موعد امروز
                        </span>
                    ) : (
                        <span className="text-sm text-muted">در حال یادگیری</span>
                    )}
                </p>
                {entry.meaning_fa !== null && entry.meaning_fa !== '' && (
                    <p dir="auto" className="m-0 mt-1 leading-8">
                        {entry.meaning_fa}
                    </p>
                )}
                {entry.example_en !== null && entry.example_en !== '' && (
                    <p lang="en" dir="ltr" className="m-0 mt-1 text-left font-en leading-7 text-muted">
                        {entry.example_en}
                    </p>
                )}
                {entry.reader_url !== null && (
                    <p className="m-0 mt-1">
                        <Link href={entry.reader_url} className="inline-flex min-h-11 min-w-11 items-center gap-1.5 text-[0.9375rem] text-primary no-underline">
                            <BookOpen size={16} aria-hidden="true" />
                            دیدن در متن اصلی{entry.lesson_level !== null && (
                                <>
                                    {' '}({entry.lesson_level})
                                </>
                            )}
                        </Link>
                    </p>
                )}
            </div>
            {/* Quiet row actions: one text line, not three bordered pills. */}
            <div className="flex flex-wrap items-center gap-1">
                <button
                    type="button"
                    onClick={() => setEditing(!editing)}
                    aria-expanded={editing ? 'true' : 'false'}
                    aria-controls={`words-edit-${entry.id}`}
                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-sm text-muted hover:bg-canvas hover:text-ink"
                >
                    <Pencil size={16} aria-hidden="true" />
                    ویرایش
                </button>
                {entry.status === 'learning' ? (
                    <button
                        type="button"
                        onClick={() => void toggleKnown()}
                        disabled={busy}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-sm text-muted hover:bg-canvas hover:text-ink disabled:opacity-60"
                    >
                        <Check size={16} aria-hidden="true" />
                        می‌دانم شد
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => void toggleKnown()}
                        disabled={busy}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-sm text-muted hover:bg-canvas hover:text-ink disabled:opacity-60"
                    >
                        <RotateCcw size={16} aria-hidden="true" />
                        برگردان
                    </button>
                )}
                {confirmRemove ? (
                    <span className="inline-flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => void remove()}
                            disabled={busy}
                            aria-label={`حذف قطعی ${entry.word}`}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-danger px-3 text-sm font-bold text-surface hover:opacity-90 disabled:opacity-60"
                        >
                            <X size={16} aria-hidden="true" />
                            بله، حذف
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmRemove(false)}
                            className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm text-muted hover:bg-canvas hover:text-ink"
                        >
                            لغو
                        </button>
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={() => setConfirmRemove(true)}
                        aria-label={`حذف ${entry.word}`}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-sm text-danger hover:bg-canvas"
                    >
                        <X size={16} aria-hidden="true" />
                        حذف
                    </button>
                )}
            </div>
            <form id={`words-edit-${entry.id}`} data-word-id={entry.id} hidden={!editing} onSubmit={(event) => void save(event)} className="grid gap-3 rounded-2xl border border-line bg-canvas p-4">
                <div className="grid gap-1.5">
                    <label htmlFor={`words-meaning-${entry.id}`} className="font-bold">معنی فارسی</label>
                    <input
                        id={`words-meaning-${entry.id}`}
                        name="meaning_fa"
                        type="text"
                        dir="auto"
                        maxLength={500}
                        value={meaning}
                        onChange={(event) => setMeaning(event.target.value)}
                        autoComplete="off"
                        className="min-h-11 w-full rounded-full border border-field bg-surface px-4 py-2 text-base text-ink"
                    />
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor={`words-example-${entry.id}`} className="font-bold">
                        نمونه جمله انگلیسی
                    </label>
                    <input
                        id={`words-example-${entry.id}`}
                        name="example_en"
                        type="text"
                        lang="en"
                        dir="ltr"
                        maxLength={500}
                        value={example}
                        onChange={(event) => setExample(event.target.value)}
                        autoComplete="off"
                        className="min-h-11 w-full rounded-full border border-field bg-surface px-4 py-2 text-left font-en text-base text-ink"
                    />
                </div>
                <div>
                    <button
                        type="submit"
                        disabled={busy}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                    >
                        <Check size={20} aria-hidden="true" />
                        ذخیره تغییرات
                    </button>
                </div>
                {formStatus !== '' && (
                    <p role="status" className="m-0 text-sm leading-7 text-muted">
                        {formStatus}
                    </p>
                )}
            </form>
        </li>
    );
}

function faCount(value: number): string {
    return value.toLocaleString('fa-IR');
}

function wordsHref(tab: string, query: string | null, page?: number): string {
    const params = new URLSearchParams();
    if (tab !== 'all') {
        params.set('tab', tab);
    }
    if (query !== null && query !== '') {
        params.set('q', query);
    }
    if (page !== undefined && page > 1) {
        params.set('page', String(page));
    }
    const suffix = params.toString();
    return suffix === '' ? '/app/words' : `/app/words?${suffix}`;
}

function tabHref(tab: string, query: string | null): string {
    return wordsHref(tab, query);
}

export const WordsIndex: FunctionComponent<WordsProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    words,
    pagination,
    tab,
    activeQuery,
    dueCount,
    learningCount,
    knownCount,
}: WordsProps): React.JSX.Element => {
    const [status, setStatus] = React.useState('');
    const [statusOk, setStatusOk] = React.useState(true);
    const [toast, setToast] = React.useState('');
    const [confirmKnown, setConfirmKnown] = React.useState(false);
    const [knownBusy, setKnownBusy] = React.useState(false);

    const reloadWords = (): void => {
        router.reload({ only: ['words', 'pagination', 'dueCount', 'learningCount', 'knownCount', 'due_words'] });
    };

    const markAllKnown = async (): Promise<void> => {
        if (knownBusy) {
            return;
        }
        setKnownBusy(true);
        setStatus('');
        try {
            const response = await postJson('/app/words/known');
            const data = (await response.json().catch(() => null)) as { known?: number; message?: string } | null;
            if (response.ok) {
                setStatus(`${faCount(data?.known ?? 0)} واژه «می‌دانم» شد.`);
                setStatusOk(true);
                setToast(`${faCount(data?.known ?? 0)} واژه «می‌دانم» شد.`);
                setConfirmKnown(false);
                reloadWords();
            } else {
                setStatus(data?.message ?? 'تغییر وضعیت واژه‌ها ممکن نشد.');
                setStatusOk(false);
            }
        } catch {
            setStatus('تغییر وضعیت واژه‌ها ممکن نشد. اتصال را بررسی کنید.');
            setStatusOk(false);
        } finally {
            setKnownBusy(false);
        }
    };

    const handleWordChanged = (message: string, ok: boolean): void => {
        setStatus(message);
        setStatusOk(ok);
        if (ok) {
            setToast(message);
        }
    };

    const submitSearch = (event: React.FormEvent<HTMLFormElement>): void => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const q = String(data.get('q') ?? '').trim();
        router.get(wordsHref(tab, q === '' ? null : q), {}, { preserveState: true, preserveScroll: true });
    };

    const tabs = [
        { key: 'all', label: 'همه', ariaLabel: 'همه واژه‌ها' },
        { key: 'due', label: `موعد (${faCount(dueCount)})`, ariaLabel: `موعد امروز (${faCount(dueCount)})` },
        { key: 'learning', label: `یادگیری (${faCount(learningCount)})`, ariaLabel: `در حال یادگیری (${faCount(learningCount)})` },
        { key: 'known', label: `می‌دانم (${faCount(knownCount)})`, ariaLabel: `می‌دانم (${faCount(knownCount)})` },
    ];

    return (
        <>
            <Head title="واژه‌ها" />
            <ScreenHeader title="واژه‌ها" width="reading" />
            <Toast message={toast} onClose={() => setToast('')} />
            <div className="mx-auto grid max-w-[680px] gap-4 px-4 py-5">
                {dueCount > 0 ? (
                    <p className="m-0">
                        <Link
                            href="/app/words/review"
                            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover sm:w-fit"
                        >
                            <Play size={20} aria-hidden="true" />
                            شروع مرور ({faCount(dueCount)} واژه)
                        </Link>
                    </p>
                ) : (
                    learningCount > 0 && (
                        <p role="status" className="m-0 leading-8 text-muted">واژه‌ای برای مرور امروز نیست. فردا دوباره سر بزن.</p>
                    )
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p role="status" aria-live="polite" data-total={pagination.total} className="m-0 text-sm text-muted">
                        {faCount(pagination.total)} واژه
                    </p>
                    {learningCount > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            {confirmKnown ? (
                                <span className="inline-flex flex-wrap items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => void markAllKnown()}
                                        disabled={knownBusy}
                                        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                                    >
                                        <CheckCheck size={16} aria-hidden="true" />
                                        بله، همه را می‌دانم
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmKnown(false)}
                                        className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-3 text-sm text-muted hover:bg-canvas hover:text-ink"
                                    >
                                        لغو
                                    </button>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmKnown(true)}
                                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-sm text-muted hover:bg-canvas hover:text-ink"
                                >
                                    <CheckCheck size={16} aria-hidden="true" />
                                    همه را می‌دانم
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <nav aria-label="وضعیت واژه‌ها" className="-mx-4 overflow-x-auto px-4">
                    <div role="group" aria-label="وضعیت واژه‌ها" className="flex w-max min-w-full gap-2 pb-1">
                        {tabs.map((item) => (
                            <Link
                                key={item.key}
                                href={tabHref(item.key, activeQuery)}
                                aria-label={item.ariaLabel}
                                aria-current={tab === item.key ? 'page' : undefined}
                                className={
                                    tab === item.key
                                        ? 'inline-flex min-h-11 min-w-11 shrink-0 items-center whitespace-nowrap rounded-full bg-primary px-3 py-2 text-sm font-bold text-surface no-underline'
                                        : 'inline-flex min-h-11 min-w-11 shrink-0 items-center whitespace-nowrap rounded-full border border-line bg-surface px-3 py-2 text-sm text-ink no-underline hover:bg-canvas'
                                }
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </nav>

                <form onSubmit={submitSearch} role="search" aria-label="جست‌وجوی واژه‌ها" className="flex items-center gap-2">
                    <label htmlFor="words-q" className="sr-only">
                        جست‌وجو در واژه‌ها
                    </label>
                    <input
                        key={activeQuery ?? ''}
                        id="words-q"
                        name="q"
                        type="search"
                        defaultValue={activeQuery ?? ''}
                        placeholder="جست‌وجو در واژه‌ها"
                        autoComplete="off"
                        className="min-h-11 w-full min-w-0 flex-1 rounded-full border border-field bg-surface px-4 py-2 text-base text-ink placeholder:text-muted"
                    />
                    <button
                        type="submit"
                        aria-label="جست‌وجو"
                        className="inline-flex h-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-3 font-bold text-surface hover:bg-primary-hover sm:px-5"
                    >
                        <Search size={18} aria-hidden="true" />
                        <span className="hidden text-sm sm:inline">جست‌وجو</span>
                    </button>
                </form>
                {activeQuery !== null && activeQuery !== '' && (
                    <Link
                        href={tab === 'all' ? '/app/words' : `/app/words?tab=${tab}`}
                        className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full px-2 text-sm font-bold text-muted no-underline hover:text-ink"
                    >
                        <X size={16} aria-hidden="true" />
                        پاک کردن جست‌وجو
                    </Link>
                )}

                <section
                    id="words-results"
                    tabIndex={-1}
                    aria-label="فهرست واژه‌ها"
                    className="scroll-mt-24 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                >
                {words.length === 0 ? (
                    <div role="status" className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <Inbox size={24} aria-hidden="true" />
                        {activeQuery !== null && activeQuery !== '' ? (
                            <>
                                <p className="m-0 text-xl font-bold">برای «{activeQuery}» چیزی پیدا نشد.</p>
                                <p className="m-0 leading-8 text-muted">واژه دیگری را امتحان کن یا جست‌وجو را پاک کن.</p>
                                <p className="m-0 mt-2">
                                    <Link
                                        href={tab === 'all' ? '/app/words' : `/app/words?tab=${tab}`}
                                        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                    >
                                        <X size={20} aria-hidden="true" />
                                        پاک کردن جست‌وجو
                                    </Link>
                                </p>
                            </>
                        ) : tab === 'due' ? (
                            <>
                                <p className="m-0 text-xl font-bold">واژه‌ای برای مرور امروز نیست.</p>
                                <p className="m-0 leading-8 text-muted">فردا دوباره سر بزن.</p>
                            </>
                        ) : tab === 'known' ? (
                            <>
                                <p className="m-0 text-xl font-bold">هنوز واژه‌ای را «می‌دانم» نکرده‌ای.</p>
                                <p className="m-0 leading-8 text-muted">از تب «یادگیری» یک واژه را «می‌دانم» کن.</p>
                            </>
                        ) : (
                            <>
                                <p className="m-0 text-lg leading-8 font-bold">هنوز واژه‌ای ذخیره نکرده‌ای.</p>
                                <p className="m-0 max-w-[30ch] leading-8 text-muted">
                                    از هر درس، واژه‌های کلیدی را ذخیره کن تا اینجا مرور شوند.
                                </p>
                                <p className="m-0 mt-2">
                                    <Link
                                        href="/app"
                                        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                    >
                                        <Compass size={20} aria-hidden="true" />
                                        کشف مطالب
                                    </Link>
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <ul className="m-0 grid list-none divide-y divide-line rounded-3xl border border-line bg-surface px-5 p-0">
                        {words.map((entry) => (
                            <WordCard key={entry.id} entry={entry} onChanged={handleWordChanged} />
                        ))}
                    </ul>
                )}
                </section>

                <p
                    id="words-status"
                    role={statusOk ? 'status' : 'alert'}
                    className={statusOk ? 'm-0 text-sm leading-7 text-muted' : 'm-0 text-sm leading-7 text-danger'}
                >
                    {status}
                </p>

                <Pagination
                    pagination={pagination}
                    hrefFor={(page) => wordsHref(tab, activeQuery, page)}
                    label="صفحه‌های واژه‌ها"
                    resultsId="words-results"
                />
            </div>
        </>
    );
};

WordsIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default WordsIndex;
