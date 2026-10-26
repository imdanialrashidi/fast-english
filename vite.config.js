import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import inertia from '@inertiajs/vite';

export default defineConfig(({ mode }) => {
    // laravel-vite-plugin disables Vite's publicDir, so root-relative
    // asset URLs inside CSS (the self-hosted Vazirmatn faces) resolve
    // against the Vite origin in dev and 404. Proxy the public fonts to
    // the Laravel origin; the production build still serves them from
    // /public through the app.
    const env = loadEnv(mode, process.cwd(), '');
    const appUrl = (env.APP_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');

    // One public-asset allowlist, shared with App\Support\PublicAssets.
    // Adding or renaming an entry updates both the build and the
    // service-worker precache; no second list to drift.
    const publicAssets = JSON.parse(
        readFileSync(new URL('./resources/public-assets.json', import.meta.url), 'utf8'),
    );

    return {
        plugins: [
            laravel({
                // Public allowlist entries stay the single source for the
                // service worker. The Filament admin theme is a Vite input
                // too, but deliberately not a public/precache entry.
                input: [
                    ...publicAssets.viteInputs.map((entry) => entry.path),
                    'resources/css/filament/admin/theme.css',
                ],
                refresh: true,
            }),
            tailwindcss(),
            react(),
            inertia(),
        ],
        server: {
            watch: {
                ignored: ['**/storage/framework/views/**'],
            },
            proxy: {
                '/fonts': {
                    target: appUrl,
                    changeOrigin: true,
                },
            },
        },
    };
});
