import { Head, Link, router } from '@inertiajs/react';
import { Bookmark, CardSim, Gauge, GraduationCap, Home, Languages, LogOut, Settings as SettingsIcon, User } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * Account (SUB-01 presentation): profile line, subscription window, and
 * the current payment request with exactly one CTA. Pending grants no
 * access; rejected/cancelled point at a new purchase; approval keeps
 * living in the staff panel. Logout is a real session POST.
 */

interface RequestSummary {
    id: number;
    status: string;
    plan_name: string;
    url: string;
}

interface AccountProps extends SharedProps {
    user: {
        name: string;
        email: string;
        preferred_level: string | null;
        daily_goal_minutes: number;
    };
    subscription: {
        active: boolean;
        expires_at: string | null;
    } | null;
    openRequest: RequestSummary | null;
    latestRequest: RequestSummary | null;
}

function statusLabel(status: string): string {
    switch (status) {
        case 'awaiting_receipt':
            return 'در انتظار رسید';
        case 'pending':
            return 'در صف بررسی';
        case 'rejected':
            return 'رد شده';
        case 'cancelled':
            return 'لغو شده';
        case 'approved':
            return 'تأیید شده';
        default:
            return status;
    }
}

export const AccountIndex: FunctionComponent<AccountProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    user,
    subscription,
    openRequest,
    latestRequest,
}: AccountProps): React.JSX.Element => {
    const logout = (event: React.FormEvent): void => {
        event.preventDefault();
        router.post('/logout');
    };

    return (
        <>
            <Head title="حساب" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <div>
                    <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">حساب</h1>
                    <p className="m-0 mt-2 inline-flex items-center gap-1.5 leading-8 text-muted">
                        <User size={16} aria-hidden="true" />
                        وارد شده به‌عنوان <span dir="ltr" lang="en" className="font-en break-all">{user.email}</span>
                    </p>
                    <p className="m-0 mt-1 leading-8 text-muted">
                        {user.name} ·{' '}
                        <span className="inline-flex items-center gap-1">
                            <Gauge size={16} aria-hidden="true" />
                            سطح ترجیحی: {user.preferred_level ?? 'انتخاب نشده'}
                        </span>{' '}
                        · هدف روزانه: {user.daily_goal_minutes} دقیقه
                    </p>
                </div>

                <section aria-label="وضعیت پرداخت و اشتراک" className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
                    <h2 className="m-0 flex items-center gap-2 text-xl leading-8">
                        <CardSim size={20} aria-hidden="true" />
                        اشتراک و پرداخت
                    </h2>
                    {subscription !== null && subscription.active ? (
                        <p className="m-0 leading-8">اشتراک فعال تا {subscription.expires_at ?? ''}</p>
                    ) : (
                        <p className="m-0 leading-8 text-muted">هنوز اشتراک فعالی وجود ندارد.</p>
                    )}
                    {openRequest !== null ? (
                        <>
                            <p className="m-0 leading-8">درخواست جاری: {statusLabel(openRequest.status)}</p>
                            <p className="m-0">
                                <Link
                                    href={openRequest.url}
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    مشاهده درخواست
                                </Link>
                            </p>
                        </>
                    ) : latestRequest !== null && (latestRequest.status === 'rejected' || latestRequest.status === 'cancelled') ? (
                        <>
                            <p className="m-0 leading-8">آخرین درخواست: {statusLabel(latestRequest.status)}</p>
                            <p className="m-0">
                                <Link
                                    href="/app/subscribe"
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    انتخاب پلن
                                </Link>
                            </p>
                        </>
                    ) : (
                        <p className="m-0">
                            <Link
                                href="/app/subscribe"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                <CardSim size={20} aria-hidden="true" />
                                انتخاب پلن
                            </Link>
                        </p>
                    )}
                </section>

                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/app/today"
                        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                    >
                        <Home size={20} aria-hidden="true" />
                        امروز
                    </Link>
                    <Link
                        href="/app/saved"
                        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                    >
                        <Bookmark size={20} aria-hidden="true" />
                        ذخیره‌شده‌ها
                    </Link>
                    <Link
                        href="/app/words"
                        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                    >
                        <Languages size={20} aria-hidden="true" />
                        واژه‌ها
                    </Link>
                    <Link
                        href="/app/account/settings"
                        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                    >
                        <SettingsIcon size={20} aria-hidden="true" />
                        تنظیمات
                    </Link>
                    <Link
                        href="/app/placement"
                        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                    >
                        <GraduationCap size={20} aria-hidden="true" />
                        تعیین سطح
                    </Link>
                </div>

                <form onSubmit={logout}>
                    <button
                        type="submit"
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink hover:bg-canvas"
                    >
                        <LogOut size={20} aria-hidden="true" />
                        خروج از حساب
                    </button>
                </form>
            </div>
        </>
    );
};

AccountIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default AccountIndex;
