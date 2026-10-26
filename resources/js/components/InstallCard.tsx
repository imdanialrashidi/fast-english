import { Download } from 'lucide-react';
import * as React from 'react';
import { clearInstallPrompt, currentInstallPrompt, subscribeInstallPrompt } from '@/lib/install';

/**
 * Install affordance for the PWA. Chromium fires beforeinstallprompt once
 * the install criteria are met; the card stores that event and asks only
 * when the learner taps. Dismissal is remembered locally, and an already
 * installed (standalone) window never sees the card.
 *
 * iOS Safari does not fire the event; no fake install button is shown
 * there — the browser's own «Add to Home Screen» remains the only path.
 */
const DISMISS_KEY = 'fe-install-dismissed';

function isStandalone(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

export function InstallCard(): React.JSX.Element | null {
    const [promptEvent, setPromptEvent] = React.useState(currentInstallPrompt);
    const [dismissed, setDismissed] = React.useState(false);

    React.useEffect(() => {
        try {
            setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
        } catch {
            setDismissed(false);
        }

        return subscribeInstallPrompt(setPromptEvent);
    }, []);

    if (dismissed || promptEvent === null || isStandalone()) {
        return null;
    }

    const rememberDismissal = (): void => {
        try {
            window.localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // Storage can be unavailable in private modes; the card still closes.
        }
        setDismissed(true);
        clearInstallPrompt();
    };

    const install = async (): Promise<void> => {
        try {
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            clearInstallPrompt();
            if (choice.outcome === 'dismissed') {
                rememberDismissal();
            }
        } catch {
            rememberDismissal();
        }
    };

    return (
        <section aria-label="نصب اپلیکیشن" className="grid gap-3 rounded-3xl border border-line bg-surface p-5">
            <p className="m-0 inline-flex items-center gap-2 text-sm font-bold text-primary">
                <Download size={18} aria-hidden="true" />
                نسخه اپلیکیشن
            </p>
            <p className="m-0 text-lg leading-8 font-bold">Fast English را روی صفحه اصلی نصب کن</p>
            <p className="m-0 text-sm leading-7 text-muted">
                بدون نوار مرورگر باز می‌شود و پخش صوت و مطالعه در همان اپ ادامه پیدا می‌کند.
            </p>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => void install()}
                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-surface hover:bg-primary-hover"
                >
                    <Download size={18} aria-hidden="true" />
                    نصب اپ
                </button>
                <button
                    type="button"
                    onClick={rememberDismissal}
                    className="inline-flex min-h-11 min-w-11 cursor-pointer items-center rounded-full px-4 py-2 text-sm text-muted hover:bg-canvas hover:text-ink"
                >
                    بعداً
                </button>
            </div>
        </section>
    );
}
