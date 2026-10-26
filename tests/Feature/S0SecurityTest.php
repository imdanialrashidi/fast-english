<?php

use App\Models\User;

// Scope §16: five failed login attempts per minute per account+IP.
test('sixth failed login within a minute is throttled', function () {
    $user = User::factory()->create(['email' => 'throttle@example.com']);

    // A second user proves the throttle key is per-account, not global.
    User::factory()->create(['email' => 'other-throttle@example.com']);

    for ($i = 0; $i < 5; $i++) {
        $this->post(route('login.store'), [
            'email' => 'throttle@example.com',
            'password' => 'wrong-password',
        ])->assertSessionHasErrors('email');
    }
    $this->assertGuest();

    $this->post(route('login.store'), [
        'email' => 'throttle@example.com',
        'password' => 'wrong-password',
    ])->assertStatus(429);

    // The other account is unaffected by the first account's throttle.
    $this->post(route('login.store'), [
        'email' => 'other-throttle@example.com',
        'password' => 'password',
    ])->assertRedirect(route('account'));
});

// Scope §16: secure, HttpOnly, SameSite cookies in production config.
test('session cookie defaults are production-safe', function () {
    expect(config('session.http_only'))->toBeTrue()
        ->and(config('session.same_site'))->toBe('lax');

    // Fresh config evaluation with production env and no explicit override.
    // $_SERVER is included because exported container env (and some CI
    // runners) populate it; clearing only $_ENV left the test unable to
    // simulate an override-free production process.
    $env = $_ENV;
    $server = $_SERVER;
    $envApp = getenv('APP_ENV');
    $envSecure = getenv('SESSION_SECURE_COOKIE');

    $_ENV['APP_ENV'] = 'production';
    $_SERVER['APP_ENV'] = 'production';
    unset($_ENV['SESSION_SECURE_COOKIE'], $_SERVER['SESSION_SECURE_COOKIE']);
    putenv('APP_ENV=production');
    putenv('SESSION_SECURE_COOKIE');

    $secure = (require config_path('session.php'))['secure'];

    $_ENV = $env;
    $_SERVER = $server;
    putenv($envApp === false ? 'APP_ENV' : 'APP_ENV='.$envApp);
    putenv($envSecure === false ? 'SESSION_SECURE_COOKIE' : 'SESSION_SECURE_COOKIE='.$envSecure);

    expect($secure)->toBeTrue();
});
