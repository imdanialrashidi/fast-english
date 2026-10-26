<?php

use App\Http\Middleware\DisablePasswordResetWhenSmtpMissing;
use App\Http\Middleware\EnsureStaff;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\PrivateNoStore;
use App\Http\Middleware\RedirectAuthenticatedToApp;
use App\Http\Middleware\RejectDisabledUsers;
use App\Http\Middleware\RequireStaffTwoFactor;
use App\Http\Middleware\RequireStaffTwoFactorIfStaff;
use App\Http\Middleware\RequireSubscription;
use App\Http\Middleware\SetStaffLocale;
use App\Http\Middleware\ThrottleUploads;
use App\Http\Responses\NoStore;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // S9a: trust Coolify's TLS-terminating proxy so Laravel sees HTTPS
        // (SESSION_SECURE_COOKIE + APP_URL require it; scope section 19.1).
        $middleware->trustProxies(at: '*');
        $middleware->alias([
            'reject.disabled' => RejectDisabledUsers::class,
            // Paid-only learner gate (owner requirement): staff +
            // active subscribers pass; all other learner states refuse.
            'subscribed' => RequireSubscription::class,
            // S8: staff-only routes (2FA setup/challenge, panel extras).
            'staff' => EnsureStaff::class,
            // Staff step-up gate for staff-only surfaces outside the panel
            // (placement publish, import/export). The 2FA setup/challenge
            // routes themselves must not carry this or they would loop.
            'staff.2fa' => RequireStaffTwoFactor::class,
            // Shared owner/staff route (receipt bytes): enforce the staff
            // gate only for staff; learners keep their owner-only path.
            'staff.2fa.if_staff' => RequireStaffTwoFactorIfStaff::class,
            // Owner requirement (2026-10-21): landing/marketing pages are
            // guest-only; signed-in learners return to the app.
            'marketing.guest' => RedirectAuthenticatedToApp::class,
        ]);
        // S2 scope §16: private HTML/Livewire responses are uncacheable.
        $middleware->appendToGroup('web', PrivateNoStore::class);
        // M0 Inertia foundation (ADR-0002): the Inertia protocol middleware
        // serves X-Inertia responses + shared props; sessions, CSRF, and the
        // Fortify/Filament behavior around it are unchanged.
        $middleware->appendToGroup('web', HandleInertiaRequests::class);
        // Persian learner/public chrome; English Filament staff panel.
        $middleware->appendToGroup('web', SetStaffLocale::class);
        // S3 pre-slice scope §16: five upload requests per minute per user.
        $middleware->appendToGroup('web', ThrottleUploads::class);
        // S9a: production without SMTP disables reset (neutral, no send/log).
        $middleware->appendToGroup('web', DisablePasswordResetWhenSmtpMissing::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Learner JSON endpoints are consumed by React handlers that show
        // the server's `message` verbatim. The framework defaults are
        // English ("The given data was invalid.", "Unauthenticated.",
        // "Forbidden"), so every route below translates them once here
        // instead of relying on each call site to guess.
        $exceptions->render(function (ValidationException $e, Request $request) {
            if (! $request->expectsJson()) {
                return null;
            }

            $errors = $e->errors();
            $first = collect($errors)->flatten()->first();

            return response()->json([
                'message' => is_string($first) && $first !== '' ? $first : 'اطلاعات ارسالی معتبر نیست.',
                'errors' => $errors,
            ], $e->status, NoStore::headers());
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if (! $request->expectsJson()) {
                return null;
            }

            return response()->json([
                'message' => 'نشست شما پایان یافته است. دوباره وارد شوید.',
            ], 401, NoStore::headers());
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if (! $request->expectsJson()) {
                return null;
            }

            return response()->json([
                'message' => 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
            ], 429, NoStore::headers());
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->expectsJson()) {
                return null;
            }

            $message = match ($e->getStatusCode()) {
                403 => 'اجازهٔ انجام این کار را ندارید.',
                404 => 'مورد درخواستی پیدا نشد.',
                405 => 'این درخواست پشتیبانی نمی‌شود.',
                419 => 'نشست شما منقضی شده است. صفحه را دوباره بارگذاری کنید.',
                429 => 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
                default => null,
            };

            if ($message === null) {
                return null;
            }

            return response()->json(['message' => $message], $e->getStatusCode(), NoStore::headers());
        });
    })->create();
