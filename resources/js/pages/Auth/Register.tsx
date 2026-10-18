import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Lock, Mail, User, UserPlus } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { AuthFrame, authLayout } from './Frame';
import type { SharedProps } from '@/types';

/**
 * Registration (AUTH-01): name + email + password through the same
 * Fortify endpoint. Success signs the account in and lands on the
 * account page (Fortify home, unchanged).
 */

const INPUT_CLASS =
    'min-h-11 w-full rounded-full border border-field bg-surface px-4 py-2 text-base text-ink';

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

export const Register: FunctionComponent<SharedProps> & { layout?: (page: ReactNode) => ReactNode } = (): React.JSX.Element => {
    const { errors } = usePage<SharedProps>().props;
    const form = useForm({ name: '', email: '', password: '', password_confirmation: '' });

    const submit = (event: React.FormEvent): void => {
        event.preventDefault();
        form.post('/register');
    };

    return (
        <>
            <Head title="ساخت حساب" />
            <AuthFrame
                title="یک حساب بساز؛ سطحت را انتخاب کن و بخوان."
                heading="ساخت حساب"
                lede="نام، ایمیل و یک رمز عبور برای حسابت وارد کن."
                errors={errors}
            >
                <form onSubmit={submit} className="grid gap-4" noValidate>
                    <div className="grid gap-1.5">
                        <label htmlFor="name" className="inline-flex items-center gap-1.5 font-bold">
                            <User size={16} aria-hidden="true" />
                            نام
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={form.data.name}
                            onChange={(event) => form.setData('name', event.target.value)}
                            required
                            autoComplete="name"
                            autoFocus
                            aria-describedby={errors.name ? 'name-error' : undefined}
                            className={INPUT_CLASS}
                        />
                        <FieldError id="name-error" message={errors.name} />
                    </div>
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
                            aria-describedby={errors.email ? 'email-error' : undefined}
                            className={`${INPUT_CLASS} text-left font-en`}
                        />
                        <FieldError id="email-error" message={errors.email} />
                    </div>
                    <div className="grid gap-1.5">
                        <label htmlFor="password" className="inline-flex items-center gap-1.5 font-bold">
                            <Lock size={16} aria-hidden="true" />
                            رمز عبور
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={form.data.password}
                            onChange={(event) => form.setData('password', event.target.value)}
                            required
                            autoComplete="new-password"
                            aria-describedby={errors.password ? 'password-error' : undefined}
                            className={INPUT_CLASS}
                        />
                        <FieldError id="password-error" message={errors.password} />
                    </div>
                    <div className="grid gap-1.5">
                        <label htmlFor="password_confirmation" className="inline-flex items-center gap-1.5 font-bold">
                            <Lock size={16} aria-hidden="true" />
                            تکرار رمز عبور
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
                        <UserPlus size={20} aria-hidden="true" />
                        ساخت حساب
                    </button>
                </form>
                <p className="m-0 leading-8 text-muted">
                    حساب داری؟{' '}
                    <Link href="/login" className="inline-flex min-h-11 items-center text-primary">
                        ورود به حساب
                    </Link>
                </p>
            </AuthFrame>
        </>
    );
};

Register.layout = authLayout;

export default Register;
