<?php

namespace App\Http\Controllers;

use App\Support\PublicAssets;
use Illuminate\Support\Facades\File;

/**
 * S2 early-mobile proof: PWA shell routes + TWA asset links (scope §18).
 *
 * - /manifest.webmanifest: Fast English (fa/RTL, standalone,
 *   start_url /app, scope /). Icons are the owner-supplied app mark
 *   (Logo/fast_english_app_favicon.png) rendered at 192/512/maskable/180.
 * - /sw.js: allowlist-only service worker. Precaches fingerprinted public
 *   assets, icons, the self-hosted Vazirmatn font, and the public offline
 *   page. Everything else — HTML navigations, auth, Livewire, admin,
 *   receipts, progress, placement, media (including the sample audio) — is
 *   network-only and never cached. Versioned cache names; old fe-* caches
 *   are deleted on activation. Served no-store so updates are discovered.
 * - /offline: public offline page with the exact message
 *   «برای ادامه به اینترنت وصل شوید» and a retry control.
 * - /.well-known/assetlinks.json: TWA association; empty until the release
 *   package + SHA-256 fingerprint are configured (staging + real signing
 *   are BLOCKED in S2, recorded in the active exec plan).
 * - /robots.txt: index discipline — staging/non-production is noindex
 *   (scope §19.1).
 */
class PwaController extends Controller
{
    public function manifest()
    {
        return response()->json([
            'name' => 'Fast English',
            'short_name' => 'Fast English',
            'description' => 'Fast English — خواندن و شنیدن متن‌های کوتاه انگلیسی در سطح مناسب',
            'lang' => 'fa',
            'dir' => 'rtl',
            'display' => 'standalone',
            'start_url' => '/app',
            'scope' => '/',
            'background_color' => '#f7f5ef',
            'theme_color' => '#f7f5ef',
            'icons' => [
                ['src' => '/icons/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png'],
                ['src' => '/icons/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png'],
                ['src' => '/icons/icon-maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
                ['src' => '/icons/apple-touch-180.png', 'sizes' => '180x180', 'type' => 'image/png'],
            ],
        ], 200, ['Content-Type' => 'application/manifest+json']);
    }

    public function serviceWorker()
    {
        $version = $this->swVersion();

        return response()
            ->view('pwa.service-worker', [
                'version' => $version,
                'precache' => PublicAssets::precache(),
            ])
            ->withHeaders([
                'Content-Type' => 'application/javascript; charset=utf-8',
                'Cache-Control' => 'no-store',
                'Service-Worker-Allowed' => '/',
            ]);
    }

    public function offline()
    {
        return response()->view('pwa.offline');
    }

    public function assetlinks()
    {
        $package = (string) config('pwa.twa_package', '');
        $fingerprint = (string) (config('pwa.twa_fingerprint') ?? '');

        $statements = [];
        if ($package !== '' && $fingerprint !== '') {
            $statements[] = [
                'relation' => ['delegate_permission/common.handle_all_urls'],
                'target' => [
                    'namespace' => 'android_app',
                    'package_name' => $package,
                    'sha256_cert_fingerprints' => [$fingerprint],
                ],
            ];
        }

        return response()->json($statements, 200, ['Content-Type' => 'application/json']);
    }

    /**
     * S8 index discipline (scope §19.1): staging/non-production stays
     * fully disallowed. In production only the public marketing pages
     * are crawlable; the private surfaces (/app, /admin, auth, /media,
     * /staff) are disallowed here AND carry noindex headers via
     * PrivateNoStore, so they stay out even if linked.
     */
    public function robots()
    {
        if (! app()->environment('production')) {
            $body = "User-agent: *\nDisallow: /\n";
        } else {
            $body = "User-agent: *\nDisallow: /app\nDisallow: /admin\nDisallow: /account\nDisallow: /login\nDisallow: /register\nDisallow: /forgot-password\nDisallow: /reset-password\nDisallow: /media\nDisallow: /staff\nSitemap: ".config('app.url')."/sitemap.xml\n";
        }

        return response($body, 200, ['Content-Type' => 'text/plain; charset=utf-8']);
    }

    /**
     * File override lets a browser test trigger a genuine SW update
     * (byte-different script → updatefound) without restarting the server.
     * Ignored under APP_ENV=testing so Pest stays deterministic.
     */
    public function swVersion(): string
    {
        if (! app()->environment('testing')) {
            $override = storage_path('app/sw-version');
            if (is_file($override)) {
                $value = trim((string) File::get($override));
                if ($value !== '') {
                    return $value;
                }
            }
        }

        $version = trim((string) config('pwa.sw_version', ''));

        return $version !== '' ? $version : 's2-v1';
    }
}
