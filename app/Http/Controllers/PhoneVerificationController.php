<?php

namespace App\Http\Controllers;

use App\Models\PhoneVerificationCode;
use App\Support\PhoneNumber;
use App\Support\PhoneVerificationCodes;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Phone verification for a signed-in account (owner request 2026-11-12).
 *
 * Registration and the account-settings phone change both land here. The
 * account is not fully open until this code is accepted: EnsureEmailVerified
 * routes a phone-bearing but unverified account to this page.
 */
class PhoneVerificationController extends Controller
{
    public function notice(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user === null) {
            return redirect()->route('login');
        }

        if ($user->phone === null || $user->phone === '') {
            return redirect()
                ->route('account.settings')
                ->with('error', 'اول شمارهٔ موبایلت را ذخیره کن تا کد تأیید برایش فرستاده شود.');
        }

        if ($user->hasVerifiedPhone()) {
            return redirect()->intended(route('account'));
        }

        $row = PhoneVerificationCode::query()
            ->where('user_id', $user->id)
            ->where('purpose', PhoneVerificationCodes::PURPOSE_VERIFY)
            ->first();

        if ($row !== null && $row->expires_at->isPast()) {
            $row->delete();
            $row = null;
        }

        return Inertia::render('Auth/VerifyPhone', [
            'mode' => 'verify',
            'phone' => PhoneNumber::mask((string) $user->phone),
            'hasActiveCode' => $row !== null,
            'retryAfter' => PhoneVerificationCodes::retryAfter($user, PhoneVerificationCodes::PURPOSE_VERIFY),
            'ttlMinutes' => PhoneVerificationCodes::ttlMinutes(),
        ]);
    }

    public function verify(Request $request): RedirectResponse
    {
        $user = $request->user();
        if ($user === null) {
            return redirect()->route('login');
        }

        if ($user->hasVerifiedPhone()) {
            return redirect()->intended(route('account'));
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ], [
            'code.required' => 'کد تأیید را وارد کنید.',
            'code.regex' => 'کد تأیید باید شش رقم باشد.',
        ]);

        $result = PhoneVerificationCodes::verify($user, PhoneVerificationCodes::PURPOSE_VERIFY, (string) $data['code']);

        if ($result !== PhoneVerificationCodes::OK) {
            return back()->withErrors(['code' => $this->message($result)]);
        }

        $user->markPhoneAsVerified();
        PhoneVerificationCodes::clear($user, PhoneVerificationCodes::PURPOSE_LOGIN);

        return redirect()
            ->intended(route('account'))
            ->with('status', 'شمارهٔ موبایل تأیید شد.');
    }

    public function resend(Request $request): RedirectResponse
    {
        $user = $request->user();
        if ($user === null) {
            return redirect()->route('login');
        }

        if ($user->hasVerifiedPhone()) {
            return redirect()->intended(route('account'));
        }

        if ($user->phone === null || $user->phone === '') {
            return redirect()->route('account.settings');
        }

        $wait = PhoneVerificationCodes::retryAfter($user, PhoneVerificationCodes::PURPOSE_VERIFY);
        if ($wait > 0) {
            return back()->with('error', "برای ارسال دوبارهٔ کد، {$wait} ثانیه صبر کنید.");
        }

        try {
            PhoneVerificationCodes::issue($user, PhoneVerificationCodes::PURPOSE_VERIFY);
        } catch (Throwable $e) {
            report($e);

            return back()->with('error', 'ارسال پیامک ممکن نشد. کمی بعد دوباره تلاش کنید یا به پشتیبانی پیام دهید.');
        }

        return back()->with('status', 'کد تازه پیامک شد.');
    }

    private function message(string $result): string
    {
        return match ($result) {
            PhoneVerificationCodes::MISSING => 'کد فعالی وجود ندارد. یک کد تازه بگیرید.',
            PhoneVerificationCodes::EXPIRED => 'کد منقضی شده است. یک کد تازه بگیرید.',
            PhoneVerificationCodes::TOO_MANY => 'تعداد تلاش‌ها بیش از حد شد. یک کد تازه بگیرید.',
            default => 'کد واردشده درست نیست. دوباره بررسی کنید.',
        };
    }
}
