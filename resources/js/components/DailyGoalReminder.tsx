import { Bell, BellOff } from 'lucide-react';
import * as React from 'react';

/**
 * Daily-goal reminder (owner instruction 2026-11-25).
 *
 * A small, opt-in browser notification that tells the learner whether
 * today's goal is done. It is evaluated whenever the app is opened (and on
 * the Today screen), at most once per Tehran calendar day, and it never
 * leaves a scheduled timer that could fire after logout. The reminder text
 * is one short sentence in both states.
 *
 * This is the on-device notification path (Notification API + the app's
 * service worker). True background push is a separate delivery contract.
 */

interface DailyGoalReminderProps {
    goalMinutes: number;
    learnedMinutes: number;
}

type PermissionState = NotificationPermission | 'unsupported';

const STORAGE_KEY = 'fe-daily-goal-reminder';
const LAST_NOTICE_KEY = 'fe-daily-goal-notified';

function todayKey(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
        new Date(),
    );
}

function fa(value: number): string {
    return value.toLocaleString('fa-IR');
}

export function DailyGoalReminder({ goalMinutes, learnedMinutes }: DailyGoalReminderProps): React.JSX.Element | null {
    const [supported, setSupported] = React.useState(false);
    const [permission, setPermission] = React.useState<PermissionState>('default');
    const [enabled, setEnabled] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const done = learnedMinutes >= goalMinutes;

    React.useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            setSupported(false);
            return;
        }

        setSupported(true);
        setPermission(Notification.permission);
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const optedIn = stored === '1';
        setEnabled(optedIn);

        if (!optedIn || Notification.permission !== 'granted') {
            return;
        }

        if (window.localStorage.getItem(LAST_NOTICE_KEY) === todayKey()) {
            return;
        }

        const timer = window.setTimeout(() => {
            void showNotification(done, goalMinutes, learnedMinutes);
            window.localStorage.setItem(LAST_NOTICE_KEY, todayKey());
        }, 900);

        return () => window.clearTimeout(timer);
    }, [done, goalMinutes, learnedMinutes]);

    const showNotification = async (isDone: boolean, goal: number, learned: number): Promise<void> => {
        const body = isDone
            ? `هدف امروزت (${fa(goal)} دقیقه) کامل شد؛ آفرین!`
            : `امروز ${fa(learned)} از ${fa(goal)} دقیقه؛ هنوز وقت داری.`;

        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification('هدف روزانه', {
                    body,
                    icon: '/icons/icon-192.png',
                    badge: '/icons/icon-192.png',
                    tag: 'fe-daily-goal',
                    data: { url: '/app/today' },
                });

                return;
            }

            new Notification('هدف روزانه', { body, icon: '/icons/icon-192.png', tag: 'fe-daily-goal' });
        } catch {
            // Notification failures are non-fatal; the in-app goal card is
            // always the source of truth.
        }
    };

    const enable = async (): Promise<void> => {
        if (!supported) {
            return;
        }

        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== 'granted') {
            setMessage('اجازهٔ اعلان داده نشد. از تنظیمات مرورگر اجازه بده.');
            return;
        }

        window.localStorage.setItem(STORAGE_KEY, '1');
        window.localStorage.removeItem(LAST_NOTICE_KEY);
        setEnabled(true);
        setMessage('یادآور روزانه روشن شد.');
        await showNotification(done, goalMinutes, learnedMinutes);
        window.localStorage.setItem(LAST_NOTICE_KEY, todayKey());
    };

    const disable = (): void => {
        window.localStorage.setItem(STORAGE_KEY, '0');
        window.localStorage.removeItem(LAST_NOTICE_KEY);
        setEnabled(false);
        setMessage('یادآور روزانه خاموش شد.');
    };

    if (!supported) {
        return null;
    }

    return (
        <div className="mt-3 grid gap-2 border-t border-line pt-3">
            <p className="m-0 flex items-center gap-1.5 text-[0.8125rem] leading-6 text-muted">
                {enabled ? <Bell size={15} aria-hidden="true" /> : <BellOff size={15} aria-hidden="true" />}
                {enabled
                    ? 'هر روز یک اعلان کوتاه می‌گیری که هدف روزانه‌ات انجام شده یا نه.'
                    : 'می‌خواهی هر روز یک اعلان کوتاه بگیری که هدف روزانه‌ات انجام شده یا نه؟'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                {enabled ? (
                    <button
                        type="button"
                        onClick={disable}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-canvas px-4 py-2 text-xs font-bold text-ink hover:bg-surface"
                    >
                        <BellOff size={14} aria-hidden="true" />
                        خاموش کردن یادآور
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => void enable()}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-surface hover:bg-primary-hover"
                    >
                        <Bell size={14} aria-hidden="true" />
                        روشن کردن یادآور روزانه
                    </button>
                )}
                {permission === 'denied' && (
                    <span className="text-[0.72rem] leading-6 text-muted">اجازهٔ اعلان در مرورگر بسته است.</span>
                )}
            </div>
            {message !== '' && (
                <p role="status" className="m-0 text-[0.72rem] leading-6 text-muted">
                    {message}
                </p>
            )}
        </div>
    );
}
