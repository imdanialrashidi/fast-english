import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Check, GraduationCap, Settings as SettingsIcon } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
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

export const PlacementResult: FunctionComponent<PlacementResultProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    attempt,
}: PlacementResultProps): React.JSX.Element => {
    const { status } = usePage<SharedProps>().props;
    const form = useForm({});

    const accept = (event: React.FormEvent): void => {
        event.preventDefault();
        form.post(`/app/placement/${attempt.id}/accept`, { preserveScroll: true });
    };

    return (
        <>
            <Head title="نتیجه تعیین سطح" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">نتیجه تعیین سطح</h1>

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
                        نمره: {attempt.score} از ۲۰
                    </p>
                    <p className="m-0 text-lg leading-8">
                        سطح پیشنهادی:{' '}
                        <span lang="en" dir="ltr" className="font-en font-bold">
                            {attempt.recommended_level ?? '—'}
                        </span>
                    </p>
                    <p className="m-0 leading-8 text-muted">راهنمای اولیه، بدون گواهی رسمی</p>
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
