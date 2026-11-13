<?php

namespace App\Http\Controllers;

use App\Actions\PublishLesson;
use App\Models\User;
use App\Support\PhoneNumber;
use App\Support\PhoneVerificationCodes;
use App\Support\Sms\SmsStatus;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * S4 level preference (scope §7.2, LEVEL-01): preferred_level changes only
 * through this explicit settings form. Browsing a ?level= URL never writes
 * here (TopicReaderController performs no user writes).
 *
 * Owner request 2026-11-12: the same form links a mobile number so phone
 * login can be used. A changed number is saved unverified and the account
 * is routed to the SMS code page; if the provider cannot send, the previous
 * number is restored so the learner is not locked out.
 *
 * Guests keep their selected level as a non-sensitive browser preference
 * (localStorage, no token/receipt/body/answer key — see the React player
 * lib in resources/js/lib/player.tsx).
 * When the preferred level has no lesson for a topic, the reader shows the
 * available levels and never substitutes silently (S1 rule, unchanged).
 */
class AccountSettingsController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        // Public-slice Inertia transport (ADR-0002): the same explicit
        // settings form. The retired learner Livewire component's display-
        // name rule lives here now (same required/string/255 server rule);
        // the dark/system appearance radios are gone with the permanent
        // light theme (no theme storage, no theme-choice UI).
        return Inertia::render('Account/Settings', [
            'user' => [
                'name' => (string) $user->name,
                'email' => (string) $user->email,
                'phone' => $user->phone,
                'phone_verified' => $user->hasVerifiedPhone(),
                'preferred_level' => $user->preferred_level,
                'daily_goal_minutes' => (int) ($user->daily_goal_minutes ?? 10),
            ],
            'levels' => PublishLesson::LEVELS,
            'smsReady' => SmsStatus::ready(),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $smsReady = SmsStatus::ready();
        $phoneProvided = $smsReady && $request->exists('phone');
        $rawPhone = (string) $request->input('phone');
        $phoneInput = $phoneProvided
            ? PhoneNumber::normalize($rawPhone)
            : $user->phone;

        // An invalid number is rejected before anything is written; the
        // form shows the field error and keeps the old number.
        if ($phoneProvided && $phoneInput === null && trim($rawPhone) !== '') {
            return back()->withErrors([
                'phone' => 'شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
            ]);
        }

        // Validate the canonical form, not the pasted `+98` spelling, so
        // the unique rule cannot be bypassed with a different format.
        if ($phoneProvided) {
            $request->merge(['phone' => $phoneInput]);
        }

        $data = $request->validate([
            // S0 parity: the display name rule the retired learner
            // Livewire component enforced (required/string/255).
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => [
                'nullable',
                'string',
                'max:30',
                Rule::unique(User::class, 'phone')->ignore($user->id),
            ],
            'preferred_level' => ['nullable', 'in:A1,A2,B1,B2,C1,C2'],
            // R5: the daily goal is an independent explicit choice. It
            // never writes preferred_level and vice versa.
            'daily_goal_minutes' => ['nullable', 'in:5,10,15'],
        ], [
            'phone.unique' => 'این شمارهٔ موبایل قبلاً ثبت شده است.',
        ]);

        $updates = [];
        if (array_key_exists('name', $data)) {
            $updates['name'] = $data['name'];
        }
        if (array_key_exists('preferred_level', $data)) {
            $updates['preferred_level'] = $data['preferred_level'] ?? null;
        }
        if (array_key_exists('daily_goal_minutes', $data)) {
            $updates['daily_goal_minutes'] = $data['daily_goal_minutes'] !== null
                ? (int) $data['daily_goal_minutes']
                : 10;
        }

        $phoneChanged = $smsReady && $phoneInput !== $user->phone;
        $oldPhone = $user->phone;
        $oldVerifiedAt = $user->phone_verified_at;

        if ($phoneChanged) {
            $updates['phone'] = $phoneInput;
            $updates['phone_verified_at'] = null;
        }

        $user->forceFill($updates)->save();

        if (! $phoneChanged) {
            return redirect()
                ->route('account.settings')
                ->with('status', 'تنظیمات حساب ذخیره شد.');
        }

        PhoneVerificationCodes::clear($user);

        if ($phoneInput === null) {
            return redirect()
                ->route('account.settings')
                ->with('status', 'شمارهٔ موبایل از حساب حذف شد.');
        }

        try {
            PhoneVerificationCodes::issue($user, PhoneVerificationCodes::PURPOSE_VERIFY);
        } catch (Throwable $e) {
            // Do not strand the learner on a number whose code cannot be
            // delivered: restore the previous phone and verified state.
            // Also drop the pending code row, which now belongs to a phone
            // the account no longer carries.
            PhoneVerificationCodes::clear($user);
            $user->forceFill([
                'phone' => $oldPhone,
                'phone_verified_at' => $oldVerifiedAt,
            ])->save();
            report($e);

            return back()->withErrors([
                'phone' => 'ارسال پیامک ممکن نشد. شمارهٔ قبلی حفظ شد؛ کمی بعد دوباره تلاش کنید یا به پشتیبانی پیام دهید.',
            ]);
        }

        return redirect()
            ->route('phone.notice')
            ->with('status', 'یک کد شش‌رقمی به موبایلت پیامک شد.');
    }
}
