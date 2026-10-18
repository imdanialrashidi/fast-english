<?php

namespace App\Http\Responses;

use App\Models\User;
use App\Support\Entitlement;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * Locked learner reply (paid-only gate, owner requirement): the single
 * builder for the 403 locked state shared by the `subscribed` middleware
 * and the inline reader gate.
 *
 * Renders Locked/Index with Entitlement::lockedProps (one CTA, no premium
 * props) at status 403, prepared so the private no-store discipline
 * recognizes the page. JSON callers keep their own 403 shape in the
 * middleware — this builder is the page reply only.
 */
final class LockedResponse
{
    public static function forbidden(Request $request, ?User $user): Response
    {
        $response = Inertia::render('Locked/Index', Entitlement::lockedProps($user))
            ->toResponse($request);
        $response->setStatusCode(403);
        // Middleware replies skip the router's prepare step (default
        // Content-Type); PrivateNoStore keys off text/html.
        $response->prepare($request);

        return $response;
    }
}
