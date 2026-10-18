import * as React from 'react';

/**
 * M0 error boundary: a render crash in any Inertia page shows one calm
 * Persian fallback with a reload action instead of a blank document.
 * Server failures (403/404/500/503) are handled by the React ErrorPage
 * via Inertia::handleExceptionsUsing, not by this boundary.
 */
interface ErrorBoundaryState {
    hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
    public state: ErrorBoundaryState = { hasError: false };

    public static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    public componentDidCatch(error: unknown): void {
        // No product data, no secrets — one line for the ops log.
        console.error('Fast English page render failed.', error);
    }

    public render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <main className="mx-auto grid max-w-[680px] gap-4 px-4 py-12">
                    <h1 className="text-2xl font-bold">خطایی در نمایش این صفحه رخ داد.</h1>
                    <p className="leading-8 text-muted">صفحه را دوباره بارگذاری کنید؛ اگر مشکل ادامه داشت، بعداً تلاش کنید.</p>
                    <p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center rounded-full bg-primary px-6 py-2 font-bold text-surface hover:bg-primary-hover"
                        >
                            تلاش دوباره
                        </button>
                    </p>
                </main>
            );
        }

        return this.props.children;
    }
}
