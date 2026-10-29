import { Link, router, usePage } from '@inertiajs/react';
import * as React from 'react';
import type { SharedProps } from '@/types';

/**
 * Public marketing layout (editorial masthead, 2026-10).
 *
 * A full-width sticky masthead with a hairline rule, warm paper body,
 * and a full-bleed deep-navy footer. The learner shell (sidebar, bottom
 * tabs, global player) is never mounted here. Only the twelve
 * owner-approved palette tokens are used; no hex literals, no dark:
 * variant, no backdrop blur, no grain layer, no looping motion.
 *
 * Mobile first: below 360px the wordmark collapses to the monogram, the
 * section links are hidden, and login/register keep 44px targets. The
 * nav never wraps; every link stays one line.
 */

const TRUST_LINKS = [
    { href: '/about', label: 'درباره' },
    { href: '/cooperation', label: 'همکاری' },
    { href: '/faq', label: 'پرسش‌های پرتکرار' },
    { href: '/support', label: 'پشتیبانی' },
    { href: '/terms', label: 'قوانین' },
    { href: '/privacy', label: 'حریم خصوصی' },
    { href: '/refund', label: 'بازگشت وجه' },
    { href: '/install', label: 'راهنمای نصب' },
    { href: '/download', label: 'دانلود' },
];

// Signed-in learners reach the public shell only through /sample (the
// in-app free lesson). Marketing links would bounce them back to /app,
// so that state gets app-local destinations instead.
const APP_LINKS = [
    { href: '/app/today', label: 'امروز' },
    { href: '/app', label: 'کشف مطالب' },
    { href: '/app/words', label: 'واژه‌ها' },
    { href: '/app/saved', label: 'ذخیره‌شده‌ها' },
    { href: '/app/account', label: 'حساب' },
    { href: '/app/account/settings', label: 'تنظیمات' },
];

function MarketingBrand({ onDark, href = '/' }: { onDark: boolean; href?: string | null }): React.JSX.Element {
    // One owner-supplied lockup everywhere: the navy lockup on paper and the
    // warm-paper lockup on the deep footer. No icon-plus-text approximation.
    // `href=null` renders a static mark (verification has no safe "home"
    // destination for an unverified signed-in account).
    const mark = (
        <img
            src={onDark ? '/images/brand/fastenglish-header-logo-dark.png' : '/images/brand/fastenglish-header-logo.png'}
            alt=""
            width={113}
            height={32}
            className="h-8 w-auto shrink-0"
        />
    );

    if (href === null) {
        return (
            <span dir="ltr" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-self-start">
                {mark}
            </span>
        );
    }

    return (
        <Link
            href={href}
            dir="ltr"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-self-start no-underline"
            aria-label="Fast English — صفحه اصلی"
        >
            {mark}
        </Link>
    );
}

function NavLink({ href, children, className = '' }: React.PropsWithChildren<{ href: string; className?: string }>): React.JSX.Element {
    return (
        <Link
            href={href}
            className={`min-h-11 min-w-11 items-center rounded-md px-3 text-[0.9375rem] whitespace-nowrap text-muted no-underline hover:bg-canvas hover:text-ink ${className}`}
        >
            {children}
        </Link>
    );
}

function Shell({ children }: React.PropsWithChildren): React.JSX.Element {
    const { props, url } = usePage<SharedProps>();
    const user = props.auth.user;
    const flash = props.flash;
    const onLogin = url.startsWith('/login');
    const onRegister = url.startsWith('/register');
    // Verification is authenticated and must not show app links that loop
    // back to the same gate. Keep the masthead mark, drop the nav/footer.
    const onVerify = url.startsWith('/email/verify');
    const [navigating, setNavigating] = React.useState(false);

    React.useEffect(() => {
        let timer: number | undefined;
        const start = (): void => {
            setNavigating(true);
            window.clearTimeout(timer);
            // A hung request must not leave the hairline spinning forever.
            timer = window.setTimeout(() => setNavigating(false), 20_000);
        };
        const finish = (): void => {
            window.clearTimeout(timer);
            setNavigating(false);
        };
        const stopStart = router.on('start', start);
        const stopFinish = router.on('finish', finish);
        return () => {
            window.clearTimeout(timer);
            stopStart();
            stopFinish();
        };
    }, []);

    return (
        <div className="min-h-dvh bg-canvas text-ink">
            <a
                href="#fe-public-content"
                className="absolute start-2 -top-16 z-50 inline-flex min-h-11 min-w-11 items-center rounded-md border border-line bg-surface px-4 py-2 focus:top-2"
            >
                پرش به محتوا
            </a>

            <header className="sticky top-0 z-40 border-b border-line bg-canvas">
                <div aria-hidden="true" className={navigating ? 'h-0.5 w-full bg-accent' : 'h-0.5 w-full bg-transparent'} />
                <div className="mx-auto flex min-h-16 w-full max-w-[1160px] items-center justify-between gap-3 px-4 sm:px-6">
                    <MarketingBrand onDark={false} href={onVerify ? null : user !== null ? '/app/today' : '/'} />
                    <nav aria-label="ناوبری عمومی" className={onVerify ? 'hidden' : 'flex items-center gap-0.5'}>
                        {user === null ? (
                            <>
                                <NavLink href="/sample" className="hidden lg:flex">
                                    نمونه رایگان
                                </NavLink>
                                <NavLink href="/download" className="hidden md:flex">
                                    دانلود
                                </NavLink>
                                <NavLink href="/faq" className="hidden sm:flex">
                                    پرسش‌ها
                                </NavLink>
                                {!onLogin && <NavLink href="/login" className="flex">ورود</NavLink>}
                                {!onRegister && (
                                    <Link
                                        href="/register"
                                        className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-4 py-2 font-bold whitespace-nowrap text-surface no-underline hover:bg-primary-hover"
                                    >
                                        ساخت حساب
                                    </Link>
                                )}
                            </>
                        ) : (
                            <Link
                                href="/app/today"
                                className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 font-bold whitespace-nowrap text-ink no-underline hover:bg-canvas"
                            >
                                بازگشت به اپ
                            </Link>
                        )}
                    </nav>
                </div>
            </header>

            <div className="mx-auto w-full max-w-[1160px]">
                {!onVerify && (flash.success !== null || flash.error !== null) && (
                    <div aria-live="polite" className="px-4 pt-4">
                        {flash.success !== null && (
                            <p role="status" className="m-0 rounded-xl border border-line bg-surface px-4 py-3 text-success">
                                {flash.success}
                            </p>
                        )}
                        {flash.error !== null && (
                            <p role="alert" className="m-0 rounded-xl border border-line bg-surface px-4 py-3 text-danger">
                                {flash.error}
                            </p>
                        )}
                    </div>
                )}
                <main id="fe-public-content" className="scroll-mt-20">{children}</main>
            </div>

            {!onVerify && <footer className="mt-12 bg-ink text-surface">
                <div className="mx-auto grid max-w-[1160px] gap-8 px-4 pt-10 pb-8 sm:px-6 md:grid-cols-[1.2fr_1fr]">
                    <div className="grid content-start gap-3">
                        <MarketingBrand onDark href={user !== null ? '/app/today' : '/'} />
                        <p className="m-0 max-w-[52ch] text-sm leading-7 text-surface/75">
                            Fast English — خواندن و شنیدن هم‌زمان انگلیسی، در سطح خودت. هر مطلب یک متن کوتاه با صوت همان نسخه است.
                        </p>
                        {user === null && (
                            <p className="m-0 flex flex-wrap gap-2 pt-1">
                                <Link
                                    href="/sample"
                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-accent-strong px-5 py-2 font-bold text-surface no-underline hover:brightness-110"
                                >
                                    شروع با نمونه رایگان
                                </Link>
                                <Link
                                    href="/download"
                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-surface/25 px-5 py-2 text-surface no-underline hover:bg-surface/10"
                                >
                                    دانلود
                                </Link>
                            </p>
                        )}
                    </div>
                    <nav aria-label={user === null ? 'پیوندهای اعتماد' : 'دسترسی سریع اپ'} className="grid content-start grid-cols-2 gap-x-6 gap-y-0">
                        <p className="col-span-2 m-0 mb-1 font-bold text-surface">دسترسی سریع</p>
                        {(user === null ? TRUST_LINKS : APP_LINKS).map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="inline-flex min-h-11 min-w-11 w-fit items-center rounded-md text-sm text-surface/75 no-underline hover:text-surface"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                    <p className="m-0 border-t border-surface/15 pt-4 text-sm text-surface/60 md:col-span-2">
                        Fast English — یادگیری انگلیسی با خواندن و شنیدن واقعی.
                    </p>
                </div>
            </footer>}
        </div>
    );
}

export default function PublicLayout({ children }: React.PropsWithChildren): React.JSX.Element {
    return <Shell>{children}</Shell>;
}

/** Page-level layout binding (arrow: the v3 adapter mounts only prototype-less functions as layouts). */
export const publicLayout = (page: React.ReactNode): React.JSX.Element => <PublicLayout>{page}</PublicLayout>;
