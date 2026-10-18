import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Mail, Send } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { AuthFrame, authLayout } from './Frame';
import type { SharedProps } from '@/types';

/**
 * Password recovery (AUTH-02): the same Fortify reset-link endpoint.
 * Unknown emails get the identical neutral status as known ones (no
 * account oracle) — the message renders from the shared status prop.
 */

export const ForgotPassword: FunctionComponent<SharedProps> & { layout?: (page: ReactNode) => ReactNode } = (): React.JSX.Element => {
    const { errors, status } = usePage<SharedProps>().props;
    const form = useForm({ email: '' });

    const submit = (event: React.FormEvent): void => {
        event.preventDefault();
        form.post('/forgot-password');
    };

    return (
        <>
            <Head title="بازیابی رمز عبور">
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <AuthFrame
                title="رمزت یادت رفته؟ پیوند تازه می‌فرستیم."
                heading="بازیابی رمز عبور"
                lede="نشانی ایمیل حساب خود را وارد کنید. اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال می‌شود."
                errors={errors}
                status={status}
            >
                <form onSubmit={submit} className="grid gap-4" noValidate>
                    <div className="grid gap-1.5">
                        <label htmlFor="email" className="inline-flex items-center gap-1.5 font-bold">
                            <Mail size={16} aria-hidden="true" />
                            ایمیل
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={form.data.email}
                            onChange={(event) => form.setData('email', event.target.value)}
                            required
                            autoComplete="email"
                            autoFocus
                            dir="ltr"
                            className="min-h-11 w-full rounded-full border border-field bg-surface px-4 py-2 text-left font-en text-base text-ink"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover disabled:cursor-default disabled:opacity-60"
                    >
                        <Send size={20} aria-hidden="true" />
                        ارسال پیوند بازیابی
                    </button>
                </form>
                <p className="m-0 leading-8 text-muted">
                    <Link href="/login" className="inline-flex min-h-11 items-center text-primary">
                        بازگشت به ورود
                    </Link>
                </p>
            </AuthFrame>
        </>
    );
};

ForgotPassword.layout = authLayout;

export default ForgotPassword;
