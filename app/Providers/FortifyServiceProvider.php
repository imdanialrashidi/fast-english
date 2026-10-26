<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Http\Responses\NeutralPasswordResetLinkResponse;
use App\Models\User;
use App\Support\SmtpStatus;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     *
     * S0 keeps register / login / logout only. Password reset, 2FA,
     * passkeys, and profile-update features stay out of this slice.
     *
     * S8 restores the standard Fortify reset flow (AUTH-02):
     * forgot-password + reset-password views in Persian. Staff TOTP is
     * intentionally NOT Fortify's two-factor feature — it is staff-only
     * (App\Support\StaffTwoFactor + StaffTwoFactorController), so the
     * shared Fortify feature stays off and students can never enable it.
     */
    public function boot(): void
    {
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        // S8-2: unknown emails get the same response as known ones — the
        // default failed response leaks account existence (see class doc).
        $this->app->singleton(FailedPasswordResetLinkRequestResponse::class, fn () => new NeutralPasswordResetLinkResponse);
        $this->app->singleton(SuccessfulPasswordResetLinkRequestResponse::class, fn () => new NeutralPasswordResetLinkResponse);

        // Public auth slice (ADR-0002): the same Fortify endpoints serve
        // Inertia pages instead of Blade. Validation, throttle, disabled
        // handling, and redirects are unchanged; only the HTML transport
        // moved. Error bags + old input travel through the Inertia
        // protocol automatically.
        Fortify::loginView(fn () => Inertia::render('Auth/Login'));
        Fortify::registerView(fn () => Inertia::render('Auth/Register'));
        Fortify::requestPasswordResetLinkView(fn () => Inertia::render('Auth/ForgotPassword', [
            'resetDisabled' => SmtpStatus::isPasswordResetDisabled(),
        ]));
        Fortify::resetPasswordView(fn ($request) => Inertia::render('Auth/ResetPassword', [
            'token' => (string) $request->route('token'),
            'email' => (string) ($request->input('email') ?? ''),
            'resetDisabled' => SmtpStatus::isPasswordResetDisabled(),
        ]));

        // Disabled accounts get the same generic error as bad credentials.
        Fortify::authenticateUsing(function (Request $request) {
            $user = User::where('email', $request->input(Fortify::username()))->first();

            if ($user && $user->disabled_at === null && Hash::check((string) $request->input('password'), $user->password)) {
                return $user;
            }

            throw ValidationException::withMessages([
                Fortify::username() => [__('auth.failed')],
            ]);
        });

        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });
    }
}
