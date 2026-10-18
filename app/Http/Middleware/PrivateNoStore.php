<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * S2 privacy boundary (scope §16): account, admin, and Livewire HTML
 * responses — and every Livewire update response — are private and
 * uncacheable. Media responses set the same header in their own
 * controller. Public fingerprinted assets are untouched (non-HTML).
 *
 * Index discipline (scope §19.1; S8-4): non-production HTML carries
 * X-Robots-Tag noindex so a staging host is never indexed. In every
 * environment — including production — the private surfaces stay out of
 * indexes: /app, /admin, /login + register + password routes, /media,
 * and /staff. Only the public marketing pages (/, trust pages,
 * /download) are indexable, with canonical tags + sitemap. Robots and
 * noindex are index discipline, not a security control.
 */
class PrivateNoStore
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $contentType = (string) $response->headers->get('Content-Type', '');
        $isHtml = str_contains($contentType, 'text/html');
        // Inertia protocol visits (X-Inertia) return JSON carrying premium
        // props (reader body/glossary/audio_url) — same private discipline
        // as the initial HTML visit. Locked by D5PrivacyHeadersTest.
        $isInertia = $request->headers->has('X-Inertia') || $request->headers->has('X-Inertia-Version');

        // Livewire 4 serves its update endpoint under a hashed prefix
        // (livewire-XXXXXXXX/update). Filament's internal Livewire is the
        // only consumer; the panel carries its own copy of this middleware,
        // and this branch covers the update XHR on `web`. Locked by
        // S2CacheHeadersTest ("livewire update responses are private and
        // uncacheable").
        $route = $request->route();
        $routeName = $route ? (string) $route->getName() : '';
        $isLivewireUpdate = str_starts_with($routeName, 'livewire')
            || str_starts_with($routeName, 'default-livewire')
            || (bool) preg_match('#^livewire-[^/]+/(update|upload-file|preview-file)#', trim($request->path(), '/'));

        if ($isHtml || $isInertia || $isLivewireUpdate) {
            $response->headers->set('Cache-Control', 'private, no-store');
        }

        if ($isHtml && ! app()->environment('production')) {
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        } elseif ($isHtml && self::isPrivateSurface($request)) {
            // S8-4: these paths are noindex even in production.
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        }

        return $response;
    }

    /**
     * S8-4: app, admin, login/auth, media, and staff surfaces are never
     * indexed. Public marketing pages are matched by exclusion.
     */
    public static function isPrivateSurface(Request $request): bool
    {
        $path = '/'.trim($request->path(), '/');

        foreach (['/app', '/admin', '/login', '/register', '/forgot-password', '/reset-password', '/media', '/staff', '/account'] as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                return true;
            }
        }

        return false;
    }
}
