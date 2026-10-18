import { Head, Link } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';

import AppLayout from '@/layouts/AppLayout';

/**
 * M0 error page (Inertia::handleExceptionsUsing ['ErrorPage']). One calm
 * Persian message per status with a single next action — never a stack
 * trace, never debug output.
 */
const COPY: Record<number, { title: string; description: string }> = {
    503: {
        title: 'به‌زودی برمی‌گردیم',
        description: 'در حال آماده‌سازی هستیم. لطفاً کمی بعد دوباره تلاش کنید.',
    },
    500: {
        title: 'خطایی در سرور رخ داد',
        description: 'مشکلی پیش آمده است. اگر ادامه داشت، بعداً تلاش کنید.',
    },
    404: {
        title: 'صفحه موردنظر پیدا نشد',
        description: 'نشانی را بررسی کنید یا به صفحه اصلی برگردید.',
    },
    403: {
        title: 'اجازه دسترسی ندارید',
        description: 'برای دیدن این صفحه وارد حساب خود شوید یا به صفحه اصلی برگردید.',
    },
};

export const ErrorPage: FunctionComponent<{ status: number }> & { layout?: (page: ReactNode) => ReactNode } = ({ status }: { status: number }): React.JSX.Element => {
    const copy = COPY[status] ?? COPY[500] ?? { title: '', description: '' };
    const title = `${status}: ${copy.title}`;

    return (
        <>
            <Head title={title} />
            <div className="mx-auto grid max-w-[680px] gap-4 px-4 py-12">
                <p lang="en" dir="ltr" className="font-en text-6xl font-extrabold text-primary">
                    {status}
                </p>
                <h1 className="text-2xl font-bold">{copy.title}</h1>
                <p className="leading-8 text-muted">{copy.description}</p>
                <p className="flex flex-wrap gap-2">
                    <Link
                        href="/"
                        className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-6 py-2 font-bold text-surface no-underline hover:bg-primary-hover"
                    >
                        بازگشت به صفحه اصلی
                    </Link>
                </p>
            </div>
        </>
    );
};

ErrorPage.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;

export default ErrorPage;
