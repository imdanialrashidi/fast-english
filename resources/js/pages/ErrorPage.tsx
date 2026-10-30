import { Head, Link, usePage } from '@inertiajs/react';
import type { FunctionComponent, ReactNode } from 'react';
import type { SharedProps } from '@/types';

/**
 * M0 error page (Inertia::handleExceptionsUsing ['ErrorPage']). One calm
 * Persian message per status with a single next action — never a stack
 * trace, never debug output.
 */
const COPY: Record<number, { title: string; description: string }> = {
    405: {
        title: 'این درخواست پشتیبانی نمی‌شود',
        description: 'نشانی را از منوی اصلی باز کنید و دوباره تلاش کنید.',
    },
    419: {
        title: 'نشست شما منقضی شده است',
        description: 'برای امنیت، صفحه را دوباره بارگذاری کنید و فرم را از نو بفرستید.',
    },
    429: {
        title: 'کمی آرام‌تر',
        description: 'تعداد درخواست‌ها زیاد شده است. چند لحظه صبر کنید و دوباره تلاش کنید.',
    },
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
    const { props } = usePage<SharedProps>();
    const signedIn = props.auth.user !== null;
    const hasPublicSample = props.has_public_sample;

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
                    {(status === 419 || status === 429) && (
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center rounded-full bg-primary px-6 py-2 font-bold text-surface hover:bg-primary-hover"
                        >
                            تلاش دوباره
                        </button>
                    )}
                    <Link
                        href={signedIn ? '/app/today' : '/'}
                        className={
                            status === 419 || status === 429
                                ? 'inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-6 py-2 font-bold text-ink no-underline hover:bg-canvas'
                                : 'inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-6 py-2 font-bold text-surface no-underline hover:bg-primary-hover'
                        }
                    >
                        {signedIn ? 'بازگشت به برنامه' : 'بازگشت به صفحه اصلی'}
                    </Link>
                    {!signedIn && hasPublicSample && (
                        <Link
                            href="/sample"
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-6 py-2 font-bold text-ink no-underline hover:bg-canvas"
                        >
                            دیدن نمونه رایگان
                        </Link>
                    )}
                </p>
            </div>
        </>
    );
};

/**
 * Error pages carry no learner rail, tabs, or player: a guest 404 must
 * never show nav destinations that bounce to login. The page itself links
 * back to the app when the visitor is signed in.
 */
function ErrorLayout({ children }: React.PropsWithChildren): React.JSX.Element {
    return (
        <div className="min-h-dvh bg-canvas text-ink">
            <header className="border-b border-line">
                <div className="mx-auto flex min-h-14 w-full max-w-[1024px] items-center px-4">
                    <Link href="/" dir="ltr" className="inline-flex min-h-11 items-center no-underline" aria-label="Fast English — صفحه اصلی">
                        <img src="/images/brand/fastenglish-header-logo.png" alt="" width={113} height={32} className="h-8 w-auto" />
                    </Link>
                </div>
            </header>
            <main id="fe-content">{children}</main>
        </div>
    );
}

ErrorPage.layout = (page: ReactNode) => <ErrorLayout>{page}</ErrorLayout>;

export default ErrorPage;
