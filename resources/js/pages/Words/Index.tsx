import { Head, Link, router } from '@inertiajs/react';
import { BookOpen, Check, CheckCheck, Compass, Download, Inbox, Pencil, Play, RotateCcw, Search, Upload, X } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import { csrfToken, postJson } from '@/lib/http';
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

function WordCard({ entry, onChanged }: { entry: WordRow; onChanged: (message: string) => void }): React.JSX.Element {
    const [editing, setEditing] = React.useState(false);
    const [meaning, setMeaning] = React.useState(entry.meaning_fa ?? '');
    const [example, setExample] = React.useState(entry.example_en ?? '');
    const [busy, setBusy] = React.useState(false);
    const [formStatus, setFormStatus] = React.useState('');

    const reload = (): void => {
        router.reload({ only: ['words', 'pagination', 'dueCount', 'learningCount', 'knownCount'] });
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
            onChanged('تغییرات واژه ذخیره شد.');
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
            onChanged(target === 'known' ? 'واژه «می‌دانم» شد.' : 'واژه به یادگیری برگشت.');
            reload();
        } else {
            onChanged(result.message);
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
            onChanged('واژه حذف شد.');
            reload();
        } else {
            onChanged(result.message);
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
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setEditing(!editing)}
                    aria-expanded={editing ? 'true' : 'false'}
                    aria-controls={`words-edit-${entry.id}`}
                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-[0.9375rem] text-ink hover:bg-canvas"
                >
                    <Pencil size={20} aria-hidden="true" />
                    ویرایش
                </button>
                {entry.status === 'learning' ? (
                    <button
                        type="button"
                        onClick={() => void toggleKnown()}
                        disabled={busy}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-[0.9375rem] text-ink hover:bg-canvas disabled:opacity-60"
                    >
                        <Check size={20} aria-hidden="true" />
                        می‌دانم شد
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => void toggleKnown()}
                        disabled={busy}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-[0.9375rem] text-ink hover:bg-canvas disabled:opacity-60"
                    >
                        <RotateCcw size={20} aria-hidden="true" />
                        برگردان به یادگیری
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => void remove()}
                    disabled={busy}
                    aria-label={`حذف ${entry.word}`}
                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-[0.9375rem] text-danger hover:bg-canvas disabled:opacity-60"
                >
                    <X size={20} aria-hidden="true" />
                    حذف
                </button>
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
    const [importStatus, setImportStatus] = React.useState('');
    const [importBusy, setImportBusy] = React.useState(false);
    const [confirmKnown, setConfirmKnown] = React.useState(false);
    const [knownBusy, setKnownBusy] = React.useState(false);
    const [fileName, setFileName] = React.useState('');
    const importRef = React.useRef<HTMLInputElement | null>(null);

    const reloadWords = (): void => {
        router.reload({ only: ['words', 'pagination', 'dueCount', 'learningCount', 'knownCount'] });
    };

    const importCsv = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();
        const file = importRef.current?.files?.[0];
        if (file === undefined || importBusy) {
            setImportStatus('یک فایل CSV انتخاب کنید.');
            return;
        }
        setImportBusy(true);
        setImportStatus('');
        const form = new FormData();
        form.append('file', file);
        try {
            const response = await fetch('/app/words/import', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                body: form,
            });
            const data = (await response.json().catch(() => null)) as
                | { created?: number; updated?: number; skipped?: number; message?: string; errors?: Record<string, string[]> }
                | null;
            if (response.ok) {
                setImportStatus(
                    `${data?.created ?? 0} واژه تازه، ${data?.updated ?? 0} به‌روزرسانی، ${data?.skipped ?? 0} رد شد.`,
                );
                if (importRef.current !== null) {
                    importRef.current.value = '';
                }
                reloadWords();
            } else {
                const firstError = data?.errors !== undefined ? Object.values(data.errors).flat()[0] : undefined;
                setImportStatus(firstError ?? data?.message ?? 'ورود CSV ممکن نشد.');
            }
        } catch {
            setImportStatus('ورود CSV ممکن نشد. اتصال را بررسی کنید.');
        } finally {
            setImportBusy(false);
        }
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
                setStatus(`${data?.known ?? 0} واژه «می‌دانم» شد.`);
                setConfirmKnown(false);
                reloadWords();
            } else {
                setStatus(data?.message ?? 'تغییر وضعیت واژه‌ها ممکن نشد.');
            }
        } catch {
            setStatus('تغییر وضعیت واژه‌ها ممکن نشد. اتصال را بررسی کنید.');
        } finally {
            setKnownBusy(false);
        }
    };

    const tabs = [
        { key: 'all', label: 'همه' },
        { key: 'due', label: `موعد امروز (${dueCount})` },
        { key: 'learning', label: `در حال یادگیری (${learningCount})` },
        { key: 'known', label: `می‌دانم (${knownCount})` },
    ];

    return (
        <>
            <Head title="واژه‌ها" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <div>
                    <h1 className="fe-title m-0 text-3xl">واژه‌ها</h1>
                    <p className="fe-prose m-0 mt-2 text-[1.0625rem] text-muted">دفترچه واژه‌های خودت — از درس‌ها ذخیره کن، سر موعد مرور کن.</p>
                </div>

                <div className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href="/app/words/export"
                            download
                            className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-full border border-line bg-canvas px-4 py-2 text-[0.9375rem] text-ink no-underline hover:bg-surface"
                        >
                            <Download size={18} aria-hidden="true" />
                            خروجی CSV
                        </a>
                        {learningCount > 0 && (
                            confirmKnown ? (
                                <span className="inline-flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void markAllKnown()}
                                        disabled={knownBusy}
                                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[0.9375rem] font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                                    >
                                        <CheckCheck size={18} aria-hidden="true" />
                                        بله، همه را می‌دانم
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmKnown(false)}
                                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center rounded-full border border-line bg-canvas px-4 py-2 text-[0.9375rem] text-ink hover:bg-surface"
                                    >
                                        لغو
                                    </button>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmKnown(true)}
                                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-canvas px-4 py-2 text-[0.9375rem] text-ink hover:bg-surface"
                                >
                                    <CheckCheck size={18} aria-hidden="true" />
                                    همه را می‌دانم
                                </button>
                            )
                        )}
                    </div>
                    <form onSubmit={(event) => void importCsv(event)} className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center">
                        <label htmlFor="words-import" className="inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-bold">
                            <Upload size={18} aria-hidden="true" />
                            ورود از CSV
                        </label>
                        <input
                            ref={importRef}
                            id="words-import"
                            name="file"
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? '')}
                            className="sr-only"
                        />
                        <label
                            htmlFor="words-import"
                            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-canvas px-4 py-2 text-[0.9375rem] font-bold text-ink hover:bg-surface"
                        >
                            انتخاب فایل CSV
                        </label>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted">
                            {fileName !== '' ? fileName : 'فایلی انتخاب نشده'}
                        </span>
                        <button
                            type="submit"
                            disabled={importBusy}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                        >
                            <Upload size={18} aria-hidden="true" />
                            {importBusy ? 'در حال بارگذاری…' : 'بارگذاری'}
                        </button>
                    </form>
                    <p className="m-0 text-sm leading-7 text-muted">
                        ستون‌های word، meaning_fa و example_en. حداکثر ۵۰۰ واژه در هر فایل.
                    </p>
                    {importStatus !== '' && (
                        <p role="status" className="m-0 text-sm leading-7 text-muted">
                            {importStatus}
                        </p>
                    )}
                </div>

                <nav aria-label="وضعیت واژه‌ها">
                    <div role="group" aria-label="وضعیت واژه‌ها" className="flex flex-wrap gap-2">
                        {tabs.map((item) => (
                            <Link
                                key={item.key}
                                href={tabHref(item.key, activeQuery)}
                                aria-current={tab === item.key ? 'page' : undefined}
                                className={
                                    tab === item.key
                                        ? 'inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-4 py-2 font-bold text-surface no-underline'
                                        : 'inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas'
                                }
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </nav>

                <form method="get" action="/app/words" role="search" aria-label="جست‌وجو در واژه‌ها" className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
                    <input type="hidden" name="tab" value={tab} />
                    <label htmlFor="words-q" className="inline-flex items-center gap-1.5 font-bold">
                        <Search size={16} aria-hidden="true" />
                        جست‌وجو در واژه‌ها
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            id="words-q"
                            name="q"
                            type="search"
                            defaultValue={activeQuery ?? ''}
                            autoComplete="off"
                            className="min-h-11 w-full min-w-0 flex-1 rounded-full border border-field bg-surface px-4 py-2 text-base text-ink"
                        />
                        <button
                            type="submit"
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 font-bold text-surface hover:bg-primary-hover"
                        >
                            <Search size={20} aria-hidden="true" />
                            جست‌وجو
                        </button>
                    </div>
                    {activeQuery !== null && activeQuery !== '' && (
                        <p className="m-0">
                            <Link
                                href={tab === 'all' ? '/app/words' : `/app/words?tab=${tab}`}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2 text-ink no-underline hover:bg-surface"
                            >
                                <X size={20} aria-hidden="true" />
                                پاک کردن جست‌وجو
                            </Link>
                        </p>
                    )}
                </form>

                {dueCount > 0 ? (
                    <p className="m-0">
                        <Link
                            href="/app/words/review"
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                        >
                            <Play size={20} aria-hidden="true" />
                            شروع مرور ({dueCount} واژه)
                        </Link>
                    </p>
                ) : (
                    learningCount > 0 && (
                        <p role="status" className="m-0 leading-8 text-muted">واژه‌ای برای مرور امروز نیست. فردا دوباره سر بزن.</p>
                    )
                )}

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
                                <p className="m-0 leading-8 text-muted">از تب «در حال یادگیری» یک واژه را «می‌دانم» کن.</p>
                            </>
                        ) : (
                            <>
                                <p className="m-0 text-xl font-bold">هنوز واژه‌ای ذخیره نکرده‌ای. از صفحه هر درس، واژه‌های کلیدی را ذخیره کن.</p>
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
                    <>
                        <ul className="m-0 grid list-none divide-y divide-line rounded-3xl border border-line bg-surface px-5 p-0">
                            {words.map((entry) => (
                                <WordCard key={entry.id} entry={entry} onChanged={setStatus} />
                            ))}
                        </ul>
                    </>
                )}

                <p id="words-status" role="status" className="m-0 text-sm leading-7 text-muted">
                    {status}
                </p>

                {pagination.last_page > 1 && (
                    <nav aria-label="صفحه‌های واژه‌ها">
                        <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
                            {Array.from({ length: pagination.last_page }, (_, index) => index + 1).map((page) => (
                                <li key={page}>
                                    <Link
                                        href={wordsHref(tab, activeQuery, page)}
                                        aria-label={`صفحه ${page}`}
                                        aria-current={page === pagination.current_page ? 'page' : undefined}
                                        className={
                                            page === pagination.current_page
                                                ? 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-primary px-4 py-2 font-en font-bold text-surface no-underline'
                                                : 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface px-4 py-2 font-en text-ink no-underline hover:bg-canvas'
                                        }
                                    >
                                        <span lang="en" dir="ltr">
                                            {page}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
            </div>
        </>
    );
};

WordsIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default WordsIndex;
