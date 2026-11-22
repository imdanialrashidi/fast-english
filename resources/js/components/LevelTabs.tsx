import { Link } from '@inertiajs/react';
import type { FunctionComponent } from 'react';
import type { TedTabLink } from '@/types';

/**
 * The reader's section switcher: A1–C2 plus the seventh TED Talk tab.
 *
 * Shared by the podcast reader and the TED reader so the two pages cannot
 * drift. The TED tab renders only when a published talk is attached to the
 * topic (the server sends `ted: null` otherwise), so it is never a dead
 * link. `activeLevel` null means the TED tab is the current page.
 */
export function LevelTabs({
    topicSlug,
    levels,
    activeLevel,
    ted,
}: {
    topicSlug: string;
    levels: string[];
    activeLevel: string | null;
    ted: TedTabLink | null;
}): React.JSX.Element {
    const activeClass =
        'inline-flex min-h-11 min-w-11 items-center rounded-full bg-primary px-5 py-2 font-en font-bold text-surface no-underline';
    const idleClass =
        'inline-flex min-h-11 min-w-11 items-center rounded-full border border-line bg-surface px-5 py-2 font-en text-ink no-underline hover:bg-canvas';

    return (
        <nav aria-label="سطح درس" className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="m-0 text-sm font-bold text-muted">سطح این مطلب:</p>
            <div className="flex flex-wrap gap-2">
                {levels.map((level) => (
                    <Link
                        key={level}
                        href={`/app/topics/${topicSlug}?level=${level}`}
                        aria-current={level === activeLevel ? 'page' : undefined}
                        className={level === activeLevel ? activeClass : idleClass}
                    >
                        <span lang="en" dir="ltr">
                            {level}
                        </span>
                    </Link>
                ))}
                {ted !== null && (
                    <Link
                        href={ted.url}
                        aria-current={activeLevel === null ? 'page' : undefined}
                        className={activeLevel === null ? activeClass : idleClass}
                    >
                        <span lang="en" dir="ltr">
                            TED Talk
                        </span>
                    </Link>
                )}
            </div>
        </nav>
    );
}
