/**
 * One early capture point for Chromium's `beforeinstallprompt`.
 *
 * The event fires once, usually on the first page load. Capturing it only
 * inside the Account card would miss it on every later Inertia visit, so
 * `app.tsx` imports this module at boot and the card reads/subscribes to
 * the stored event. iOS Safari never fires it; the card stays absent.
 */
export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(event: BeforeInstallPromptEvent | null) => void>();

function notify(): void {
    listeners.forEach((listener) => listener(deferred));
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferred = event as BeforeInstallPromptEvent;
        notify();
    });
    window.addEventListener('appinstalled', () => {
        deferred = null;
        notify();
    });
}

export function currentInstallPrompt(): BeforeInstallPromptEvent | null {
    return deferred;
}

export function clearInstallPrompt(): void {
    deferred = null;
    notify();
}

export function subscribeInstallPrompt(listener: (event: BeforeInstallPromptEvent | null) => void): () => void {
    listeners.add(listener);
    listener(deferred);

    return () => {
        listeners.delete(listener);
    };
}
