import { Link, usePage } from '@inertiajs/react';
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

function MarketingBrand({ onDark, href = '/' }: { onDark: boolean; href?: string }): React.JSX.Element {
    return (
        <Link
            href={href}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-md no-underline"
            aria-label="Fast English — صفحه اصلی"
        >
            <span
                aria-hidden="true"
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-en text-lg font-extrabold ${
                    onDark ? 'bg-surface text-ink' : 'bg-ink text-surface'
                }`}
            >
                F
            </span>
            <span className="hidden flex-col leading-4 min-[350px]:flex">
                <span
                    lang="en"
                    className={`font-en text-[0.9375rem] font-extrabold tracking-tight whitespace-nowrap ${onDark ? 'text-surface' : 'text-ink'}`}
                >
                    Fast English
                </span>
                <span className={`hidden text-[0.6875rem] whitespace-nowrap md:block ${onDark ? 'text-surface/70' : 'text-muted'}`}>
                    خواندن و شنیدن، یک نسخه
                </span>
            </span>
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
    const { props } = usePage<SharedProps>();
    const user = props.auth.user;
    const flash = props.flash;

    return (
        <div className="min-h-dvh bg-canvas text-ink">
            <a
                href="#fe-public-content"
                className="absolute start-2 -top-16 z-50 inline-flex min-h-11 min-w-11 items-center rounded-md border border-line bg-surface px-4 py-2 focus:top-2"
            >
                پرش به محتوا
            </a>

            <header className="sticky top-0 z-40 border-b border-line bg-canvas">
                <div className="mx-auto flex min-h-16 w-full max-w-[1160px] items-center justify-between gap-3 px-4 sm:px-6">
                    <MarketingBrand onDark={false} href={user !== null ? '/app/today' : '/'} />
                    <nav aria-label="ناوبری عمومی" className="flex items-center gap-0.5">
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
                                <NavLink href="/login" className="flex">ورود</NavLink>
                                <Link
                                    href="/register"
                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-4 py-2 font-bold whitespace-nowrap text-surface no-underline hover:bg-primary-hover"
                                >
                                    ساخت حساب
                                </Link>
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
                {(flash.success !== null || flash.error !== null) && (
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

            <footer className="mt-12 bg-ink text-surface">
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
            </footer>
        </div>
    );
}

export default function PublicLayout({ children }: React.PropsWithChildren): React.JSX.Element {
    return <Shell>{children}</Shell>;
}

/** Page-level layout binding (arrow: the v3 adapter mounts only prototype-less functions as layouts). */
export const publicLayout = (page: React.ReactNode): React.JSX.Element => <PublicLayout>{page}</PublicLayout>;
