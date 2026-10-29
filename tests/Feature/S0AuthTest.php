<?php

use App\Mail\VerifyEmailCodeMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

// S0-2: register -> verify email code -> logout -> login -> refresh.
test('visitor can register, verify the emailed code, log out, log back in, and stay logged in across a refresh', function () {
    Mail::fake();

    $payload = [
        'name' => 'S0 User',
        'email' => 's0@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ];

    // Owner request 2026-10-28: registration sends a six-digit code and
    // lands on the verification page; the account starts unverified.
    $this->post(route('register.store'), $payload)->assertRedirect(route('verification.notice'));
    $this->assertAuthenticated();

    $code = null;
    Mail::assertSent(VerifyEmailCodeMail::class, function (VerifyEmailCodeMail $mail) use (&$code): bool {
        $code = $mail->code;

        return $mail->hasTo('s0@example.com');
    });

    // The learner surface stays closed until the code is accepted.
    $this->get(route('account'))->assertRedirect(route('verification.notice'));
    $this->get(route('verification.notice'))->assertOk()->assertSee('s0@example.com');

    $this->post(route('verification.verify'), ['code' => $code])->assertRedirect(route('account'));
    $this->assertNotNull(User::where('email', 's0@example.com')->first()?->email_verified_at);

    // Authenticated page reachable: the session is real.
    $this->get(route('account'))->assertOk()->assertSee('s0@example.com');

    $this->post(route('logout'))->assertRedirect();
    $this->assertGuest();

    // A second, unrelated user exists: sessions must not leak between users.
    User::factory()->create(['email' => 'other@example.com']);

    $this->post(route('login.store'), [
        'email' => 's0@example.com',
        'password' => 'password123',
    ])->assertRedirect(route('account'));
    $this->assertAuthenticated();

    // Refresh again: still the same user, not the other one.
    $this->get(route('account'))
        ->assertOk()
        ->assertSee('s0@example.com')
        ->assertDontSee('other@example.com');

    expect(User::count())->toBe(2);
});

// S0-2 negative path: wrong password is rejected with a generic error.
test('wrong password shows a generic error and leaves the visitor logged out', function () {
    $user = User::factory()->create(['email' => 's0-wrong@example.com']);

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'not-the-password',
    ]);

    $response->assertSessionHasErrors('email');
    $this->assertGuest();
    $this->get(route('account'))->assertRedirect(route('login'));
});

// S0-2 negative path: a suspended account cannot log in or reach auth routes.
test('account with disabled_at set cannot log in and cannot reach authenticated routes', function () {
    $user = User::factory()->create([
        'email' => 'suspended@example.com',
        'disabled_at' => now(),
    ]);

    // Even with the correct password the error is generic.
    $response = $this->from(route('login'))->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);
    $response->assertRedirect(route('login'));
    $response->assertSessionHasErrors('email');
    $this->assertGuest();

    // A session created before suspension is destroyed on the next request.
    $active = User::factory()->create(['email' => 'active@example.com']);
    $this->actingAs($active);
    $this->get(route('account'))->assertOk();

    $active->forceFill(['disabled_at' => now()])->save();

    $this->get(route('account'))->assertRedirect(route('login'));
    $this->assertGuest();
});
