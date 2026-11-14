<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * One canonical spelling for the public marketing URLs. Laravel matches
 * `/about/` to the same route as `/about`, so without this redirect both
 * return 200 with the same canonical. Only GET/HEAD public paths are
 * normalized; app, admin, media, and API paths keep their own routing.
 */
class NormalizeTrailingSlash
{
    /** Public paths that must answer on the slashless URL. */
    private const PUBLIC_PATHS = [
        '/about',
        '/cooperation',
        '/faq',
        '/support',
        '/terms',
        '/privacy',
        '/refund',
        '/download',
        '/install',
        '/sample',
        '/plans',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethod('GET') && ! $request->isMethod('HEAD')) {
            return $next($request);
        }

        $path = parse_url($request->getRequestUri(), PHP_URL_PATH);
        if (! is_string($path) || $path === '/' || ! str_ends_with($path, '/')) {
            return $next($request);
        }

        $trimmed = rtrim($path, '/');
        if (! in_array($trimmed, self::PUBLIC_PATHS, true)) {
            return $next($request);
        }

        $query = $request->getQueryString();

        return redirect($trimmed.($query !== null && $query !== '' ? '?'.$query : ''), 301);
    }
}
