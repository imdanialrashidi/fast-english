import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import inertia from '@inertiajs/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                // Preserved server-rendered pages (staff 2FA, error pages)
                // keep the light-only server stylesheet (ADR-0002).
                'resources/css/app.css',
                'resources/js/pwa.js',
                // M0 Inertia foundation (ADR-0002): the React/TS entry and
                // its permanent-light stylesheet.
                'resources/css/inertia.css',
                'resources/js/app.tsx',
            ],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        tailwindcss(),
        react(),
        inertia(),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
