import { Link, router, usePage } from '@inertiajs/react';
import { BookOpen, Compass, House, Languages, User } from 'lucide-react';
import * as React from 'react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PlayerProvider, usePlayerActions, usePlayerTrack } from '@/lib/player';
import type { SharedProps } from '@/types';

/**
 * M1 application shell: the persistent layout for every Inertia page.
 *
 * Editorial publication frame — quiet brand header, desktop rail and
 * mobile tab bar over the four learner destinations (امروز / کشف
 * مطالب / واژه‌ها / حساب), the single persistent studio player above
 * them, and a calm footer. The layout instance survives Inertia visits
 * (persistent layout), so the audio element is never destroyed by
 * in-app navigation; only a full reload (logout) stops it.
 *
 * Fixed layers never cover content: the main column carries
 * end-padding for the player + tabs, and tabs respect the safe area.
 */

interface Destination {
    href: string;
    label: string;
    /** Owner IA (PRODUCT.md amendment 7): the mobile four-tab nav reads «امروز/کشف/واژه‌ها/حساب». */
    shortLabel: string;
    icon: React.ReactNode;
    match: (url: string) => boolean;
}

const DESTINATIONS: Destination[] = [
    {
        href: '/app/today',
        label: 'امروز',
        shortLabel: 'امروز',
        icon: <House size={20} aria-hidden="true" />,
        match: (url) => url.startsWith('/app/today'),
    },
    {
        href: '/app',
        label: 'کشف مطالب',
        shortLabel: 'کشف',
        icon: <Compass size={20} aria-hidden="true" />,
        match: (url) => url === '/app' || url.startsWith('/app/topics') || url.startsWith('/app?'),
    },
    {
        href: '/app/words',
        label: 'واژه‌ها',
        shortLabel: 'واژه‌ها',
        icon: <Languages size={20} aria-hidden="true" />,
        match: (url) => url.startsWith('/app/words'),
    },
    {
        href: '/app/account',
        label: 'حساب',
        shortLabel: 'حساب',
        icon: <User size={20} aria-hidden="true" />,
        match: (url) => url.startsWith('/app/account') || url.startsWith('/account'),
    },
];

function BrandMark({ signedIn }: { signedIn: boolean }): React.JSX.Element {
    return (
        <Link
            href={signedIn ? '/app/today' : '/'}
            className="inline-flex min-h-11 items-center gap-2.5 rounded-full no-underline"
            aria-label="Fast English — صفحه اصلی"
        >
            <img src="/icons/icon-192.png" alt="" width={30} height={30} loading="eager" className="h-[30px] w-[30px] rounded-[9px]" />
            <span lang="en" dir="ltr" className="font-en text-[1.0625rem] font-extrabold tracking-tight">
                Fast English
            </span>
        </Link>
    );
}

function Shell({ children }: React.PropsWithChildren): React.JSX.Element {
    const { props, url } = usePage<SharedProps>();
    const user = props.auth.user;
    const flash = props.flash;
    const [navigating, setNavigating] = React.useState(false);
    const [showSkeleton, setShowSkeleton] = React.useState(false);
    const { clearTrack } = usePlayerActions();
    const track = usePlayerTrack();

    // Logout (or session loss) stops the previous account's audio: the
    // layout survives the redirect visit, so the track must be cleared
    // explicitly — a full reload did this implicitly in the Blade shell.
    // Only the transition to null clears; a guest mount must not wipe a
    // track the new page is binding in the same commit.
    const prevUser = React.useRef(user);
    React.useEffect(() => {
        if (prevUser.current !== null && user === null) {
            clearTrack();
        }
        prevUser.current = user;
    }, [user, clearTrack]);

    // Honest loading state for Inertia visits: a slim progress hairline
    // under the header while the next page loads (no fake content).
    React.useEffect(() => {
        let timer: number | undefined;
        const start = (): void => {
            setNavigating(true);
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setShowSkeleton(true), 180);
        };
        const finish = (): void => {
            window.clearTimeout(timer);
            setNavigating(false);
            setShowSkeleton(false);
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
                href="#fe-content"
                className="absolute start-2 -top-16 z-50 inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-4 py-2 focus:top-2"
            >
                پرش به محتوا
            </a>
            <header className="border-b border-line bg-canvas">
                <div aria-hidden="true" className={navigating ? 'h-0.5 w-full bg-accent' : 'h-0.5 w-full bg-transparent'} />
                <div className="mx-auto flex w-full max-w-[1024px] items-center justify-between gap-3 px-4 py-2.5">
                    <BrandMark signedIn={user !== null} />
                    {user === null && (
                        <nav aria-label="دسترسی سریع" className="flex items-center gap-2">
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
                        </nav>
                    )}
                </div>
            </header>

            <div className="mx-auto grid w-full max-w-[1024px] gap-8 px-4 lg:grid-cols-[12.5rem_1fr]">
                {/* Desktop rail: the same four destinations as the mobile tabs. */}
                <aside className="fe-sidebar hidden lg:block" aria-label="ناوبری اصلی">
                    <nav className="sticky top-4 flex flex-col gap-1 pt-6" aria-label="بخش‌های یادگیری">
                        {DESTINATIONS.map((destination) => {
                            const active = destination.match(url);
                            return (
                                <Link
                                    key={destination.href}
                                    href={destination.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={
                                        active
                                            ? 'inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-full bg-primary px-4 py-2.5 font-bold text-surface no-underline'
                                            : 'inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-full px-4 py-2.5 text-muted no-underline hover:bg-surface hover:text-ink'
                                    }
                                >
                                    {destination.icon}
                                    {destination.label}
                                </Link>
                            );
                        })}
                        <Link
                            href="/app/saved"
                            className={
                                url.startsWith('/app/saved')
                                    ? 'inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-full bg-primary px-4 py-2.5 font-bold text-surface no-underline'
                                    : 'inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-full px-4 py-2.5 text-muted no-underline hover:bg-surface hover:text-ink'
                            }
                            aria-current={url.startsWith('/app/saved') ? 'page' : undefined}
                        >
                            <BookOpen size={20} aria-hidden="true" />
                            ذخیره‌شده‌ها
                        </Link>
                    </nav>
                </aside>

                <div className="min-w-0">
                    {(flash.success !== null || flash.error !== null) && (
                        <div aria-live="polite" className="pt-4">
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
                    {/* End-padding clears the fixed player + mobile tabs.
                        No bound track means only the tabs need clearance. */}
                    <main id="fe-content" className={track === null ? 'pb-28 lg:pb-8' : 'pb-64 lg:pb-52'}>
                        <div className="relative">
                            <div aria-hidden={showSkeleton} inert={showSkeleton ? true : undefined} className={showSkeleton ? 'pointer-events-none opacity-0' : ''}>
                                {children}
                            </div>
                            {showSkeleton && <PageSkeleton />}
                        </div>
                    </main>
                </div>
            </div>

            {/* Fixed audio layer: studio player above the mobile tabs. */}
            <div className="fixed inset-x-0 bottom-0 z-40">
                <div className="mx-auto w-full max-w-[1024px] px-3 pb-2 lg:px-4">
                    <AudioPlayer />
                </div>
                <nav aria-label="بخش‌های یادگیری" className="fe-bottomnav border-t border-line bg-surface lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    <ul className="m-0 grid list-none grid-cols-4 p-0">
                        {DESTINATIONS.map((destination) => {
                            const active = destination.match(url);
                            return (
                                <li key={destination.href} className="min-w-0">
                                    <Link
                                        href={destination.href}
                                        aria-current={active ? 'page' : undefined}
                                        className={
                                            active
                                                ? 'flex min-h-[4.25rem] min-w-11 flex-col items-center justify-center gap-1 text-primary no-underline'
                                                : 'flex min-h-[4.25rem] min-w-11 flex-col items-center justify-center gap-1 text-muted no-underline hover:text-ink'
                                        }
                                    >
                                        {destination.icon}
                                        <span className="text-xs leading-5 font-bold">{destination.shortLabel}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </div>
        </div>
    );
}

export default function AppLayout({ children }: React.PropsWithChildren): React.JSX.Element {
    return (
        <PlayerProvider>
            <Shell>{children}</Shell>
        </PlayerProvider>
    );
}
