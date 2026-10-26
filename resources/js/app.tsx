import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '@/lib/install';
import type { SharedProps } from '@/types';

/**
 * M0 Inertia entry (Inertia 3 + React 19 + TypeScript).
 * Pages resolve from ./pages/*.tsx with per-page code splitting (the
 * official laravel-vite-plugin helper). Each page sets its own `.layout`
 * so later slices can use persistent layouts; the error boundary catches
 * render crashes with one calm Persian fallback.
 */
void createInertiaApp<SharedProps>({
    // Manual page resolution per https://inertiajs.com/client-side-setup:
    // pages resolve from ./pages/*.tsx with per-page code splitting.
    // Each page sets its own `.layout` so later slices can use persistent
    // layouts (the M2 audio element will live in one).
    resolve: (name) => {
        const pages = import.meta.glob<{ default: ResolvedComponent }>('./pages/**/*.tsx');
        const importer = pages[`./pages/${name}.tsx`];
        if (typeof importer === 'undefined') {
            throw new Error(`Inertia page not found: ${name}`);
        }
        return importer().then((module) => module.default);
    },
    setup({ el, App, props }) {
        createRoot(el).render(
            <ErrorBoundary>
                <App {...props} />
            </ErrorBoundary>,
        );
    },
    title: (title) => {
        const brand = 'Fast English';

        if (title === '') {
            return brand;
        }

        return title.includes(brand) ? title : `${title} · ${brand}`;
    },
});
