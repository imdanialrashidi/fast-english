import { Head, useForm, usePage } from '@inertiajs/react';
import { CardSim, Check, CircleAlert, Inbox } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * Subscribe (PAY-01 entry): the active plan list with the sales switch.
 * Choosing a plan posts its ID only — amount, duration, destination,
 * and status are server-owned and any client-sent copy is rejected
 * with 422 and nothing stored.
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
}

export const SubscribeIndex: FunctionComponent<SubscribeProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    plans,
    salesOn,
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
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <div>
                    <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">انتخاب پلن</h1>
                    <p className="m-0 mt-2 text-[1.0625rem] leading-8 text-muted">پلن موردنظر را انتخاب کنید. مبلغ و مشخصات واریز از سمت سرور ثبت می‌شود.</p>
                </div>

                {status !== null && (
                    <p role="status" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-muted">
                        {status}
                    </p>
                )}

                {!salesOn ? (
                    <div role="status" className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <CardSim size={24} aria-hidden="true" />
                        <p className="m-0 text-xl font-bold">در دست آماده‌سازی</p>
                        <p className="m-0 leading-8 text-muted">فروش هنوز فعال نشده است. پلن‌ها پس از اعلام رسمی قابل خرید خواهند بود.</p>
                    </div>
                ) : plans.length === 0 ? (
                    <div role="status" className="grid justify-items-center gap-2 rounded-3xl border border-line bg-surface px-6 py-12 text-center">
                        <Inbox size={24} aria-hidden="true" />
                        <p className="m-0 text-xl font-bold">در حال حاضر پلن فعالی وجود ندارد. لطفاً بعداً مراجعه کنید.</p>
                    </div>
                ) : (
                    <ul className="m-0 grid list-none gap-4 p-0">
                        {plans.map((plan) => (
                            <li key={plan.id} className="grid gap-1 rounded-3xl border border-line bg-surface p-5">
                                <h2 lang="fa" dir="rtl" className="m-0 text-lg leading-8 font-bold">
                                    {plan.name_fa}
                                </h2>
                                <p className="m-0 text-lg font-bold">{plan.price_label}</p>
                                <p className="m-0 leading-8 text-muted">{plan.duration_days} روز دسترسی پس از تأیید</p>
                                <p className="m-0 mt-1">
                                    <button
                                        type="button"
                                        disabled={form.processing}
                                        onClick={() => choose(plan.id)}
                                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                                    >
                                        <Check size={20} aria-hidden="true" />
                                        انتخاب این پلن
                                    </button>
                                </p>
                            </li>
                        ))}
                    </ul>
                )}

                {errors.plan_id !== undefined && (
                    <p role="alert" className="m-0 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-danger">
                        <CircleAlert size={20} aria-hidden="true" />
                        انتخاب پلن نامعتبر بود. لطفاً دوباره تلاش کنید.
                    </p>
                )}
            </div>
        </>
    );
};

SubscribeIndex.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default SubscribeIndex;
