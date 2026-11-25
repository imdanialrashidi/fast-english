import { Head, useForm, usePage } from '@inertiajs/react';
import { Check, PartyPopper, Smartphone, Sparkles } from 'lucide-react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import { INPUT_CLASS } from '@/lib/form';
import type { SharedProps } from '@/types';

/**
 * Post-activation welcome (owner instruction 2026-11-25).
 *
 * The subscription just became active. The page states that in one line,
 * then asks for the three profile values the owner specified: first name,
 * surname, and a Jalali birth date in three fields. The verified mobile is
 * displayed read-only (it is the account's login identity).
 */

interface WelcomeProps extends SharedProps {
    user: {
        name: string;
        first_name: string;
        last_name: string | null;
        phone: string;
        birth_date_jalali: string | null;
    };
}

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export const OnboardingWelcome: FunctionComponent<WelcomeProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    user,
}: WelcomeProps): React.JSX.Element => {
    const { errors } = usePage<SharedProps>().props;
    const parts = (user.birth_date_jalali ?? '').split('-');
    const form = useForm({
        first_name: user.first_name,
        last_name: user.last_name ?? '',
        birth_day: parts[2] !== undefined ? String(Number(parts[2])) : '',
        birth_month: parts[1] !== undefined ? String(Number(parts[1])) : '',
        birth_year: parts[0] ?? '',
    });

    const submit = (event: React.FormEvent): void => {
        event.preventDefault();
        form.post('/app/welcome', { preserveScroll: true });
    };

    return (
        <>
            <Head title="اکانت شما فعال شد" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <section aria-label="فعال‌سازی حساب" className="grid gap-3 rounded-3xl border border-line bg-ink p-6 text-surface sm:p-8">
                    <p className="m-0 inline-flex items-center gap-2 text-sm font-bold text-accent">
                        <PartyPopper size={18} aria-hidden="true" />
                        اکانت شما فعال شد
                    </p>
                    <h1 className="fe-title m-0 text-3xl leading-[1.4] font-black tracking-tight sm:text-4xl">انگلیسی را سریع یاد بگیر</h1>
                    <p className="m-0 text-[1.0625rem] leading-8 text-surface/80">
                        اشتراکت فعال شد. یک قدم کوتاه مانده: اطلاعات حسابت را کامل کن تا وارد محیط یادگیری شوی.
                    </p>
                </section>

                <section aria-labelledby="complete-profile" className="grid gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
                    <div className="grid gap-1">
                        <h2 id="complete-profile" className="m-0 flex items-center gap-2 text-xl leading-8 font-extrabold">
                            <Sparkles size={20} aria-hidden="true" className="text-primary" />
                            اطلاعات را تکمیل کنید
                        </h2>
                        <p className="m-0 text-sm leading-7 text-muted">این اطلاعات فقط برای پروفایل و تجربهٔ شخصی‌سازی‌شدهٔ خودت استفاده می‌شود.</p>
                    </div>

                    <p role="note" className="m-0 inline-flex items-center gap-2 rounded-2xl border border-line bg-canvas px-4 py-3 text-sm text-muted">
                        <Smartphone size={16} aria-hidden="true" />
                        شمارهٔ موبایل تأییدشده:{' '}
                        <span dir="ltr" className="font-en font-bold text-ink">
                            {user.phone}
                        </span>
                    </p>

                    <form onSubmit={submit} className="grid gap-4" noValidate>
                        <div className="grid gap-1.5">
                            <label htmlFor="first-name" className="font-bold">نام</label>
                            <input
                                id="first-name"
                                type="text"
                                value={form.data.first_name}
                                onChange={(event) => form.setData('first_name', event.target.value)}
                                required
                                autoComplete="given-name"
                                aria-describedby={errors.first_name !== undefined ? 'first-name-error' : undefined}
                                className={INPUT_CLASS}
                            />
                            {errors.first_name !== undefined && (
                                <p id="first-name-error" role="alert" className="m-0 text-sm leading-7 text-danger">{errors.first_name}</p>
                            )}
                        </div>

                        <div className="grid gap-1.5">
                            <label htmlFor="last-name" className="font-bold">نام خانوادگی</label>
                            <input
                                id="last-name"
                                type="text"
                                value={form.data.last_name}
                                onChange={(event) => form.setData('last_name', event.target.value)}
                                required
                                autoComplete="family-name"
                                aria-describedby={errors.last_name !== undefined ? 'last-name-error' : undefined}
                                className={INPUT_CLASS}
                            />
                            {errors.last_name !== undefined && (
                                <p id="last-name-error" role="alert" className="m-0 text-sm leading-7 text-danger">{errors.last_name}</p>
                            )}
                        </div>

                        <fieldset className="grid gap-2 rounded-2xl border border-line p-4">
                            <legend className="px-1 text-sm font-bold">تاریخ تولد (شمسی)</legend>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="grid gap-1">
                                    <label htmlFor="birth-day" className="text-xs text-muted">روز</label>
                                    <select
                                        id="birth-day"
                                        value={form.data.birth_day}
                                        onChange={(event) => form.setData('birth_day', event.target.value)}
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">انتخاب</option>
                                        {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                            <option key={day} value={String(day)}>{day.toLocaleString('fa-IR')}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid gap-1">
                                    <label htmlFor="birth-month" className="text-xs text-muted">ماه</label>
                                    <select
                                        id="birth-month"
                                        value={form.data.birth_month}
                                        onChange={(event) => form.setData('birth_month', event.target.value)}
                                        className={INPUT_CLASS}
                                    >
                                        <option value="">انتخاب</option>
                                        {MONTHS.map((month, index) => (
                                            <option key={month} value={String(index + 1)}>{month}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid gap-1">
                                    <label htmlFor="birth-year" className="text-xs text-muted">سال</label>
                                    <input
                                        id="birth-year"
                                        type="number"
                                        inputMode="numeric"
                                        min={1300}
                                        max={1420}
                                        value={form.data.birth_year}
                                        onChange={(event) => form.setData('birth_year', event.target.value)}
                                        placeholder="۱۳۷۰"
                                        className={`${INPUT_CLASS} text-left font-en`}
                                    />
                                </div>
                            </div>
                            {(errors.birth_day !== undefined || errors.birth_month !== undefined || errors.birth_year !== undefined) && (
                                <p role="alert" className="m-0 text-sm leading-7 text-danger">
                                    {errors.birth_day ?? errors.birth_month ?? errors.birth_year}
                                </p>
                            )}
                        </fieldset>

                        <button
                            type="submit"
                            disabled={form.processing}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                        >
                            <Check size={20} aria-hidden="true" />
                            {form.processing ? 'در حال ذخیره…' : 'شروع یادگیری'}
                        </button>
                    </form>
                </section>
            </div>
        </>
    );
};

OnboardingWelcome.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default OnboardingWelcome;
