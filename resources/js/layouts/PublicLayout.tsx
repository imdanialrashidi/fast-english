import { Link, usePage } from '@inertiajs/react';
import type { SharedProps } from '@/types';

/**
 * Public marketing layout: the structural counterpart to the learner
 * AppLayout. Own masthead + footer for the marketing surface only —
 * no learner sidebar, no learner bottom tabs, no global audio player.
 * Elements are not hidden with CSS; the learner shell is never mounted
 * here. Tokens, type, and RTL/LTR rules match the owner-approved light
 * system (DESIGN.md); visual redesign of the marketing surface is a
 * later slice, so this stays deliberately quiet.
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

function PublicBrand(): React.JSX.Element {
    return (
        <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 rounded-full no-underline" aria-label="Fast English — صفحه اصلی">
            <img src="/icons/icon-192.png" alt="" width={30} height={30} loading="eager" className="h-[30px] w-[30px] rounded-[9px]" />
            <span className="flex flex-col leading-5">
                <span lang="en" dir="ltr" className="font-en text-[1.0625rem] font-extrabold tracking-tight">
                    Fast English
                </span>
                <span className="hidden text-xs text-muted sm:block">انگلیسی با داستان کوتاه و صوت هماهنگ</span>
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
            <header className="border-b border-line bg-canvas">
                <div className="mx-auto flex w-full max-w-[1024px] items-center justify-between gap-3 px-4 py-2.5">
                    <PublicBrand />
                    <nav aria-label="ناوبری عمومی" className="flex items-center gap-1 sm:gap-2">
                        <Link
                            href="/sample"
                            className="inline-flex min-h-11 min-w-11 items-center rounded-full px-3 py-2 text-muted no-underline hover:bg-surface hover:text-ink"
                        >
                            نمونه رایگان
                        </Link>
                        <Link
                            href="/faq"
                            className="hidden min-h-11 min-w-11 items-center rounded-full px-3 py-2 text-muted no-underline hover:bg-surface hover:text-ink sm:inline-flex"
                        >
                            پرسش‌ها
                        </Link>
                        {user === null ? (
                            <>
                                <Link
                                    href="/login"
                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full px-3 py-2 text-muted no-underline hover:bg-surface hover:text-ink"
                                >
                                    ورود
                                </Link>
                                <Link
                                    href="/register"
                                    className="inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-4 py-2 font-bold text-surface no-underline hover:bg-primary-hover"
                                >
                                    ساخت حساب
                                </Link>
                            </>
                        ) : (
                            <Link
                                href="/app/account"
                                className="inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 text-ink no-underline hover:bg-canvas"
                            >
                                حساب من
                            </Link>
                        )}
                    </nav>
                </div>
            </header>

            <div className="mx-auto w-full max-w-[1024px]">
                {(flash.success !== null || flash.error !== null) && (
                    <div aria-live="polite" className="px-4 pt-4">
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
                <footer className="border-t border-line px-4 pt-4 pb-8">
                    <p className="m-0 text-sm leading-7 text-muted">Fast English — خواندن و شنیدن هم‌زمان انگلیسی، در سطح خودت.</p>
                    <nav aria-label="پیوندهای اعتماد" className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                        {TRUST_LINKS.map((link) => (
                            <Link key={link.href} href={link.href} className="inline-flex min-h-11 min-w-11 items-center text-sm text-muted no-underline hover:text-ink">
                                {link.label}
                            </Link>
                        ))}
                    </nav>
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
