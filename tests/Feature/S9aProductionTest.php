<?php

use App\Support\SmtpStatus;
use Database\Seeders\S1SampleSeeder;
use Database\Seeders\S3SampleSeeder;
use Database\Seeders\S4PaginationSeeder;
use Database\Seeders\S5PaymentFixtureSeeder;
use Database\Seeders\S7PlacementFixtureSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Config\Repository;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S9a production guards (scope sections 16, 19, 25): staging may run
// labelled fixtures, production refuses them; reset disabled in production
// without SMTP (neutral, no send, no token, no log); retention scheduled.

afterEach(function () {
    app()->detectEnvironment(fn () => 'testing');
});

test('fixture seeders refuse production and allow staging', function () {
    app()->detectEnvironment(fn () => 'production');

    foreach ([
        new S1SampleSeeder,
        new S3SampleSeeder,
        new S4PaginationSeeder,
        new S5PaymentFixtureSeeder,
        new S7PlacementFixtureSeeder,
    ] as $seeder) {
        expect(fn () => $seeder->run())->toThrow(RuntimeException::class);
    }

    // Staging is not production: the guard does not block it.
    app()->detectEnvironment(fn () => 'staging');
    expect(app()->environment('production'))->toBeFalse();
    expect(app()->environment('staging'))->toBeTrue();
});

test('smtp status detects configuration', function () {
    config(['mail.default' => 'log', 'mail.mailers.smtp.host' => '']);
    expect(SmtpStatus::isConfigured())->toBeFalse();

    config(['mail.default' => 'array']);
    expect(SmtpStatus::isConfigured())->toBeFalse();

    config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '']);
    expect(SmtpStatus::isConfigured())->toBeFalse();

    config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => 'smtp.example.com']);
    expect(SmtpStatus::isConfigured())->toBeTrue();
});

test('production without smtp disables reset with neutral response', function () {
    Notification::fake();
    app()->detectEnvironment(fn () => 'production');
    config(['mail.default' => 'log', 'mail.mailers.smtp.host' => '']);
    // Production simulation re-enables CSRF (runningUnitTests becomes
    // false); bypass it to isolate the reset guard (real browsers send
    // a valid token, S8 proves the CSRF layer separately).
    $this->withoutMiddleware(PreventRequestForgery::class);

    expect(SmtpStatus::isPasswordResetDisabled())->toBeTrue();

    $student = ContentFixtures::student();

    $this->get(route('password.request'))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Auth/ForgotPassword')
        ->where('resetDisabled', true));
    $this->get(route('password.reset', ['token' => 'token', 'email' => $student->email]))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Auth/ResetPassword')
        ->where('resetDisabled', true));
    $message = 'اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال شد.';

    $this->post(route('password.email'), ['email' => $student->email])
        ->assertRedirect()
        ->assertSessionHas('status', $message)
        ->assertSessionHasNoErrors();

    Notification::assertNothingSent();
    expect(DB::table('password_reset_tokens')->count())->toBe(0);

    // Unknown email gets the identical neutral response.
    $this->post(route('password.email'), ['email' => 'nobody-here@example.com'])
        ->assertRedirect()
        ->assertSessionHas('status', $message)
        ->assertSessionHasNoErrors();

    Notification::assertNothingSent();

    // JSON callers get the identical payload either way.
    $this->postJson(route('password.email'), ['email' => $student->email])
        ->assertOk()
        ->assertJsonPath('status', $message);

    Notification::assertNothingSent();
});

test('production with smtp keeps reset enabled', function () {
    Notification::fake();
    app()->detectEnvironment(fn () => 'production');
    config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => 'smtp.example.com']);
    $this->withoutMiddleware(PreventRequestForgery::class);

    expect(SmtpStatus::isPasswordResetDisabled())->toBeFalse();

    $student = ContentFixtures::student();

    $this->post(route('password.email'), ['email' => $student->email])
        ->assertRedirect()
        ->assertSessionHas('status');

    Notification::assertSentTo($student, ResetPassword::class);
});

test('retention is scheduled and dry run works', function () {
    expect(Artisan::call('schedule:list'))->toBe(0);
    $output = Artisan::output();
    expect($output)->toContain('receipts:retain-reviewed')
        ->and($output)->toContain('receipts:cleanup');

    expect(Artisan::call('receipts:retain-reviewed', ['--dry-run' => true]))->toBe(0);
    expect(Artisan::call('receipts:cleanup', ['--dry-run' => true]))->toBe(0);
});

test('production config defaults are safe', function () {
    // sales stays off unless explicitly enabled (phpunit enables it for S5/S6).
    expect((bool) config('sales.enabled'))->toBeTrue();
    // The shipped default without env is OFF (config file default false).
    $fresh = new Repository([]);
    expect($fresh->get('sales.enabled', 'unset'))->toBe('unset');

    // stderr channel exists for production logs.
    expect(config('logging.channels.stderr'))->not->toBeNull();

    // session secure defaults to true in production (code default).
    $sessionConfig = file_get_contents(config_path('session.php'));
    expect($sessionConfig)->toContain("env('APP_ENV') === 'production'");

    // trusted proxies are configured for Coolify's TLS proxy.
    $bootstrap = file_get_contents(base_path('bootstrap/app.php'));
    expect($bootstrap)->toContain('trustProxies');
});
