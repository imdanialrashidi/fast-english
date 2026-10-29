<?php

namespace App\Http\Responses;

use Laravel\Fortify\Contracts\RegisterResponse as RegisterResponseContract;
use Laravel\Fortify\Fortify;

/**
 * After registration, send the new account straight to the code page
 * instead of bouncing through /account (which the verification gate would
 * redirect anyway). Verified accounts keep the standard Fortify home.
 */
class RegisterResponse implements RegisterResponseContract
{
    public function toResponse($request)
    {
        $user = $request->user();

        if ($user !== null && ! $user->hasVerifiedEmail()) {
            return redirect()->route('verification.notice');
        }

        return redirect()->intended(Fortify::redirects('register'));
    }
}
