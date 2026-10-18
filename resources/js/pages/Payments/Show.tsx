import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { CardSim, Check, CircleAlert, X } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import { INPUT_CLASS } from '@/lib/form';
import type { SharedProps } from '@/types';

/**
 * Payment request (PAY-01/02): the server snapshot (plan, amount,
 * duration, destination) with the explicit next step per state. Receipt
 * upload is a real multipart POST; success only ever renders after the
 * server commits. Staff-only fields never travel to this page.
 */

interface PaymentProps extends SharedProps {
    request: {
        id: number;
        status: string;
        plan_name: string;
        amount_label: string;
        duration_days: number;
        card_number: string;
        holder_name: string;
        bank_name: string;
        public_reason: string | null;
        has_receipt: boolean;
        receipt_url: string | null;
    };
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

export const PaymentsShow: FunctionComponent<PaymentProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    request,
}: PaymentProps): React.JSX.Element => {
    const { errors, status } = usePage<SharedProps>().props;
    const receiptForm = useForm({ receipt: null as File | null, bank_reference: '', sender_last4: '', transferred_at: '' });
    const cancelForm = useForm({});

    const submitReceipt = (event: React.FormEvent): void => {
        event.preventDefault();
        receiptForm.post(`/app/payments/${request.id}/receipt`, { forceFormData: true });
    };

    const cancel = (event: React.FormEvent): void => {
        event.preventDefault();
        cancelForm.post(`/app/payments/${request.id}/cancel`);
    };

    return (
        <>
            <Head title="درخواست پرداخت" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">درخواست پرداخت</h1>

                {status !== null && (
                    <p role="status" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-muted">
                        {status}
                    </p>
                )}

                <div className="grid gap-1 rounded-3xl border border-line bg-surface p-5">
                    <h2 className="m-0 flex items-center gap-2 text-xl leading-8">
                        <CardSim size={20} aria-hidden="true" />
                        <span lang="fa" dir="rtl">
                            {request.plan_name}
                        </span>
                    </h2>
                    <p className="m-0 text-lg font-bold">{request.amount_label}</p>
                    <p className="m-0 leading-8 text-muted">{request.duration_days} روز دسترسی پس از تأیید</p>
                    <p className="m-0 leading-8 text-muted">وضعیت: {statusLabel(request.status)}</p>
                    {request.card_number !== '' && (
                        <>
                            <p className="m-0 leading-8">
                                کارت مقصد: <span dir="ltr">{request.card_number}</span>
                            </p>
                            <p className="m-0 leading-8">به‌نام: {request.holder_name}</p>
                            <p className="m-0 leading-8">بانک: {request.bank_name}</p>
                        </>
                    )}
                    {request.public_reason !== null && request.public_reason !== '' && (
                        <p className="m-0 leading-8">دلیل: {request.public_reason}</p>
                    )}
                </div>

                {request.status === 'awaiting_receipt' && (
                    <section aria-label="ارسال رسید" className="grid gap-4">
                        <h2 className="m-0 text-xl leading-8">قدم بعدی: واریز و ارسال رسید</h2>
                        <p className="m-0 leading-8 text-muted">
                            مبلغ بالا را به کارت مقصد واریز کنید، سپس رسید را همین‌جا ارسال کنید. نتیجه فقط پس از ثبت در سرور نمایش داده می‌شود.
                        </p>
                        <form onSubmit={submitReceipt} className="fe-filters grid gap-4 rounded-3xl border border-line bg-surface p-5">
                            <div className="grid gap-1.5">
                                <label htmlFor="receipt" className="font-bold">تصویر رسید (JPEG/PNG/WebP تا ۵ مگابایت)</label>
                                <input
                                    id="receipt"
                                    name="receipt"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    required
                                    onChange={(event) => receiptForm.setData('receipt', event.target.files?.[0] ?? null)}
                                    className="min-h-11 w-full cursor-pointer rounded-2xl border border-field bg-surface px-4 py-2 text-base text-ink file:me-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border-0 file:bg-canvas file:px-4 file:font-bold"
                                />
                                {errors.receipt !== undefined && (
                                    <p role="alert" className="fe-alert m-0 flex items-center gap-1.5 text-sm leading-7 text-danger">
                                        <CircleAlert size={16} aria-hidden="true" />
                                        {errors.receipt}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1.5">
                                <label htmlFor="bank_reference" className="font-bold">کد پیگیری (اختیاری)</label>
                                <input
                                    id="bank_reference"
                                    name="bank_reference"
                                    type="text"
                                    value={receiptForm.data.bank_reference}
                                    onChange={(event) => receiptForm.setData('bank_reference', event.target.value)}
                                    maxLength={64}
                                    autoComplete="off"
                                    className={INPUT_CLASS}
                                />
                                {errors.bank_reference !== undefined && (
                                    <p role="alert" className="fe-alert m-0 text-sm leading-7 text-danger">
                                        {errors.bank_reference}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1.5">
                                <label htmlFor="sender_last4" className="font-bold">چهار رقم آخر کارت مبدأ (اختیاری)</label>
                                <input
                                    id="sender_last4"
                                    name="sender_last4"
                                    type="text"
                                    value={receiptForm.data.sender_last4}
                                    onChange={(event) => receiptForm.setData('sender_last4', event.target.value)}
                                    maxLength={4}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    className={INPUT_CLASS}
                                />
                                {errors.sender_last4 !== undefined && (
                                    <p role="alert" className="fe-alert m-0 text-sm leading-7 text-danger">
                                        {errors.sender_last4}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1.5">
                                <label htmlFor="transferred_at" className="font-bold">زمان انتقال (اختیاری)</label>
                                <input
                                    id="transferred_at"
                                    name="transferred_at"
                                    type="datetime-local"
                                    value={receiptForm.data.transferred_at}
                                    onChange={(event) => receiptForm.setData('transferred_at', event.target.value)}
                                    className={INPUT_CLASS}
                                />
                                {errors.transferred_at !== undefined && (
                                    <p role="alert" className="fe-alert m-0 text-sm leading-7 text-danger">
                                        {errors.transferred_at}
                                    </p>
                                )}
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    disabled={receiptForm.processing}
                                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                                >
                                    <Check size={20} aria-hidden="true" />
                                    ثبت رسید
                                </button>
                            </div>
                        </form>
                        <form onSubmit={cancel}>
                            <button
                                type="submit"
                                disabled={cancelForm.processing}
                                className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink hover:bg-canvas disabled:opacity-60"
                            >
                                <X size={20} aria-hidden="true" />
                                لغو این درخواست
                            </button>
                        </form>
                    </section>
                )}

                {request.status === 'pending' && (
                    <section aria-label="وضعیت بررسی" className="grid gap-2">
                        <h2 className="m-0 text-xl leading-8">قدم بعدی: انتظار برای بررسی</h2>
                        <p className="m-0 leading-8 text-muted">
                            رسید شما ثبت شد و در صف بررسی قرار گرفت. این وضعیت دسترسی تازه ایجاد نمی‌کند. برای بررسی وضعیت همین صفحه را دوباره بارگذاری
                            کنید.
                        </p>
                        <p className="m-0 flex flex-wrap gap-2">
                            <Link
                                href={`/app/payments/${request.id}`}
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                            >
                                بررسی وضعیت
                            </Link>
                            {request.receipt_url !== null && (
                                <a
                                    href={request.receipt_url}
                                    className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                                >
                                    مشاهده رسید خودم
                                </a>
                            )}
                        </p>
                    </section>
                )}

                {request.status === 'rejected' && (
                    <section aria-label="رد شده" className="grid gap-2">
                        <h2 className="m-0 text-xl leading-8">قدم بعدی: خرید دوباره</h2>
                        <p className="m-0 leading-8 text-muted">این درخواست رد شد. برای ادامه، یک درخواست تازه بسازید؛ سابقه قبلی حفظ می‌شود.</p>
                        <p className="m-0">
                            <Link
                                href="/app/subscribe"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                خرید دوباره
                            </Link>
                        </p>
                    </section>
                )}

                {request.status === 'cancelled' && (
                    <section aria-label="لغو شده" className="grid gap-2">
                        <h2 className="m-0 text-xl leading-8">قدم بعدی: خرید دوباره در صورت نیاز</h2>
                        <p className="m-0 leading-8 text-muted">این درخواست لغو شد و سابقه آن حفظ شده است. برای شروع تازه، یک پلن انتخاب کنید.</p>
                        <p className="m-0">
                            <Link
                                href="/app/subscribe"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface no-underline hover:bg-primary-hover"
                            >
                                انتخاب پلن
                            </Link>
                        </p>
                    </section>
                )}

                {request.status === 'approved' && (
                    <section aria-label="تأیید شده" className="grid gap-2">
                        <h2 className="m-0 text-xl leading-8">تأیید شده</h2>
                        <p className="m-0 leading-8 text-muted">این درخواست تأیید شده است. جزئیات اشتراک در حساب نمایش داده می‌شود.</p>
                    </section>
                )}
            </div>
        </>
    );
};

PaymentsShow.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default PaymentsShow;
