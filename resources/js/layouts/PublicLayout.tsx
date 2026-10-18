import { Link, usePage } from '@inertiajs/react';
import type { SharedProps } from '@/types';

/**
 * Public marketing layout (Softly-inspired floating chrome, 2026-10).
 *
 * Warm paper body, floating pill masthead, deep-navy footer. The learner
 * shell (sidebar, bottom tabs, global player) is never mounted here.
 * Only the twelve owner-approved palette tokens are used
 * (bg-canvas/surface, text-ink/muted, border-line, primary, accent);
 * no hex literals, no dark: variant, no backdrop blur, no grain layer,
 * no looping motion. Motion elsewhere is press/hover only and dies
 * under prefers-reduced-motion via the global stylesheet rule.
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

function MarketingBrand({ onDark }: { onDark: boolean }): React.JSX.Element {
    return (
        <Link
            href="/"
            className="inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-full no-underline"
            aria-label="Fast English — صفحه اصلی"
        >
            <span
                aria-hidden="true"
                className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[10px] bg-accent-strong font-en text-xl font-extrabold text-surface"
            >
                F
            </span>
            <span className="flex flex-col leading-5">
                <span lang="en" dir="ltr" className={`font-en text-[1.0625rem] font-extrabold tracking-tight ${onDark ? 'text-surface' : 'text-ink'}`}>
                    Fast English
                </span>
                <span className={`hidden text-xs sm:block ${onDark ? 'text-surface/70' : 'text-muted'}`}>انگلیسی با داستان کوتاه و صوت هماهنگ</span>
            </span>
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
                className="absolute start-2 -top-16 z-50 inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 focus:top-2"
            >
                پرش به محتوا
            </a>
            <div className="sticky top-3 z-40 mx-auto w-full max-w-[1160px] px-4 sm:px-6">
                <header className="flex items-center justify-between gap-2 rounded-full border border-line bg-surface py-2 ps-4 pe-2 shadow-sm">
                    <MarketingBrand onDark={false} />
                    <nav aria-label="ناوبری عمومی" className="flex items-center gap-1">
                        <Link
                            href="/sample"
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full px-3 py-2 text-muted no-underline hover:bg-canvas hover:text-ink"
                        >
                            نمونه رایگان
                        </Link>
                        <Link
                            href="/download"
                            className="hidden min-h-11 min-w-11 items-center rounded-full px-3 py-2 text-muted no-underline hover:bg-canvas hover:text-ink md:inline-flex"
                        >
                            دانلود
                        </Link>
                        <Link
                            href="/faq"
                            className="hidden min-h-11 min-w-11 items-center rounded-full px-3 py-2 text-muted no-underline hover:bg-canvas hover:text-ink sm:inline-flex"
                        >
                            پرسش‌ها
                        </Link>
                        {user === null ? (
                            <>
                                <Link
                                    href="/login"
                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full px-3 py-2 text-muted no-underline hover:bg-canvas hover:text-ink"
                                >
                                    ورود
                                </Link>
                                <Link
                                    href="/register"
                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-accent-strong px-5 py-2 font-bold text-surface no-underline hover:brightness-110"
                                >
                                    ساخت حساب
                                </Link>
                            </>
                        ) : (
                            <Link
                                href="/app/account"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line px-4 py-2 text-ink no-underline hover:bg-canvas"
                            >
                                حساب من
                            </Link>
                        )}
                    </nav>
                </header>
            </div>

            <div className="mx-auto w-full max-w-[1160px] sm:px-6">
                {(flash.success !== null || flash.error !== null) && (
                    <div aria-live="polite" className="px-4 pt-4 sm:px-0">
                        {flash.success !== null && (
                            <p role="status" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-success">
                                {flash.success}
                            </p>
                        )}
                        {flash.error !== null && (
                            <p role="alert" className="m-0 rounded-2xl border border-line bg-surface px-4 py-3 text-danger">
                                {flash.error}
                            </p>
                        )}
                    </div>
                )}
                <main id="fe-public-content">{children}</main>
                <footer className="mt-4 overflow-hidden rounded-t-[2.5rem] bg-ink px-6 pt-10 pb-8 text-surface">
                    <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
                        <div className="grid content-start gap-3">
                            <MarketingBrand onDark />
                            <p className="m-0 max-w-[52ch] leading-8 text-surface/75">
                                Fast English — خواندن و شنیدن هم‌زمان انگلیسی، در سطح خودت. هر مطلب یک متن کوتاه با صوت همان نسخه است.
                            </p>
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
                        </div>
                        <nav aria-label="پیوندهای اعتماد" className="grid content-start gap-1">
                            <p className="m-0 mb-1 font-bold text-surface">دسترسی سریع</p>
                            {TRUST_LINKS.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="inline-flex min-h-11 min-w-11 w-fit items-center rounded-full text-surface/75 no-underline hover:text-surface"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <p className="m-0 mt-8 border-t border-surface/15 pt-4 text-sm text-surface/60">Fast English — یادگیری انگلیسی با خواندن و شنیدن واقعی.</p>
                </footer>
            </div>
        </div>
    );
}

export default function PublicLayout({ children }: React.PropsWithChildren): React.JSX.Element {
    return <Shell>{children}</Shell>;
}

/** Page-level layout binding (arrow: the v3 adapter mounts only prototype-less functions as layouts). */
export const publicLayout = (page: React.ReactNode): React.JSX.Element => <PublicLayout>{page}</PublicLayout>;
