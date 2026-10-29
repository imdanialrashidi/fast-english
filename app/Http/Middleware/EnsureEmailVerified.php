<?php

namespace App\Http\Middleware;

use App\Http\Responses\NoStore;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Email-verification gate (owner request 2026-10-28).
 *
 * A signed-in account without a verified email may reach only the
 * verification surface, auth/logout, the free public sample, and staff
 * authentication routes. Everything else redirects to the code page so a
 * new registration actually completes the flow instead of silently
 * browsing. The route allowlist also prevents a redirect loop.
 */
class EnsureEmailVerified
{
    /**
     * Route names that stay reachable before verification.
     *
     * @var list<string>
     */
    private const ALLOWED = [
        'verification.*',
        'logout',
        'login',
        'login.store',
        'register',
        'register.store',
        'password.*',
        'sample',
        // The public sample's own audio stream: the controller still runs
        // the sample/entitlement policy, so letting the request through is
        // not a premium leak. Without this, an unverified learner could
        // read the sample text but its player would 302 to the gate.
        'media.lesson.audio',
        'download',
        'install',
        'trust.*',
        'pwa.*',
        'robots',
        'sitemap',
        'filament.*',
        'staff.twofactor.*',
        'livewire.*',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || $user->hasVerifiedEmail() || $user->disabled_at !== null) {
            return $next($request);
        }

        if ($request->routeIs(...self::ALLOWED)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'برای ادامه، ایمیل خود را تأیید کنید. کد تأیید را از صفحهٔ تأیید ایمیل دوباره بفرستید.',
            ], 403, NoStore::headers());
        }

        return redirect()->route('verification.notice');
    }
}
