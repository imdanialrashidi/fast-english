import { Link } from '@inertiajs/react';
import type { FunctionComponent } from 'react';
/**
 * The reader's level switcher: A1–C2 only. TED Talks live in their own
 * section (owner instruction 2026-11-22), so a podcast topic never grows a
 * seventh pill and the level row keeps its original shape.
 */
export function LevelTabs({
    topicSlug,
    levels,
    activeLevel,
}: {
    topicSlug: string;
    levels: string[];
    activeLevel: string | null;
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
            </div>
        </nav>
    );
}
