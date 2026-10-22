<?php

namespace App\Http\Controllers;

use App\Http\Responses\NoStore;
use App\Support\StaffTwoFactor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * S8 staff TOTP (scope §5): staff accounts only — every route here sits
 * behind `staff` (EnsureStaff: 403 for students, login redirect for
 * guests). Students can never enable, confirm, challenge, or disable.
 *
 * - Start: a fresh secret is stored ENCRYPTED with confirmed_at null.
 *   An unconfirmed secret grants nothing (panel gate requires confirm).
 * - Confirm: a valid current TOTP code sets two_factor_confirmed_at,
 *   issues recovery codes, and renders them ONCE. Only SHA-256 hashes
 *   persist; the plain codes never touch the database or the logs.
 * - Challenge: accepts the current TOTP code or one unused recovery
 *   code (single-use: the hash is removed on success). Success sets the
 *   `staff_2fa_passed_at` + `staff_last_activity` session flags consumed
 *   by RequireStaffTwoFactor.
 * - Disable: requires a current TOTP code and wipes secret + hashes +
 *   confirm timestamp.
 */
class StaffTwoFactorController extends Controller
{
    public function setup(Request $request)
    {
        $user = $request->user();

        $provisioning = null;
        if ($user->two_factor_secret !== null && $user->two_factor_confirmed_at === null) {
            $provisioning = StaffTwoFactor::provisioning(
                (string) $user->email,
                (string) $user->two_factor_secret
            );
        }

        return response()
            ->view('staff-two-factor.setup', [
                'confirmed' => $user->two_factor_confirmed_at !== null,
                'provisioning' => $provisioning,
            ])
            ->withHeaders(NoStore::headers());
    }

    public function start(Request $request)
    {
        $user = $request->user();

        if ($user->two_factor_confirmed_at !== null) {
            return redirect()->route('staff.twofactor.setup')->with('status', 'احراز هویت دومرحله‌ای هم‌اکنون فعال است.');
        }

        $user->forceFill(['two_factor_secret' => StaffTwoFactor::generateSecret()])->save();

        return redirect()->route('staff.twofactor.setup')->with('status', 'کلید تازه ساخته شد. کد نمایش‌داده‌شده را تأیید کنید.');
    }

    public function confirm(Request $request)
    {
        $user = $request->user();

        if ($user->two_factor_confirmed_at !== null) {
            return redirect()->route('staff.twofactor.setup');
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'max:16'],
        ], [
            'code.required' => 'وارد کردن کد الزامی است.',
        ]);

        $secret = (string) $user->two_factor_secret;
        if ($secret === '' || ! StaffTwoFactor::verify($secret, (string) $data['code'])) {
            return back()->withErrors(['code' => 'کد واردشده معتبر نیست.']);
        }

        $codes = StaffTwoFactor::generateRecoveryCodes();
        $user->forceFill([
            'two_factor_recovery_codes' => StaffTwoFactor::hashCodes($codes),
            'two_factor_confirmed_at' => now(),
        ])->save();

        $request->session()->put('staff_2fa_passed_at', time());
        $request->session()->put('staff_last_activity', time());

        // The ONLY response that ever carries the plain codes.
        return response()
            ->view('staff-two-factor.recovery', ['codes' => $codes])
            ->withHeaders(NoStore::headers());
    }

    public function challenge(Request $request)
    {
        $user = $request->user();

        if ($user->two_factor_confirmed_at === null) {
            return redirect()->route('staff.twofactor.setup');
        }

        $idleSeconds = max(60, (int) config('staff2fa.idle_minutes', 30)) * 60;
        $passedAt = $request->session()->get('staff_2fa_passed_at');
        if (is_int($passedAt) && (time() - $passedAt) <= $idleSeconds) {
            return redirect()->intended('/admin');
        }

        return response()
            ->view('staff-two-factor.challenge')
            ->withHeaders(NoStore::headers());
    }

    public function verifyChallenge(Request $request)
    {
        $user = $request->user();

        if ($user->two_factor_confirmed_at === null) {
            return redirect()->route('staff.twofactor.setup');
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'max:32'],
        ], [
            'code.required' => 'وارد کردن کد الزامی است.',
        ]);

        $code = (string) $data['code'];

        if (StaffTwoFactor::verify((string) $user->two_factor_secret, $code)) {
            $this->pass($request);

            return redirect()->intended('/admin');
        }

        $hashes = is_array($user->two_factor_recovery_codes) ? $user->two_factor_recovery_codes : [];
        if ($hashes !== [] && StaffTwoFactor::matchesCode($hashes, $code)) {
            $user->forceFill([
                'two_factor_recovery_codes' => StaffTwoFactor::consumeCode($hashes, $code),
            ])->save();
            $this->pass($request);

            return redirect()->intended('/admin');
        }

        return back()->withErrors(['code' => 'کد واردشده معتبر نیست.']);
    }

    public function disable(Request $request)
    {
        $user = $request->user();

        if ($user->two_factor_confirmed_at === null) {
            return redirect()->route('staff.twofactor.setup');
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'max:16'],
        ], [
            'code.required' => 'وارد کردن کد الزامی است.',
        ]);

        if (! StaffTwoFactor::verify((string) $user->two_factor_secret, (string) $data['code'])) {
            return back()->withErrors(['code' => 'کد واردشده معتبر نیست.']);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();
        $request->session()->forget('staff_2fa_passed_at');

        return redirect()->route('staff.twofactor.setup')->with('status', 'احراز هویت دومرحله‌ای غیرفعال شد.');
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }

    private function pass(Request $request): void
    {
        $request->session()->put('staff_2fa_passed_at', time());
        $request->session()->put('staff_last_activity', time());
    }
}
