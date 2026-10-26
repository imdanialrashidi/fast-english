import * as React from 'react';

/**
 * Visual confirmation for a completed mutation, above the screen bar.
 *
 * The page keeps its persistent inline status (`role=status`/`alert`) as
 * the accessible and testable source of truth; this toast is aria-hidden
 * so a screen reader never hears the same success twice.
 */
export function Toast({
    message,
    onClose,
    duration = 3500,
}: {
    message: string;
    onClose: () => void;
    duration?: number;
}): React.JSX.Element | null {
    const closeRef = React.useRef(onClose);
    closeRef.current = onClose;

    React.useEffect(() => {
        if (message === '') {
            return;
        }
        const timer = window.setTimeout(() => closeRef.current(), duration);
        return () => window.clearTimeout(timer);
    }, [message, duration]);

    if (message === '') {
        return null;
    }

    return (
        <div
            aria-hidden="true"
            className="fe-enter fixed inset-x-0 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full bg-ink px-4 py-2 text-center text-sm font-bold text-surface shadow-lg"
        >
            {message}
        </div>
    );
}
