<?php

namespace App\Actions\Fortify;

use App\Models\User;
use App\Support\EmailVerificationCodes;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;
use Throwable;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     *
     * @throws ValidationException
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique(User::class),
            ],
            'password' => $this->passwordRules(),
        ])->validate();

        $user = User::create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => Hash::make($input['password']),
        ]);

        // Owner request 2026-10-28: a six-digit code goes to the new
        // address. A mail outage must not lose the account: the learner
        // can resend from the verification page (the page detects that no
        // active code exists). The exception is reported, never echoed.
        try {
            EmailVerificationCodes::issue($user);
        } catch (Throwable $e) {
            report($e);
        }

        return $user;
    }
}
