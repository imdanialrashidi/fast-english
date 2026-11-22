import { Link } from '@inertiajs/react';
import type { LibraryTab } from '@/types';

/**
 * One tab row for every books screen. The URL is the state: a tab is a
 * normal link, so back, refresh and a shared address all land correctly.
 */
export function BookTabs({ tabs }: { tabs: LibraryTab[] }): React.JSX.Element {
    return (
        <nav aria-label="بخش‌های کتاب‌ها" className="min-w-0 max-w-full overflow-x-auto pb-1">
            <div className="flex min-w-max items-center gap-1.5">
                {tabs.map((tab) => (
                    <Link
                        key={tab.key}
                        href={tab.url}
                        aria-current={tab.active ? 'page' : undefined}
                        className={`fe-press inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold no-underline transition-colors ${
                            tab.active
                                ? 'border-ink bg-ink text-surface'
                                : 'border-line bg-surface text-muted hover:border-ink/30 hover:text-ink'
                        }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>
        </nav>
    );
}
