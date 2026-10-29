<?php

namespace App\Http\Controllers;

use App\Models\EmailVerificationCode;
use App\Support\EmailVerificationCodes;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Six-digit email verification (owner request 2026-10-28).
 *
 * Registration sends the first code (CreateNewUser); this controller owns
 * the notice page, code confirmation, and resend. The code itself is never
 * echoed or logged. Every response here is private, no-store like the rest
 * of the auth surface.
 */
class EmailVerificationController extends Controller
{
    public function notice(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if ($user === null) {
            return redirect()->route('login');
        }

        if ($user->hasVerifiedEmail()) {
            return redirect()->intended(route('account'));
        }

        $row = EmailVerificationCode::where('user_id', $user->id)->first();
        if ($row !== null && $row->expires_at->isPast()) {
            $row->delete();
            $row = null;
        }

        return Inertia::render('Auth/VerifyEmail', [
            'email' => $this->maskEmail((string) $user->email),
            'hasActiveCode' => $row !== null,
            'expiresAt' => $row?->expires_at?->toIso8601String(),
            'retryAfter' => EmailVerificationCodes::retryAfter($user),
            'ttlMinutes' => EmailVerificationCodes::TTL_MINUTES,
        ]);
    }

    public function verify(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user === null) {
            return redirect()->route('login');
        }

        if ($user->hasVerifiedEmail()) {
            return redirect()->intended(route('account'));
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ], [
            'code.required' => 'کد تأیید را وارد کنید.',
            'code.regex' => 'کد تأیید باید شش رقم باشد.',
        ]);

        $result = EmailVerificationCodes::verify($user, (string) $data['code']);

        if ($result === EmailVerificationCodes::OK) {
            return redirect()
                ->intended(route('account'))
                ->with('status', 'ایمیل شما تأیید شد.');
        }

        $message = match ($result) {
            EmailVerificationCodes::MISSING => 'کد فعالی وجود ندارد. یک کد تازه بفرستید.',
            EmailVerificationCodes::EXPIRED => 'کد منقضی شده است. یک کد تازه بفرستید.',
            EmailVerificationCodes::TOO_MANY => 'تعداد تلاش‌ها بیش از حد شد. یک کد تازه بفرستید.',
            default => 'کد واردشده درست نیست. دوباره بررسی کنید.',
        };

        return back()->withErrors(['code' => $message]);
    }

    public function resend(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user === null) {
            return redirect()->route('login');
        }

        if ($user->hasVerifiedEmail()) {
            return redirect()->intended(route('account'));
        }

        $wait = EmailVerificationCodes::retryAfter($user);
        if ($wait > 0) {
            return back()->with('error', "برای ارسال دوبارهٔ کد، {$wait} ثانیه صبر کنید.");
        }

        try {
            EmailVerificationCodes::issue($user);
        } catch (Throwable $e) {
            report($e);

            return back()->with('error', 'ارسال ایمیل ممکن نشد. کمی بعد دوباره تلاش کنید.');
        }

        return back()->with('status', 'کد تازه به ایمیل شما فرستاده شد.');
    }

    /** Keep the address recognizable without publishing the full mailbox. */
    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email, 2);
        if (count($parts) !== 2) {
            return '***';
        }

        [$local, $domain] = $parts;

        $localMasked = mb_substr($local, 0, 2).str_repeat('*', max(2, mb_strlen($local) - 2));

        $domainParts = explode('.', $domain);
        $host = (string) array_shift($domainParts);
        $hostMasked = mb_substr($host, 0, 1).str_repeat('*', max(2, mb_strlen($host) - 1));
        $suffix = $domainParts === [] ? '' : '.'.implode('.', $domainParts);

        return $localMasked.'@'.$hostMasked.$suffix;
    }
}
