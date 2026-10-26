<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * S3 pre-slice correction (scope §16): at most five upload requests per
 * minute per user (authenticated id, else IP) on every upload route.
 *
 * Uploads travel through Livewire's hashed upload endpoint
 * (livewire-XXXXXXXX/upload-file + preview-file), so the middleware matches
 * the route name and the URI shape (same pattern as PrivateNoStore) instead
 * of a fixed path. Filament-only since the learner migration (ADR-0002);
 * the receipt intake (POST payments.receipt.store) shares the same bucket
 * and limit: the sixth request in the window receives 429 with
 * Retry-After. The limit is enforced before any byte is processed.
 */
class ThrottleUploads
{
    public const MAX_ATTEMPTS = 5;

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->isUploadRoute($request)) {
            return $next($request);
        }

        $key = $this->throttleKey($request);

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $retryAfter = RateLimiter::availableIn($key);

            // Throw instead of returning plain text: the shared exception
            // pipeline answers JSON callers with a Persian message and an
            // Inertia visit with the Persian 429 page. No raw framework
            // English reaches the learner.
            throw new ThrottleRequestsException(
                'تعداد بارگذاری‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
                null,
                ['Retry-After' => (string) max($retryAfter, 1)],
            );
        }

        RateLimiter::hit($key, 60);

        return $next($request);
    }

    private function isUploadRoute(Request $request): bool
    {
        $route = $request->route();
        $name = $route ? (string) $route->getName() : '';

        if ($name === 'livewire.upload-file' || $name === 'livewire.preview-file') {
            return true;
        }

        // S5: the receipt intake shares the S4 upload throttle (scope §16).
        if ($name === 'payments.receipt.store') {
            return true;
        }

        $path = trim($request->path(), '/');

        return (bool) preg_match('#^livewire-[^/]+/(upload-file|preview-file)#', $path);
    }

    private function throttleKey(Request $request): string
    {
        $userId = $request->user()?->getAuthIdentifier();

        $bucket = $userId !== null ? 'user:'.$userId : 'ip:'.$request->ip();

        return 'uploads:'.$bucket;
    }
}
