<?php

namespace App\Http\Middleware;

use App\Support\Entitlement;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * After activation, the learner completes the short profile before the
 * learning environment opens. Ineligible learners pass through so the
 * locked preview remains reachable; completed profiles pass untouched.
 */
class EnsureProfileComplete
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || ! $user->needs_profile) {
            return $next($request);
        }

        if (! Entitlement::eligible($user)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'برای ادامه، اطلاعات حساب را کامل کنید.'], 409);
        }

        return redirect()->route('onboarding.show');
    }
}
