import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Smartphone } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import { SupportNote } from '@/components/SupportNote';
import { AuthFrame, authLayout } from './Frame';
import { INPUT_CLASS } from '@/lib/form';
import type { SharedProps } from '@/types';

/**
 * Phone login entry (owner request 2026-11-12): one mobile number, one
 * six-digit SMS code. The form posts to the guest endpoint; the code page
 * carries the number in the server session, never in a query string.
 */
export const PhoneLogin: FunctionComponent<SharedProps> & { layout?: (page: ReactNode) => ReactNode } =
    (): React.JSX.Element => {
        const { errors } = usePage<SharedProps>().props;
        const form = useForm({ phone: '' });

        const submit = (event: React.FormEvent): void => {
            event.preventDefault();
            form.post('/login/code');
        };

        return (
            <>
                <Head title="ورود با کد پیامکی">
                    <meta name="robots" content="noindex, nofollow" />
                </Head>
                <AuthFrame
                    title="بدون رمز وارد شو."
                    heading="ورود با کد پیامکی"
                    lede="شمارهٔ موبایلت را بنویس؛ یک کد شش‌رقمی برایت پیامک می‌کنیم."
                    errors={errors}
                >
                    <form onSubmit={submit} className="grid gap-4" noValidate>
                        <div className="grid gap-1.5">
                            <label htmlFor="phone" className="inline-flex items-center gap-1.5 font-bold">
                                <Smartphone size={16} aria-hidden="true" />
                                شمارهٔ موبایل
                            </label>
                            <input
                                id="phone"
                                type="tel"
                                value={form.data.phone}
                                onChange={(event) => form.setData('phone', event.target.value)}
                                required
                                autoFocus
                                autoComplete="tel"
                                inputMode="tel"
                                dir="ltr"
                                placeholder="09xxxxxxxxx"
                                aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'}
                                className={`${INPUT_CLASS} text-left font-en`}
                            />
                            {errors.phone !== undefined ? (
                                <p id="phone-error" role="alert" className="m-0 text-sm leading-7 text-danger">
                                    {errors.phone}
                                </p>
                            ) : (
                                <p id="phone-hint" className="m-0 text-sm leading-7 text-muted">
                                    همان شماره‌ای که با آن حساب ساخته‌ای.
                                </p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface transition-colors duration-150 hover:bg-primary-hover disabled:cursor-default disabled:opacity-60"
                        >
                            <Smartphone size={20} aria-hidden="true" />
                            دریافت کد
                        </button>
                    </form>

                    <p className="m-0 leading-8 text-muted">
                        <Link href="/login" className="inline-flex min-h-11 items-center gap-1.5 text-primary">
                            <ArrowLeft size={16} aria-hidden="true" />
                            ورود با ایمیل و رمز
                        </Link>
                    </p>
                    <SupportNote />
                </AuthFrame>
            </>
        );
    };

PhoneLogin.layout = authLayout;

export default PhoneLogin;
