import { Head, useForm, usePage } from '@inertiajs/react';
import { Check, Settings as SettingsIcon, User } from 'lucide-react';
import * as React from 'react';
import type { FunctionComponent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import type { SharedProps } from '@/types';

/**
 * Settings (LEVEL-01 + PLAN-01 goal): the only writer of
 * preferred_level (besides the explicit placement accept) and the only
 * writer of the daily goal. Browsing a level never touches either;
 * changing the goal never writes the level and vice versa. Display-name
 * editing keeps the retired learner component's server rule
 * (required/string/255).
 */

interface SettingsProps extends SharedProps {
    user: {
        name: string;
        email: string;
        preferred_level: string | null;
        daily_goal_minutes: number;
    };
    levels: string[];
}

const INPUT_CLASS =
    'min-h-11 w-full rounded-full border border-field bg-surface px-4 py-2 text-base text-ink';

export const AccountSettings: FunctionComponent<SettingsProps> & { layout?: (page: ReactNode) => ReactNode } = ({
    user,
    levels,
}: SettingsProps): React.JSX.Element => {
    const { errors, status } = usePage<SharedProps>().props;
    const form = useForm({
        name: user.name,
        preferred_level: user.preferred_level ?? '',
        daily_goal_minutes: String(user.daily_goal_minutes),
    });

    const submit = (event: React.FormEvent): void => {
        event.preventDefault();
        form.patch('/app/account/settings', { preserveScroll: true });
    };

    return (
        <>
            <Head title="تنظیمات حساب" />
            <div className="mx-auto grid max-w-[680px] gap-5 px-4 py-6">
                <div>
                    <h1 className="m-0 text-3xl leading-[1.6] font-extrabold tracking-tight">تنظیمات</h1>
                    <p className="m-0 mt-2 text-[1.0625rem] leading-8 text-muted">نام، سطح و هدف روزانه‌ات را اینجا تنظیم کن.</p>
                </div>

                {status !== null && (
                    <p role="status" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-success">
                        {status}
                    </p>
                )}

                <form onSubmit={submit} className="grid gap-4 rounded-3xl border border-line bg-surface p-5" noValidate>
                    <p className="m-0 inline-flex items-center gap-2 font-bold">
                        <SettingsIcon size={20} aria-hidden="true" />
                        یادگیری
                    </p>
                    <div className="grid gap-1.5">
                        <label htmlFor="settings-name" className="inline-flex items-center gap-1.5 font-bold">
                            <User size={16} aria-hidden="true" />
                            نام
                        </label>
                        <input
                            id="settings-name"
                            type="text"
                            value={form.data.name}
                            onChange={(event) => form.setData('name', event.target.value)}
                            required
                            autoComplete="name"
                            aria-describedby={errors.name ? 'settings-name-error' : undefined}
                            className={INPUT_CLASS}
                        />
                        {errors.name !== undefined && (
                            <p id="settings-name-error" role="alert" className="m-0 text-sm leading-7 text-danger">
                                {errors.name}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <label htmlFor="preferred-level" className="font-bold">سطح ترجیحی</label>
                        <select
                            id="preferred-level"
                            value={form.data.preferred_level}
                            onChange={(event) => form.setData('preferred_level', event.target.value)}
                            className={INPUT_CLASS}
                        >
                            <option value="">انتخاب نشده</option>
                            {levels.map((level) => (
                                <option key={level} value={level} lang="en">
                                    {level}
                                </option>
                            ))}
                        </select>
                        {errors.preferred_level !== undefined && (
                            <p role="alert" className="m-0 text-sm leading-7 text-danger">
                                {errors.preferred_level}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <label htmlFor="daily-goal" className="font-bold">هدف روزانه (دقیقه)</label>
                        <select
                            id="daily-goal"
                            value={form.data.daily_goal_minutes}
                            onChange={(event) => form.setData('daily_goal_minutes', event.target.value)}
                            className={INPUT_CLASS}
                        >
                            {[5, 10, 15].map((goal) => (
                                <option key={goal} value={String(goal)}>
                                    {goal} دقیقه
                                </option>
                            ))}
                        </select>
                        {errors.daily_goal_minutes !== undefined && (
                            <p role="alert" className="m-0 text-sm leading-7 text-danger">
                                {errors.daily_goal_minutes}
                            </p>
                        )}
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-surface hover:bg-primary-hover disabled:opacity-60"
                        >
                            <Check size={20} aria-hidden="true" />
                            ذخیره
                        </button>
                    </div>
                </form>

                <p className="m-0 leading-8 text-muted">
                    تغییر سطح در صفحه مطلب، سطح ترجیحی را تغییر نمی‌دهد. تغییر هدف روزانه، سطح ترجیحی را تغییر نمی‌دهد.
                </p>
            </div>
        </>
    );
};

AccountSettings.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default AccountSettings;
