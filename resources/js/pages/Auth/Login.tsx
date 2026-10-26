import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { AuthFrame, authLayout } from './Frame';
import type { SharedProps } from '@/types';

/**
 * Login (AUTH-01): email + password through the same Fortify endpoint.
 * Wrong credentials and suspended accounts get the same generic error
 * from the server; the throttle (5/min per account+IP) is unchanged.
 */

function PasswordField({
    id,
    label,
    value,
    onChange,
    error,
    autoComplete,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    autoComplete: string;
}): React.JSX.Element {
    const [visible, setVisible] = React.useState(false);
    return (
        <div className="grid gap-1.5">
            <label htmlFor={id} className="inline-flex items-center gap-1.5 font-bold">
                <Lock size={16} aria-hidden="true" />
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    required
                    autoComplete={autoComplete}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className="min-h-11 w-full rounded-full border border-field bg-surface py-2 ps-4 pe-12 text-base text-ink"
                />
                <button
                    type="button"
                    onClick={() => setVisible(!visible)}
                    aria-controls={id}
                    aria-pressed={visible ? 'true' : 'false'}
                    aria-label={visible ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                    className="absolute end-1.5 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                >
                    {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
            </div>
            {error !== undefined && (
                <p id={`${id}-error`} role="alert" className="m-0 flex items-center gap-1.5 text-sm leading-7 text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}

export const Login: FunctionComponent<SharedProps> & { layout?: (page: ReactNode) => ReactNode } = (): React.JSX.Element => {
    const { errors } = usePage<SharedProps>().props;
    const form = useForm({ email: '', password: '' });

    const submit = (event: React.FormEvent): void => {
        event.preventDefault();
        form.post('/login');
    };

    return (
        <>
            <Head title="ورود به حساب" />
            <AuthFrame
                title="با یک متن کوتاه انگلیسی، امروز را شروع کن."
                heading="ورود به حساب"
                lede="ایمیل و رمز عبورت را وارد کن تا به درس‌هایت برسی."
                errors={errors}
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
                            dir="ltr"
                            aria-describedby={errors.email ? 'email-error' : undefined}
                            className="min-h-11 w-full rounded-full border border-field bg-surface px-4 py-2 text-left font-en text-base text-ink"
                        />
                        {errors.email !== undefined && (
                            <p id="email-error" role="alert" className="m-0 text-sm leading-7 text-danger">
                                {errors.email}
                            </p>
                        )}
                    </div>
                    <PasswordField
                        id="password"
                        label="رمز عبور"
                        value={form.data.password}
                        onChange={(value) => form.setData('password', value)}
                        error={errors.password}
                        autoComplete="current-password"
                    />
                    <button
                        type="submit"
                        disabled={form.processing}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover disabled:cursor-default disabled:opacity-60"
                    >
                        <LogIn size={20} aria-hidden="true" />
                        ورود
                    </button>
                </form>
                <div className="flex flex-wrap items-center gap-x-2 text-muted">
                    <span>حساب نداری؟</span>
                    <Link href="/register" className="inline-flex min-h-11 items-center text-primary">
                        ساخت حساب
                    </Link>
                    <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-field sm:block" />
                    <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-primary">
                        رمز را فراموش کرده‌ام
                    </Link>
                </div>
            </AuthFrame>
        </>
    );
};

Login.layout = authLayout;

export default Login;
