import { Head, router, useForm, usePage } from '@inertiajs/react';
import { KeyRound, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { AuthFrame, authLayout } from './Frame';
import { INPUT_CLASS } from '@/lib/form';
import type { SharedProps } from '@/types';

/**
 * Email verification by six-digit code (owner request 2026-10-28).
 *
 * The code is sent on registration and can be resent after the server's
 * cooldown. The page never echoes the code; the input is numeric,
 * one-time-code autocomplete, and validated again on the server.
 */
interface VerifyEmailProps extends SharedProps {
    email: string;
    hasActiveCode: boolean;
    expiresAt: string | null;
    retryAfter: number;
    ttlMinutes: number;
}

function FieldError({ id, message }: { id: string; message?: string }): React.JSX.Element | null {
    if (message === undefined) {
        return null;
    }

    return (
        <p id={id} role="alert" className="m-0 text-sm leading-7 text-danger">
            {message}
        </p>
    );
}

export const VerifyEmail: FunctionComponent<VerifyEmailProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    email,
    hasActiveCode,
    retryAfter,
    ttlMinutes,
}: VerifyEmailProps): React.JSX.Element => {
    const { errors, flash } = usePage<SharedProps>().props;
    const verify = useForm({ code: '' });
    const resend = useForm({});
    const [seconds, setSeconds] = React.useState<number>(retryAfter);

    React.useEffect(() => {
        setSeconds(retryAfter);
    }, [retryAfter]);

    React.useEffect(() => {
        if (seconds <= 0) {
            return undefined;
        }

        const timer = window.setInterval(() => {
            setSeconds((value) => (value > 0 ? value - 1 : 0));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [seconds]);

    const submitCode = (event: React.FormEvent): void => {
        event.preventDefault();
        verify.post('/email/verify');
    };

    const resendCode = (): void => {
        resend.post('/email/verify/resend', { preserveScroll: true });
    };

    return (
        <>
            <Head title="تأیید ایمیل" />
            <AuthFrame
                title="یک قدم مانده: ایمیلت را تأیید کن."
                heading="تأیید ایمیل"
                lede={`کد شش‌رقمی به ${email} فرستادیم. کد را وارد کن تا حسابت کامل شود.`}
                errors={errors}
                status={flash.success}
            >
                <div className="grid gap-3 rounded-2xl border border-line bg-canvas px-4 py-3">
                    <p className="m-0 flex items-center gap-2 text-sm leading-7 font-bold">
                        <MailCheck size={18} aria-hidden="true" />
                        {hasActiveCode ? 'کد فعال است' : 'کد فعالی وجود ندارد'}
                    </p>
                    <p className="m-0 text-sm leading-7 text-muted">
                        {hasActiveCode
                            ? `کد تا ${ttlMinutes.toLocaleString('fa-IR')} دقیقه معتبر است و فقط یک بار استفاده می‌شود.`
                            : 'ارسال کد انجام نشده یا کد منقضی شده است. دکمهٔ ارسال دوباره را بزن.'}
                    </p>
                    <p className="m-0 text-xs leading-6 text-muted">
                        ایمیل را در پوشهٔ هرزنامه هم ببین. کد را برای هیچ‌کس نفرست؛ کارکنان هرگز کد را از تو نمی‌پرسند.
                    </p>
                </div>

                {flash.error !== null && (
                    <p role="alert" className="m-0 rounded-2xl border border-line bg-canvas px-4 py-3 text-danger">
                        {flash.error}
                    </p>
                )}

                <form onSubmit={submitCode} className="grid gap-4" noValidate>
                    <div className="grid gap-1.5">
                        <label htmlFor="code" className="inline-flex items-center gap-1.5 font-bold">
                            <KeyRound size={16} aria-hidden="true" />
                            کد تأیید
                        </label>
                        <input
                            id="code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            value={verify.data.code}
                            onChange={(event) => verify.setData('code', event.target.value.replace(/\D/g, '').slice(0, 6))}
                            required
                            dir="ltr"
                            aria-describedby={errors.code ? 'code-error' : 'code-hint'}
                            className={`${INPUT_CLASS} text-center font-en text-2xl tracking-[0.5em]`}
                        />
                        {errors.code !== undefined ? (
                            <FieldError id="code-error" message={errors.code} />
                        ) : (
                            <p id="code-hint" className="m-0 text-sm leading-7 text-muted">
                                شش رقم، بدون فاصله.
                            </p>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={verify.processing || verify.data.code.length !== 6}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover disabled:cursor-default disabled:opacity-60"
                    >
                        <ShieldCheck size={20} aria-hidden="true" />
                        تأیید ایمیل
                    </button>
                </form>

                <div className="grid gap-2 border-t border-line pt-3">
                    <p className="m-0 text-sm leading-7 text-muted">
                        کد را دریافت نکردی یا منقضی شد؟
                    </p>
                    <button
                        type="button"
                        onClick={resendCode}
                        disabled={resend.processing || seconds > 0}
                        className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-bold text-ink transition-colors duration-150 hover:bg-canvas disabled:cursor-default disabled:opacity-60"
                    >
                        <RefreshCw size={18} aria-hidden="true" />
                        {seconds > 0
                            ? `ارسال دوباره تا ${seconds.toLocaleString('fa-IR')} ثانیه`
                            : 'ارسال دوبارهٔ کد'}
                    </button>
                </div>

                <p className="m-0 leading-8 text-muted">
                    ایمیل اشتباه است؟{' '}
                    <button
                        type="button"
                        onClick={() => router.post('/logout')}
                        className="inline-flex min-h-11 cursor-pointer items-center text-primary underline underline-offset-4"
                    >
                        خروج از حساب
                    </button>{' '}
                    و با ایمیل درست دوباره ثبت‌نام کن.
                </p>
            </AuthFrame>
        </>
    );
};

VerifyEmail.layout = authLayout;

export default VerifyEmail;
