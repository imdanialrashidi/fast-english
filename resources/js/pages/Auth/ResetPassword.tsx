import { Head, useForm, usePage } from '@inertiajs/react';
import { Check, Lock, Mail } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { AuthFrame, authLayout } from './Frame';
import type { SharedProps } from '@/types';

/**
 * Reset confirmation (AUTH-02): token + email + new password through the
 * same Fortify endpoint. The link works once; reuse, forgery, or a
 * mismatched email fails server-side with a field error.
 */

interface ResetProps extends SharedProps {
    token: string;
    email: string;
}

const INPUT_CLASS =
    'min-h-11 w-full rounded-full border border-field bg-surface px-4 py-2 text-base text-ink';

export const ResetPassword: FunctionComponent<ResetProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    token,
    email,
}: ResetProps): React.JSX.Element => {
    const { errors } = usePage<SharedProps>().props;
    const form = useForm({ token, email, password: '', password_confirmation: '' });

    const submit = (event: React.FormEvent): void => {
        event.preventDefault();
        form.post('/reset-password');
    };

    return (
        <>
            <Head title="تعیین رمز عبور تازه">
                <meta name="robots" content="noindex, nofollow" />
            </Head>
            <AuthFrame
                title="یک رمز تازه انتخاب کن."
                heading="تعیین رمز عبور تازه"
                lede="رمز عبور تازه حساب خود را وارد کنید."
                errors={errors}
            >
                <form onSubmit={submit} className="grid gap-4" noValidate>
                    <input type="hidden" name="token" value={form.data.token} />
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
                            dir="ltr"
                            className={`${INPUT_CLASS} text-left font-en`}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <label htmlFor="password" className="inline-flex items-center gap-1.5 font-bold">
                            <Lock size={16} aria-hidden="true" />
                            رمز عبور تازه
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={form.data.password}
                            onChange={(event) => form.setData('password', event.target.value)}
                            required
                            autoComplete="new-password"
                            className={INPUT_CLASS}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <label htmlFor="password_confirmation" className="inline-flex items-center gap-1.5 font-bold">
                            <Lock size={16} aria-hidden="true" />
                            تکرار رمز عبور تازه
                        </label>
                        <input
                            id="password_confirmation"
                            type="password"
                            value={form.data.password_confirmation}
                            onChange={(event) => form.setData('password_confirmation', event.target.value)}
                            required
                            autoComplete="new-password"
                            className={INPUT_CLASS}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover disabled:cursor-default disabled:opacity-60"
                    >
                        <Check size={20} aria-hidden="true" />
                        ذخیره رمز تازه
                    </button>
                </form>
            </AuthFrame>
        </>
    );
};

ResetPassword.layout = authLayout;

export default ResetPassword;
