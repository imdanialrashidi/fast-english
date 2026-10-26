import { Link, router, usePage } from '@inertiajs/react';
import type { GlobalEvent } from '@inertiajs/core';
import { BookOpen, Compass, House, Languages, User } from 'lucide-react';
import * as React from 'react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PlayerProvider, usePlayerActions, usePlayerExpanded, usePlayerTrack } from '@/lib/player';
import type { SharedProps } from '@/types';

/**
 * M1 application shell: the persistent layout for every Inertia page.
 *
 * App-like frame — no repeated brand bar: each screen owns a contextual
 * ScreenHeader (title, back, one action), the desktop rail keeps the
 * owner lockup, and the mobile tab bar carries the four destinations
 * (امروز / کشف مطالب / واژه‌ها / حساب) with the single persistent studio
 * player above them. The layout instance survives Inertia visits
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

function Shell({ children }: React.PropsWithChildren): React.JSX.Element {
    const { props, url } = usePage<SharedProps>();
    const user = props.auth.user;
    const flash = props.flash;
    const dueWords = props.due_words ?? 0;
    const [navigating, setNavigating] = React.useState(false);
    const [showSkeleton, setShowSkeleton] = React.useState(false);
    const { clearTrack } = usePlayerActions();
    const track = usePlayerTrack();
    const expanded = usePlayerExpanded();

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
    // under the header while the next page loads (no fake content). The
    // skeleton is skipped for partial reloads (they keep the page) and a
    // hung request is released after 20 s so the page never stays inert.
    React.useEffect(() => {
        let timer: number | undefined;
        let guard: number | undefined;
        const finish = (): void => {
            window.clearTimeout(timer);
            window.clearTimeout(guard);
            setNavigating(false);
            setShowSkeleton(false);
        };
        const start = (event: GlobalEvent<'start'>): void => {
            setNavigating(true);
            window.clearTimeout(timer);
            window.clearTimeout(guard);
            setShowSkeleton(false);
            if (event.detail.visit.only.length === 0) {
                timer = window.setTimeout(() => setShowSkeleton(true), 180);
            }
            guard = window.setTimeout(finish, 20_000);
        };
        const stopStart = router.on('start', start);
        const stopFinish = router.on('finish', finish);
        return () => {
            window.clearTimeout(timer);
            window.clearTimeout(guard);
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
            {/* Fixed navigation hairline: the only global chrome. Screens own
                their title/back bar, so the app never repeats the brand. */}
            <div
                aria-hidden="true"
                className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-accent transition-opacity duration-150 ${navigating ? 'opacity-100' : 'opacity-0'}`}
            />

            <div className="mx-auto grid w-full max-w-[1024px] gap-8 px-4 lg:grid-cols-[12.5rem_1fr]">
                {/* Desktop rail: the same four destinations as the mobile tabs,
                    and the one place the app shell keeps the brand lockup. */}
                <aside className="fe-sidebar hidden lg:block" aria-label="ناوبری اصلی">
                    <Link href="/app/today" dir="ltr" className="mb-2 inline-flex min-h-11 items-center no-underline" aria-label="Fast English — صفحه اصلی">
                        <img
                            src="/images/brand/fastenglish-header-logo.png"
                            alt=""
                            width={92}
                            height={26}
                            loading="eager"
                            className="h-[26px] w-auto"
                        />
                    </Link>
                    <nav className="flex flex-col gap-1" aria-label="بخش‌های یادگیری">
                        {DESTINATIONS.map((destination) => {
                            const active = destination.match(url);
                            return (
                                <Link
                                    key={destination.href}
                                    href={destination.href}
                                    aria-current={active ? 'page' : undefined}
                                    className={
                                        active
                                            ? 'inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-full bg-primary/10 px-4 py-2.5 font-bold text-primary no-underline transition-colors duration-150'
                                            : 'inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-full px-4 py-2.5 text-muted no-underline transition-colors duration-150 hover:bg-surface hover:text-ink'
                                    }
                                >
                                    {destination.icon}
                                    {destination.label}
                                    {destination.href === '/app/words' && dueWords > 0 && (
                                        <span
                                            data-due-badge={dueWords}
                                            aria-label={`${dueWords.toLocaleString('fa-IR')} واژه موعد`}
                                            className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-strong px-1 text-[0.6875rem] font-bold text-surface"
                                        >
                                            {dueWords.toLocaleString('fa-IR')}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                        <Link
                            href="/app/saved"
                            className={
                                url.startsWith('/app/saved')
                                    ? 'inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-full bg-primary/10 px-4 py-2.5 font-bold text-primary no-underline transition-colors duration-150'
                                    : 'inline-flex min-h-11 min-w-11 items-center gap-2.5 rounded-full px-4 py-2.5 text-muted no-underline transition-colors duration-150 hover:bg-surface hover:text-ink'
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
                        The expanded console is roughly a third taller, so
                        the reserved space follows the expansion state. */}
                    <main
                        id="fe-content"
                        className={
                            track === null
                                ? 'pb-28 lg:pb-8'
                                : expanded
                                  ? 'pb-[22rem] lg:pb-[19rem]'
                                  : 'pb-64 lg:pb-52'
                        }
                    >
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
                                        aria-label={
                                            destination.href === '/app/words' && dueWords > 0
                                                ? `واژه‌ها، ${dueWords.toLocaleString('fa-IR')} واژه موعد`
                                                : undefined
                                        }
                                        className={
                                            active
                                                ? 'fe-press flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 text-primary no-underline'
                                                : 'fe-press flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 text-muted no-underline transition-colors duration-150 hover:text-ink'
                                        }
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={
                                                active
                                                    ? 'relative inline-flex h-7 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-150'
                                                    : 'relative inline-flex h-7 w-12 items-center justify-center rounded-full text-muted transition-colors duration-150'
                                            }
                                        >
                                            {destination.icon}
                                            {destination.href === '/app/words' && dueWords > 0 && (
                                                <span
                                                    data-due-badge={dueWords}
                                                    className="absolute -top-1 -end-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-strong px-1 text-[0.625rem] font-bold text-surface"
                                                >
                                                    {dueWords > 99 ? '۹۹+' : dueWords.toLocaleString('fa-IR')}
                                                </span>
                                            )}
                                        </span>
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
