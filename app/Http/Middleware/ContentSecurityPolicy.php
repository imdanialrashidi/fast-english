<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Defence-in-depth CSP for HTML responses.
 *
 * The app ships no third-party runtime scripts: Vazirmatn is self-hosted,
 * Inertia/Livewire talk to the same origin, and media is served by the app.
 * Inline styles and the inline JSON-LD/Inertia bootstrap need
 * `'unsafe-inline'`; the admin panel (Livewire/Alpine) additionally needs
 * `'unsafe-eval'`. A nonce pipeline would be stronger, but this baseline
 * already blocks external script injection, framing, plugins, base hijack
 * and cross-origin exfiltration.
 */
class ContentSecurityPolicy
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $contentType = (string) $response->headers->get('Content-Type', '');
        if (! str_contains($contentType, 'text/html')) {
            return $response;
        }

        $isPanel = $request->is('admin') || $request->is('admin/*')
            || $request->is('staff') || $request->is('staff/*')
            || $request->is('livewire/*');

        $script = $isPanel
            ? "'self' 'unsafe-inline' 'unsafe-eval'"
            : "'self' 'unsafe-inline'";

        $policy = implode('; ', [
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'self'",
            "form-action 'self'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            'script-src '.$script,
            "connect-src 'self'",
            "media-src 'self' blob:",
        ]);

        $response->headers->set('Content-Security-Policy', $policy);

        return $response;
    }
}
