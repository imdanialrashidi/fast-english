import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Check, GraduationCap, Settings as SettingsIcon } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * Placement result (PLACE-01): score + suggested level + the informal
 * disclaimer. Accepting writes preferred_level explicitly — the only
 * placement writer of that column. Browsing the result changes nothing.
 */

interface PlacementResultProps extends SharedProps {
    attempt: {
        id: number;
        score: number;
        recommended_level: string | null;
    };
}

// Standard CEFR label for the code the server stores. C2 is intentionally
// absent: the 20-item test recommends at most C1 (see PlacementLevel).
const LEVEL_LABELS: Record<string, string> = {
    A1: 'مبتدی',
    A2: 'پیش‌متوسط',
    B1: 'متوسط',
    B2: 'متوسط رو به بالا',
    C1: 'پیشرفته',
};

export const PlacementResult: FunctionComponent<PlacementResultProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    attempt,
}: PlacementResultProps): React.JSX.Element => {
    const { status, errors } = usePage<SharedProps>().props;
    const firstError = Object.values(errors)[0] ?? null;
    const levelLabel = attempt.recommended_level !== null ? (LEVEL_LABELS[attempt.recommended_level] ?? null) : null;
    const form = useForm({});

    const accept = (event: React.FormEvent): void => {
        event.preventDefault();
        form.post(`/app/placement/${attempt.id}/accept`, { preserveScroll: true });
    };

    return (
        <>
            <Head title="نتیجه تعیین سطح" />
            <ScreenHeader
                title="نتیجه تعیین سطح"
                width="reading"
                back={{ href: '/app/placement', label: 'بازگشت به تعیین سطح' }}
            />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-5">

                {firstError !== null && (
                    <p role="alert" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-danger">
                        {firstError}
                    </p>
                )}

                {status !== null && (
                    <p role="status" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-success">
                        {status}
                    </p>
                )}

                <div className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
                    <h2 className="m-0 flex items-center gap-2 text-xl leading-8">
                        <GraduationCap size={20} aria-hidden="true" />
                        کارنامه
                    </h2>
                    <p className="m-0 text-lg leading-8">
                        نمره: {attempt.score.toLocaleString('fa-IR')} از ۲۰
                    </p>
                    <p className="m-0 text-lg leading-8">
                        سطح پیشنهادی:{' '}
                        <span lang="en" dir="ltr" className="font-en font-bold">
                            {attempt.recommended_level ?? '—'}
                        </span>
                        {levelLabel !== null && <span className="text-muted"> ({levelLabel})</span>}
                    </p>
                    <p className="m-0 leading-8 text-muted">راهنمای اولیه، بدون گواهی رسمی</p>
                    {attempt.recommended_level === 'C1' && (
                        <p className="m-0 text-sm leading-7 text-muted">
                            این آزمون تا سطح C1 را می‌سنجد؛ برای C2 به ارزیابی گفتاری و نوشتاری نیاز است.
                        </p>
                    )}
                </div>

                <div className="grid justify-items-center gap-3 rounded-3xl border border-line bg-surface px-6 py-10 text-center">
                    <p className="m-0 leading-8 text-muted">
                        تأیید نتیجه، سطح ترجیحی شما را ذخیره می‌کند. مرور سطح‌ها بدون تأیید، سطح را تغییر نمی‌دهد.
                    </p>
                    <form onSubmit={accept} className="m-0">
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                        >
                            <Check size={20} aria-hidden="true" />
                            تأیید و ذخیره سطح ترجیحی
                        </button>
                    </form>
                    <p className="m-0">
                        <Link
                            href="/app/account/settings"
                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2 text-ink no-underline hover:bg-surface"
                        >
                            <SettingsIcon size={20} aria-hidden="true" />
                            انتخاب دستی سطح
                        </Link>
                    </p>
                </div>
            </div>
        </>
    );
};

PlacementResult.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default PlacementResult;
