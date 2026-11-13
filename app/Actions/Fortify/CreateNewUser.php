<?php

namespace App\Actions\Fortify;

use App\Models\User;
use App\Support\EmailVerificationCodes;
use App\Support\PhoneNumber;
use App\Support\PhoneVerificationCodes;
use App\Support\Sms\SmsStatus;
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
     * When SMS is configured (or the local log driver is active), the
     * phone is required and the six-digit code goes by SMS. Without SMS,
     * the previous email-code flow is kept so registration never dead-ends
     * on a channel this environment cannot deliver.
     *
     * @param  array<string, string>  $input
     *
     * @throws ValidationException
     */
    public function create(array $input): User
    {
        $smsReady = SmsStatus::ready();
        $phone = PhoneNumber::normalize($input['phone'] ?? null);
        $input['phone'] = $phone;

        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique(User::class),
            ],
            'phone' => [
                Rule::requiredIf($smsReady),
                'nullable',
                'regex:/^09\d{9}$/',
                Rule::unique(User::class, 'phone'),
            ],
            'password' => $this->passwordRules(),
        ], [
            'phone.required' => 'شمارهٔ موبایل الزامی است.',
            'phone.regex' => 'شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
            'phone.unique' => 'این شمارهٔ موبایل قبلاً ثبت شده است.',
        ])->validate();

        $user = User::create([
            'name' => $input['name'],
            'email' => $input['email'],
            'phone' => $phone,
            'password' => Hash::make($input['password']),
        ]);

        // A delivery outage must not lose the account: the learner can
        // resend from the verification page. The exception is reported,
        // never echoed.
        try {
            if ($phone !== null) {
                PhoneVerificationCodes::issue($user, PhoneVerificationCodes::PURPOSE_VERIFY);
            } else {
                EmailVerificationCodes::issue($user);
            }
        } catch (Throwable $e) {
            report($e);
        }

        return $user;
    }
}
