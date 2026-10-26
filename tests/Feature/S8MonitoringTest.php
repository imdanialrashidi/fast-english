<?php

use App\Models\PaymentRequest;
use App\Models\Plan;
use Database\Seeders\S5PaymentFixtureSeeder;
use Illuminate\Support\Facades\Artisan;
use Tests\Support\ContentFixtures;
use Tests\Support\S6Payments;

// S8-6 (monitoring): ops:status reports all four fields and leaks no
// secret. A stale pending request is detected. Two users.

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = ContentFixtures::student();
    $this->studentB = ContentFixtures::student();
});

test('status reports all four fields with no secret', function () {
    $plan = Plan::where('slug', 's5-test-30')->firstOrFail();
    S6Payments::pendingRequest($this, $this->studentA, $plan);

    expect(Artisan::call('ops:status'))->toBe(0);
    $output = Artisan::output();

    expect($output)->toContain('pending_payments_count=')
        ->and($output)->toContain('pending_oldest_age_hours=')
        ->and($output)->toContain('pending_stale=no')
        ->and($output)->toContain('disk_free_bytes=')
        ->and($output)->toContain('failed_jobs_count=')
        ->and($output)->toContain('recent_errors_24h=');

    foreach ([config('app.key'), config('database.connections.pgsql.password'), config('mail.mailers.smtp.password')] as $secret) {
        if (is_string($secret) && $secret !== '') {
            expect($output)->not->toContain($secret);
        }
    }
});

test('a stale pending request is detected', function () {
    $plan = Plan::where('slug', 's5-test-30')->firstOrFail();
    $stale = S6Payments::pendingRequest($this, $this->studentA, $plan);
    $stale->forceFill(['created_at' => now()->subDays(3), 'updated_at' => now()->subDays(3)])->save();
    S6Payments::pendingRequest($this, $this->studentB, $plan);

    expect(Artisan::call('ops:status'))->toBe(0);
    $output = Artisan::output();

    expect($output)->toContain('pending_payments_count=2')
        ->and($output)->toContain('pending_stale=yes');
});

test('empty queue reports none without stale flag', function () {
    expect(PaymentRequest::count())->toBe(0);

    expect(Artisan::call('ops:status'))->toBe(0);
    $output = Artisan::output();

    expect($output)->toContain('pending_payments_count=0')
        ->and($output)->toContain('pending_oldest_age_hours=none')
        ->and($output)->toContain('pending_stale=no');
});

test('error counter is unavailable, not zero, when no file log exists', function () {
    // Production logs to stderr: storage/logs/laravel.log does not exist.
    // Reporting 0 there would claim "no errors" while nothing was read.
    $tmp = sys_get_temp_dir().'/fe-ops-'.getmypid().'-'.uniqid();
    mkdir($tmp, 0777, true);
    $original = app()->storagePath();
    app()->useStoragePath($tmp);

    try {
        expect(Artisan::call('ops:status'))->toBe(0);
        expect(Artisan::output())->toContain('recent_errors_24h=unavailable');
    } finally {
        app()->useStoragePath($original);
        @rmdir($tmp);
    }
});

test('health endpoint exposes no details', function () {
    $body = $this->get('/up')->assertOk()->getContent();

    // The framework health page carries status only: no secret, no
    // credential fragment, no version, no stack trace.
    foreach (['APP_KEY', 'DB_PASSWORD', 'MAIL_PASSWORD', 'secret', 'Trace', 'Exception', app()->version()] as $needle) {
        expect($body)->not->toContain($needle);
    }
});
