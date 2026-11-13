import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { KeyRound, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { SupportNote } from '@/components/SupportNote';
import { AuthFrame, authLayout } from './Frame';
import { INPUT_CLASS } from '@/lib/form';
import type { SharedProps } from '@/types';

/**
 * Shared six-digit SMS page for two flows:
 * - `login`: the guest phone-code sign-in;
 * - `verify`: the registration/account phone check.
 *
 * The server owns the phone (session or user row); this page only posts
 * the code and asks for a resend. The code is never echoed.
 */
interface VerifyPhoneProps extends SharedProps {
    mode: 'login' | 'verify';
    phone: string;
    hasActiveCode: boolean;
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

export const VerifyPhone: FunctionComponent<VerifyPhoneProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    mode,
    phone,
    hasActiveCode,
    retryAfter,
    ttlMinutes,
}: VerifyPhoneProps): React.JSX.Element => {
    const { errors, flash, status } = usePage<SharedProps>().props;
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

    const verifyUrl = mode === 'login' ? '/login/code/verify' : '/phone/verify';
    const resendUrl = mode === 'login' ? '/login/code/resend' : '/phone/verify/resend';
    const changeUrl = mode === 'login' ? '/login/code' : '/app/account/settings';

    const submitCode = (event: React.FormEvent): void => {
        event.preventDefault();
        verify.post(verifyUrl);
    };

    const resendCode = (): void => {
        resend.post(resendUrl, { preserveScroll: true });
    };

    return (
        <>
            <Head title={mode === 'login' ? 'ورود با کد پیامکی' : 'تأیید موبایل'}>
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <AuthFrame
                title={mode === 'login' ? 'کد پیامکی را وارد کن.' : 'یک قدم مانده: موبایلت را تأیید کن.'}
                heading={mode === 'login' ? 'ورود با کد پیامکی' : 'تأیید موبایل'}
                lede={`کد شش‌رقمی به ${phone} فرستادیم. کد را وارد کن تا ادامه بدهی.`}
                errors={errors}
                status={status ?? flash.success}
            >
                <div className="grid gap-3 rounded-2xl border border-line bg-canvas px-4 py-3">
                    <p className="m-0 flex items-center gap-2 text-sm leading-7 font-bold">
                        <Smartphone size={18} aria-hidden="true" />
                        {hasActiveCode ? 'کد فعال است' : 'کد فعالی وجود ندارد'}
                    </p>
                    <p className="m-0 text-sm leading-7 text-muted">
                        {hasActiveCode
                            ? `کد تا ${ttlMinutes.toLocaleString('fa-IR')} دقیقه معتبر است و فقط یک بار استفاده می‌شود.`
                            : 'ارسال کد انجام نشده یا کد منقضی شده است. دکمهٔ ارسال دوباره را بزن.'}
                    </p>
                    <p className="m-0 text-xs leading-6 text-muted">
                        کد را برای هیچ‌کس نفرست؛ کارکنان هرگز کد را از تو نمی‌پرسند.
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
                            کد شش‌رقمی
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
                            autoFocus
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
                        {mode === 'login' ? 'ورود' : 'تأیید موبایل'}
                    </button>
                </form>

                <div className="grid gap-2 border-t border-line pt-3">
                    <p className="m-0 text-sm leading-7 text-muted">کد را دریافت نکردی یا منقضی شد؟</p>
                    <button
                        type="button"
                        onClick={resendCode}
                        disabled={resend.processing || seconds > 0}
                        className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 font-bold text-ink transition-colors duration-150 hover:bg-canvas disabled:cursor-default disabled:opacity-60"
                    >
                        <RefreshCw size={18} aria-hidden="true" />
                        {seconds > 0 ? `ارسال دوباره تا ${seconds.toLocaleString('fa-IR')} ثانیه` : 'ارسال دوبارهٔ کد'}
                    </button>
                </div>

                <p className="m-0 leading-8 text-muted">
                    <Link href={changeUrl} className="inline-flex min-h-11 items-center text-primary">
                        شمارهٔ دیگری را وارد می‌کنم
                    </Link>
                </p>
                <SupportNote />
            </AuthFrame>
        </>
    );
};

VerifyPhone.layout = authLayout;

export default VerifyPhone;
