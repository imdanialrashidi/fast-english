import * as React from 'react';

/**
 * In-app navigation skeleton (owner follow-up 2026-10-22). Shown only
 * after a short delay so fast visits never flash; the previous content
 * stays mounted underneath and is hidden from interaction. Decorative
 * blocks are aria-hidden and the status text is announced once.
 */
export function PageSkeleton(): React.JSX.Element {
    return (
        <div
            data-page-skeleton
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 top-14 bottom-0 z-50 overflow-y-auto bg-canvas px-4 py-6"
        >
            <span className="sr-only">در حال بارگذاری…</span>
            <div aria-hidden="true" className="mx-auto grid max-w-[680px] gap-4 animate-pulse motion-reduce:animate-none">
                <div className="h-8 w-40 rounded-full bg-line" />
                <div className="h-4 w-3/4 rounded-full bg-line" />
                <div className="mt-2 h-48 rounded-3xl bg-line" />
                <div className="grid gap-2 pt-2">
                    <div className="h-4 w-full rounded-full bg-line" />
                    <div className="h-4 w-11/12 rounded-full bg-line" />
                    <div className="h-4 w-4/5 rounded-full bg-line" />
                    <div className="h-4 w-2/3 rounded-full bg-line" />
                </div>
            </div>
        </div>
    );
}
