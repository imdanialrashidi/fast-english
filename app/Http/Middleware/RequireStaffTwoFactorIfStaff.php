<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Conditional staff step-up for routes shared by owners and staff.
 *
 * The receipt route is owner-facing, so applying RequireStaffTwoFactor
 * directly would also challenge learners. This wrapper applies the same
 * gate only when the authenticated user is staff; non-staff requests keep
 * their owner-only policy path. Guests are handled by `auth` before this.
 */
class RequireStaffTwoFactorIfStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null || ! $user->is_staff) {
            return $next($request);
        }

        return app(RequireStaffTwoFactor::class)->handle($request, $next);
    }
}
