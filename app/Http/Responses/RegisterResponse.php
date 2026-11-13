<?php

namespace App\Http\Responses;

use Laravel\Fortify\Contracts\RegisterResponse as RegisterResponseContract;
use Laravel\Fortify\Fortify;

/**
 * After registration, send the new account straight to the code page
 * instead of bouncing through /account (which the verification gate would
 * redirect anyway). A phone-registered account verifies by SMS; an
 * email-only account keeps the email code page. Verified accounts keep the
 * standard Fortify home.
 */
class RegisterResponse implements RegisterResponseContract
{
    public function toResponse($request)
    {
        $user = $request->user();

        if ($user !== null && ! $user->accountVerified()) {
            return redirect()->route($user->phone !== null ? 'phone.notice' : 'verification.notice');
        }

        return redirect()->intended(Fortify::redirects('register'));
    }
}
