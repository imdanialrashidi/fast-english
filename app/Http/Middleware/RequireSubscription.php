<?php

namespace App\Http\Middleware;

use App\Http\Responses\LockedResponse;
use App\Http\Responses\NoStore;
use App\Support\Entitlement;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Paid-only learner gate (owner requirement, alias `subscribed`).
 *
 * Runs after `auth` + `reject.disabled`: the user here is authenticated
 * and not suspended. Staff passes through; active subscribers pass
 * through; everyone else (no subscription, pending, expired, revoked)
 * gets the dedicated locked state — a 403 JSON failure for data/mutation
 * requests, the Locked Inertia page (status 403, no premium props) for
 * page requests. Eligibility is recomputed per request; nothing here
 * trusts client state. Money, snapshot, and approval behavior are
 * untouched — this middleware only refuses, never grants.
 */
class RequireSubscription
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Entitlement::eligible($request->user())) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'اشتراک فعالی وجود ندارد.',
            ], 403, NoStore::headers());
        }

        return LockedResponse::forbidden($request, $request->user());
    }
}
