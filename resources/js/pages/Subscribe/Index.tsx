import { Head, useForm, usePage } from '@inertiajs/react';
import { CardSim, Check, CircleAlert, Inbox } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SupportNote } from '@/components/SupportNote';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * Subscribe (PAY-01 entry): the active plan list with the sales switch.
 * Prices stay visible while sales are closed; only the purchase action is
 * disabled. Choosing a plan posts its ID only — amount, duration,
 * destination, and status are server-owned and any client-sent copy is
 * rejected with 422 and nothing stored.
 */

interface PlanRow {
    id: number;
    name_fa: string;
    price_label: string;
    duration_days: number;
}

interface SubscribeProps extends SharedProps {
    plans: PlanRow[];
    salesOn: boolean;
    paymentReady: boolean;
    paymentNotice: string | null;
    activationSms: boolean;
}

export const SubscribeIndex: FunctionComponent<SubscribeProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    plans,
    salesOn,
    paymentReady,
    paymentNotice,
    activationSms,
}: SubscribeProps): React.JSX.Element => {
    const { errors, status } = usePage<SharedProps>().props;
    const form = useForm({ plan_id: 0 });

    const choose = (planId: number): void => {
        form.setData('plan_id', planId);
        form.post('/app/payments');
    };

    return (
        <>
            <Head title="انتخاب پلن" />
            <ScreenHeader
                title="انتخاب پلن"
                width="reading"
                back={{ href: '/app/account', label: 'بازگشت به حساب' }}
            />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-5">
                <p className="m-0 text-[1.0625rem] leading-8 text-muted">
                    پلن را انتخاب کن، مبلغ را کارت‌به‌کارت کن و رسید را بفرست.
                    {activationSms
                        ? ' بعد از تأیید، اشتراک فعال می‌شود و یک پیامک تأیید برای موبایلت می‌آید.'
                        : ' بعد از تأیید، اشتراک فعال می‌شود.'}
                </p>

                {status !== null && (
                    <p role="status" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-muted">
                        {status}
                    </p>
                )}

                {!salesOn && (
                    <div role="status" className="grid gap-2 rounded-3xl border border-line bg-surface p-5">
                        <p className="m-0 flex items-center gap-2 text-lg font-bold">
                            <CardSim size={20} aria-hidden="true" />
                            فروش هنوز فعال نشده است
                        </p>
                        <p className="m-0 leading-8 text-muted">
                            قیمت پلن‌ها در همین صفحه آمده است؛ خرید پس از فعال‌شدن فروش امکان‌پذیر می‌شود.
                        </p>
                    </div>
                )}

                {salesOn && !paymentReady && paymentNotice !== null && (
                    <p role="status" className="m-0 flex items-start gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-muted">
                        <CircleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
                        {paymentNotice}
                    </p>
                )}

                {plans.length === 0 ? (
                    <div role="status" className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <Inbox size={24} aria-hidden="true" />
                        <p className="m-0 text-xl font-bold">در حال حاضر پلن فعالی وجود ندارد. لطفاً بعداً مراجعه کنید.</p>
                    </div>
                ) : (
                    <ul className="m-0 grid list-none overflow-hidden rounded-2xl border border-line bg-surface p-0">
                        {plans.map((plan) => (
                            <li
                                key={plan.id}
                                className="grid gap-3 border-b border-line p-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5"
                            >
                                <div className="grid min-w-0 gap-1">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                        <h2 lang="fa" dir="rtl" className="m-0 text-base leading-7 font-bold">
                                            {plan.name_fa}
                                        </h2>
                                        <p className="m-0 text-lg leading-7 font-bold tabular-nums">{plan.price_label}</p>
                                    </div>
                                    <p className="m-0 text-sm leading-6 text-muted">
                                        {plan.duration_days.toLocaleString('fa-IR')} روز دسترسی، پس از تأیید پرداخت
                                    </p>
                                </div>
                                <p className="m-0 sm:justify-self-end">
                                    <button
                                        type="button"
                                        disabled={form.processing || !salesOn || !paymentReady}
                                        onClick={() => choose(plan.id)}
                                        className="inline-flex min-h-11 w-full min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                    >
                                        <Check size={20} aria-hidden="true" />
                                        {!salesOn
                                            ? 'فروش هنوز فعال نشده'
                                            : paymentReady
                                              ? 'انتخاب این پلن'
                                              : 'پرداخت هنوز فعال نشده'}
                                    </button>
                                </p>
                            </li>
                        ))}
                    </ul>
                )}

                {errors.plan_id !== undefined && (
                    <p role="alert" className="m-0 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-danger">
                        <CircleAlert size={20} aria-hidden="true" />
                        {errors.plan_id}
                    </p>
                )}

                <SupportNote />
            </div>
        </>
    );
};

SubscribeIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default SubscribeIndex;
