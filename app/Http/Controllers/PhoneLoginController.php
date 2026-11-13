<?php

namespace App\Http\Controllers;

use App\Models\PhoneVerificationCode;
use App\Models\User;
use App\Support\PhoneNumber;
use App\Support\PhoneVerificationCodes;
use App\Support\Sms\SmsStatus;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Phone login (owner request 2026-11-12).
 *
 * A learner enters a mobile number, receives a six-digit SMS code, and is
 * signed in after entering it. Unknown, disabled, and provider-failure
 * cases return the same neutral message so the form is not an account
 * oracle. Codes are hashed, short-lived, attempt-limited, and throttled
 * per phone+IP as well as per route.
 */
class PhoneLoginController extends Controller
{
    private const SESSION_PHONE = 'phone.login.phone';

    public function show(): Response|RedirectResponse
    {
        if (! SmsStatus::ready()) {
            return redirect()->route('login')->with('error', 'ورود با کد پیامکی هنوز فعال نشده است. فعلاً با ایمیل و رمز وارد شوید.');
        }

        return Inertia::render('Auth/PhoneLogin');
    }

    public function send(Request $request): RedirectResponse
    {
        if (! SmsStatus::ready()) {
            return redirect()->route('login')->with('error', 'ورود با کد پیامکی هنوز فعال نشده است.');
        }

        $data = $request->validate([
            'phone' => ['required', 'string', 'max:30'],
        ], [
            'phone.required' => 'شمارهٔ موبایل را وارد کنید.',
        ]);

        $phone = PhoneNumber::normalize($data['phone']);
        if ($phone === null) {
            return back()->withErrors([
                'phone' => 'شمارهٔ موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
            ])->onlyInput('phone');
        }

        $throttleKey = 'phone-login-send:'.$phone.'|'.$request->ip();
        $phoneKey = 'phone-login-phone:'.$phone;
        if (RateLimiter::tooManyAttempts($throttleKey, 5) || RateLimiter::tooManyAttempts($phoneKey, 5)) {
            return back()->withErrors([
                'phone' => 'تعداد درخواست بیش از حد شد. چند دقیقه بعد دوباره تلاش کنید.',
            ])->onlyInput('phone');
        }
        RateLimiter::hit($throttleKey, 600);
        RateLimiter::hit($phoneKey, 600);

        $request->session()->put(self::SESSION_PHONE, $phone);

        $user = User::query()->where('phone', $phone)->first();
        if ($user !== null && $user->disabled_at === null) {
            $wait = PhoneVerificationCodes::retryAfter($user, PhoneVerificationCodes::PURPOSE_LOGIN);
            if ($wait === 0) {
                try {
                    PhoneVerificationCodes::issue($user, PhoneVerificationCodes::PURPOSE_LOGIN);
                } catch (Throwable $e) {
                    report($e);
                }
            }
        }

        return redirect()
            ->route('phone.login.verify')
            ->with('status', 'اگر این شماره در سایت ثبت شده باشد، کد ورود برایش پیامک شد.');
    }

    public function verifyForm(Request $request): Response|RedirectResponse
    {
        $phone = $request->session()->get(self::SESSION_PHONE);

        if (! is_string($phone) || PhoneNumber::normalize($phone) === null) {
            return redirect()->route('phone.login');
        }

        $user = User::query()->where('phone', $phone)->first();
        $row = null;
        if ($user !== null && $user->phone !== null) {
            $row = PhoneVerificationCode::query()
                ->where('user_id', $user->id)
                ->where('purpose', PhoneVerificationCodes::PURPOSE_LOGIN)
                ->first();
        }

        if ($row !== null && $row->expires_at->isPast()) {
            $row->delete();
            $row = null;
        }

        return Inertia::render('Auth/VerifyPhone', [
            'mode' => 'login',
            'phone' => PhoneNumber::mask($phone),
            'hasActiveCode' => $row !== null,
            'retryAfter' => $user !== null
                ? PhoneVerificationCodes::retryAfter($user, PhoneVerificationCodes::PURPOSE_LOGIN)
                : 0,
            'ttlMinutes' => PhoneVerificationCodes::ttlMinutes(),
        ]);
    }

    public function verify(Request $request): RedirectResponse
    {
        $phone = $request->session()->get(self::SESSION_PHONE);

        if (! is_string($phone) || PhoneNumber::normalize($phone) === null) {
            return redirect()->route('phone.login');
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ], [
            'code.required' => 'کد تأیید را وارد کنید.',
            'code.regex' => 'کد تأیید باید شش رقم باشد.',
        ]);

        $user = User::query()->where('phone', $phone)->first();

        if ($user === null || $user->disabled_at !== null) {
            return back()->withErrors(['code' => 'کد واردشده درست نیست. دوباره بررسی کنید.']);
        }

        $result = PhoneVerificationCodes::verify($user, PhoneVerificationCodes::PURPOSE_LOGIN, (string) $data['code']);

        if ($result !== PhoneVerificationCodes::OK) {
            return back()->withErrors(['code' => $this->message($result)]);
        }

        // Possession of the number is proven by the code; this also
        // completes verification for an account that registered but never
        // entered its first code.
        $user->markPhoneAsVerified();

        Auth::login($user, false);
        $request->session()->regenerate();
        $request->session()->forget(self::SESSION_PHONE);

        return redirect()->intended(route('account'));
    }

    public function resend(Request $request): RedirectResponse
    {
        $phone = $request->session()->get(self::SESSION_PHONE);

        if (! is_string($phone) || PhoneNumber::normalize($phone) === null) {
            return redirect()->route('phone.login');
        }

        $user = User::query()->where('phone', $phone)->first();
        if ($user === null || $user->disabled_at !== null) {
            return back()->with('status', 'اگر این شماره در سایت ثبت شده باشد، کد ورود برایش پیامک می‌شود.');
        }

        $wait = PhoneVerificationCodes::retryAfter($user, PhoneVerificationCodes::PURPOSE_LOGIN);
        if ($wait > 0) {
            return back()->with('error', "برای ارسال دوبارهٔ کد، {$wait} ثانیه صبر کنید.");
        }

        try {
            PhoneVerificationCodes::issue($user, PhoneVerificationCodes::PURPOSE_LOGIN);
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
