import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * App-like screen bar: the page name, an optional back affordance on nested
 * screens, and at most one contextual action. It replaces the old global
 * brand header — the app no longer repeats the logo on every screen.
 *
 * The bar is sticky and owns its safe-area padding; pages render it before
 * their content wrapper so the border spans the full main column.
 */
export function ScreenHeader({
    title,
    titleLang = 'fa',
    back,
    actions,
    width = 'app',
}: {
    title: string;
    titleLang?: 'fa' | 'en';
    back?: { href: string; label?: string };
    actions?: ReactNode;
    width?: 'app' | 'reading';
}): React.JSX.Element {
    const english = titleLang === 'en';

    return (
        <header className="sticky top-0 z-30 border-b border-line bg-canvas pt-[env(safe-area-inset-top)]">
            <div
                className={`mx-auto flex min-h-14 w-full items-center gap-1 px-4 ${
                    width === 'reading' ? 'max-w-[680px]' : 'max-w-[1024px]'
                }`}
            >
                {back !== undefined && (
                    <Link
                        href={back.href}
                        aria-label={back.label ?? 'بازگشت'}
                        className="fe-press -ms-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink no-underline transition-colors duration-150 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        <ChevronRight size={22} aria-hidden="true" />
                    </Link>
                )}
                <h1
                    lang={english ? 'en' : undefined}
                    dir={english ? 'ltr' : undefined}
                    title={title}
                    className={`m-0 min-w-0 flex-1 truncate text-right text-[1.0625rem] leading-7 font-extrabold tracking-tight ${
                        english ? 'font-en' : ''
                    }`}
                >
                    {title}
                </h1>
                {actions !== undefined && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
            </div>
        </header>
    );
}
