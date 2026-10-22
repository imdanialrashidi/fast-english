import { Head, Link, router } from '@inertiajs/react';
import {
    Bookmark,
    ChevronLeft,
    CreditCard,
    GraduationCap,
    History,
    LogOut,
    Settings as SettingsIcon,
    Sparkles,
} from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * Account (SUB-01 presentation): profile, subscription window, and the
 * current payment request with exactly one next action. Pending grants no
 * access; rejected/cancelled point at a new purchase; approval keeps
 * living in the staff panel. Logout is a real session POST.
 *
 * The page reads as an app profile screen: identity card, one status
 * card, a quiet settings list, and the logout action. Main navigation
 * stays in the bottom tabs / desktop rail, so it is not repeated here.
 */

interface RequestSummary {
    id: number;
    status: string;
    plan_name: string;
    url: string;
}

interface PaymentHistoryRow {
    id: number;
    status: string;
    plan_name: string;
    amount_label: string;
    created_at: string | null;
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
        state: 'active' | 'expired' | 'revoked';
        expires_at: string | null;
    } | null;
    openRequest: RequestSummary | null;
    latestRequest: RequestSummary | null;
    paymentHistory: PaymentHistoryRow[];
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

const dateFormatter = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

function formatDate(value: string | null): string | null {
    if (value === null || value === '') {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function MenuRow({
    href,
    icon,
    label,
    hint,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    hint?: string;
}): React.JSX.Element {
    return (
        <Link
            href={href}
            className="flex min-h-11 items-center gap-3 border-b border-line px-4 py-3.5 text-ink no-underline last:border-b-0 hover:bg-canvas"
        >
            <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-primary">
                {icon}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-bold">{label}</span>
                {hint !== undefined && <span className="mt-0.5 block text-sm leading-6 text-muted">{hint}</span>}
            </span>
            <ChevronLeft size={18} aria-hidden="true" className="shrink-0 text-muted" />
        </Link>
    );
}

export const AccountIndex: FunctionComponent<AccountProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    user,
    subscription,
    openRequest,
    latestRequest,
    paymentHistory,
}: AccountProps): React.JSX.Element => {
    const logout = (event: React.FormEvent): void => {
        event.preventDefault();
        router.post('/logout');
    };

    const initial = Array.from(user.name.trim())[0] ?? '؟';
    const expiresAt = formatDate(subscription?.expires_at ?? null);
    const active = subscription?.active === true;
    const stateLabel =
        subscription === null ? 'بدون اشتراک' : active ? 'فعال' : subscription.state === 'revoked' ? 'لغو شده' : 'منقضی شده';

    return (
        <>
            <Head title="حساب" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <section aria-label="پروفایل" className="rounded-3xl border border-line bg-surface p-5">
                    <div className="flex items-center gap-4">
                        <span
                            aria-hidden="true"
                            className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary font-en text-2xl font-extrabold text-surface"
                        >
                            {initial}
                        </span>
                        <div className="min-w-0">
                            <h1 className="fe-title m-0 truncate text-2xl" dir="auto">{user.name}</h1>
                            <p dir="ltr" className="m-0 mt-0.5 truncate text-end font-en text-sm leading-6 text-muted">
                                {user.email}
                            </p>
                        </div>
                    </div>
                    <dl className="m-0 mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
                        <div>
                            <dt className="m-0 flex items-center gap-1.5 text-sm text-muted">
                                <GraduationCap size={16} aria-hidden="true" />
                                سطح ترجیحی
                            </dt>
                            <dd className="m-0 mt-1 font-bold">
                                {user.preferred_level !== null ? (
                                    <span lang="en" dir="ltr" className="font-en">
                                        {user.preferred_level}
                                    </span>
                                ) : (
                                    'انتخاب نشده'
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="m-0 flex items-center gap-1.5 text-sm text-muted">
                                <Sparkles size={16} aria-hidden="true" />
                                هدف روزانه
                            </dt>
                            <dd className="m-0 mt-1 font-bold">{user.daily_goal_minutes.toLocaleString('fa-IR')} دقیقه</dd>
                        </div>
                    </dl>
                </section>

                <section aria-label="وضعیت پرداخت و اشتراک" className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="m-0 flex items-center gap-2 text-xl leading-8">
                            <CreditCard size={20} aria-hidden="true" />
                            اشتراک
                        </h2>
                        <span
                            className={
                                active
                                    ? 'inline-flex shrink-0 items-center rounded-full bg-canvas px-3 py-1 text-sm font-bold text-success'
                                    : 'inline-flex shrink-0 items-center rounded-full bg-canvas px-3 py-1 text-sm font-bold text-muted'
                            }
                        >
                            {stateLabel}
                        </span>
                    </div>

                    {active ? (
                        <p className="fe-prose m-0">
                            اشتراک فعال تا{' '}
                            <span className="font-bold">
                                {expiresAt ?? 'پایان دوره'}
                            </span>
                        </p>
                    ) : subscription?.state === 'revoked' ? (
                        <p className="fe-prose m-0 text-muted">اشتراک فعالی وجود ندارد.</p>
                    ) : (
                        <p className="fe-prose m-0 text-muted">
                            اشتراک فعالی وجود ندارد.
                            {subscription !== null && expiresAt !== null && (
                                <>
                                    {' '}دوره قبلی تا <span className="font-bold">{expiresAt}</span> بود.
                                </>
                            )}
                        </p>
                    )}

                    {openRequest !== null ? (
                        <>
                            <p className="fe-prose m-0">
                                درخواست جاری: <span className="font-bold">{statusLabel(openRequest.status)}</span>
                            </p>
                            <p className="m-0">
                                <Link
                                    href={openRequest.url}
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    مشاهده درخواست
                                </Link>
                            </p>
                        </>
                    ) : (
                        <>
                            {latestRequest !== null &&
                                (latestRequest.status === 'rejected' || latestRequest.status === 'cancelled') && (
                                    <p className="fe-prose m-0 text-muted">
                                        آخرین درخواست: <span className="font-bold">{statusLabel(latestRequest.status)}</span>
                                    </p>
                                )}
                            {active ? (
                                <>
                                    <p className="m-0">
                                        <Link
                                            href="/app/subscribe"
                                            className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                        >
                                            <CreditCard size={20} aria-hidden="true" />
                                            تمدید اشتراک
                                        </Link>
                                    </p>
                                    <p className="fe-meta m-0 text-muted">تمدید از پایان دوره فعلی ادامه پیدا می‌کند.</p>
                                </>
                            ) : (
                                <p className="m-0">
                                    <Link
                                        href="/app/subscribe"
                                        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                                    >
                                        <CreditCard size={20} aria-hidden="true" />
                                        انتخاب پلن
                                    </Link>
                                </p>
                            )}
                        </>
                    )}
                </section>

                <section aria-label="تاریخچه پرداخت" className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
                    <h2 className="m-0 flex items-center gap-2 text-xl leading-8">
                        <History size={20} aria-hidden="true" />
                        تاریخچه پرداخت
                    </h2>
                    {paymentHistory.length === 0 ? (
                        <p className="fe-prose m-0 text-muted">هنوز درخواست پرداختی ثبت نکرده‌ای.</p>
                    ) : (
                        <ul className="m-0 grid list-none divide-y divide-line p-0">
                            {paymentHistory.map((row) => (
                                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                                    <div className="min-w-0">
                                        <p className="m-0 font-bold">{row.plan_name}</p>
                                        <p className="fe-meta m-0 text-muted">
                                            {row.created_at !== null ? formatDate(row.created_at) : '—'} · {row.amount_label}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-canvas px-3 py-1 text-sm font-bold text-muted">
                                            {statusLabel(row.status)}
                                        </span>
                                        <Link
                                            href={row.url}
                                            className="inline-flex min-h-11 min-w-11 items-center text-[0.9375rem] text-primary no-underline"
                                        >
                                            جزئیات
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <nav aria-label="تنظیمات حساب" className="overflow-hidden rounded-3xl border border-line bg-surface">
                    <MenuRow href="/app/account/settings" icon={<SettingsIcon size={18} />} label="تنظیمات حساب" hint="نام، سطح و هدف روزانه" />
                    <MenuRow href="/app/saved" icon={<Bookmark size={18} />} label="ذخیره‌شده‌ها" hint="مطلب‌هایی که برای بعد نگه داشته‌ای" />
                    <MenuRow href="/app/placement" icon={<GraduationCap size={18} />} label="تعیین سطح" hint="آزمون اختیاری برای پیدا کردن سطح مناسب" />
                </nav>

                <form onSubmit={logout}>
                    <button
                        type="submit"
                        className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 font-bold text-danger hover:bg-canvas"
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
