<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Marketing/landing boundary (owner requirement, 2026-10-21): the public
 * landing system is for guests and search engines only. A signed-in
 * learner who follows a stale marketing link is sent straight back into
 * the app instead of seeing a second, unauthenticated shell.
 */
class RedirectAuthenticatedToApp
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() !== null) {
            return redirect()->route('today.index');
        }

        return $next($request);
    }
}
