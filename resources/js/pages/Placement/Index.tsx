import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FileText, GraduationCap, Play, Settings as SettingsIcon } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * Placement entry (PLACE-01): optional 20-question test. Skippable by
 * design — the manual level path is always one link away. With no
 * current published version the neutral «در دست آماده‌سازی» state
 * shows and starting is refused server-side.
 */

interface PlacementIndexProps extends SharedProps {
    current: { version: string } | null;
    openAttempt: { id: number; url: string } | null;
}

export const PlacementIndex: FunctionComponent<PlacementIndexProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    current,
    openAttempt,
}: PlacementIndexProps): React.JSX.Element => {
    const { status, errors } = usePage<SharedProps>().props;
    const firstError = Object.values(errors)[0] ?? null;
    const form = useForm({});

    const start = (event: React.FormEvent): void => {
        event.preventDefault();
        form.post('/app/placement/start');
    };

    return (
        <>
            <Head title="تعیین سطح" />
            <ScreenHeader
                title="تعیین سطح (اختیاری)"
                width="reading"
                back={{ href: '/app/account', label: 'بازگشت به حساب' }}
            />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-5">
                <p className="m-0 text-[1.0625rem] leading-8 text-muted">
                    آزمون ۲۰ سؤالی، چهارگزینه‌ای. شرکت اختیاری است و نتیجه فقط راهنمای اولیه است.
                </p>

                {firstError !== null && (
                    <p role="alert" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-danger">
                        {firstError}
                    </p>
                )}

                {status !== null && (
                    <p role="status" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-muted">
                        {status}
                    </p>
                )}

                {current === null ? (
                    <div role="status" className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <GraduationCap size={24} aria-hidden="true" />
                        <p className="m-0 text-xl font-bold">آزمون در دست آماده‌سازی است.</p>
                        <p className="m-0 leading-8 text-muted">در دست آماده‌سازی — می‌توانید سطح خود را دستی انتخاب کنید.</p>
                        <p className="m-0 mt-2">
                            <Link
                                href="/app/account/settings"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <SettingsIcon size={20} aria-hidden="true" />
                                انتخاب دستی سطح
                            </Link>
                        </p>
                    </div>
                ) : openAttempt !== null ? (
                    <div className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <FileText size={24} aria-hidden="true" />
                        <p className="m-0 text-xl font-bold">یک آزمون ناتمام دارید.</p>
                        <p className="m-0 mt-2">
                            <Link
                                href={openAttempt.url}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <Play size={20} aria-hidden="true" />
                                ادامه آزمون
                            </Link>
                        </p>
                    </div>
                ) : (
                    <div className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <GraduationCap size={24} aria-hidden="true" />
                        <p className="m-0 text-xl font-bold">آزمون تعیین سطح — ۲۰ سؤال</p>
                        <p className="m-0 leading-8 text-muted">
                            در هر سؤال، جای خالی را با گزینهٔ درست کامل کنید. هر سؤال یک پاسخ صحیح دارد و پاسخ‌ها تک‌تک ذخیره می‌شوند.
                        </p>
                        <form onSubmit={start} className="m-0 mt-2">
                            <button
                                type="submit"
                                disabled={form.processing}
                                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                            >
                                <Play size={20} aria-hidden="true" />
                                شروع آزمون
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </>
    );
};

PlacementIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default PlacementIndex;
