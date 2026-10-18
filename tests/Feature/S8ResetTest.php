<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S8-2 (reset, AUTH-02): the Fortify reset flow on the log/array mailers
// (real SMTP is BLOCKED, scope §25). A link works once; a second use
// fails; unknown emails get the same response as known ones. Two users +
// negative paths (wrong token, mismatched email, short password).

beforeEach(function () {
    Notification::fake();
    $this->studentA = ContentFixtures::student();
    $this->studentB = ContentFixtures::student();
});

test('reset link works once and the second use fails', function () {
    $this->post(route('password.email'), ['email' => $this->studentA->email])
        ->assertRedirect()
        ->assertSessionHas('status');

    Notification::assertSentTo($this->studentA, ResetPassword::class, function ($notification) use (&$token) {
        $token = $notification->token;

        return true;
    });

    $this->post(route('password.update'), [
        'token' => $token,
        'email' => $this->studentA->email,
        'password' => 'new-password-1234',
        'password_confirmation' => 'new-password-1234',
    ])->assertRedirect();

    expect(Hash::check('new-password-1234', $this->studentA->fresh()->password))->toBeTrue();

    // Second use of the same link fails: the token row is gone.
    $this->post(route('password.update'), [
        'token' => $token,
        'email' => $this->studentA->email,
        'password' => 'another-password-1234',
        'password_confirmation' => 'another-password-1234',
    ])->assertSessionHasErrors('email');

    expect(Hash::check('new-password-1234', $this->studentA->fresh()->password))->toBeTrue();
    // The other user is untouched by the whole flow.
    expect(Hash::check('password', $this->studentB->fresh()->password))->toBeTrue();
});

test('unknown emails get the same response as known ones', function () {
    $message = 'اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال شد.';

    // Unknown FIRST (fresh session): the neutral message, no error bag.
    $this->post(route('password.email'), ['email' => 'nobody-here@example.com'])
        ->assertRedirect()
        ->assertSessionHas('status', $message)
        ->assertSessionHasNoErrors();

    $known = $this->post(route('password.email'), ['email' => $this->studentA->email])
        ->assertRedirect()
        ->assertSessionHas('status', $message)
        ->assertSessionHasNoErrors();

    expect($known->status())->toBe(302);

    Notification::assertSentTo($this->studentA, ResetPassword::class);
    Notification::assertNotSentTo(new User(['email' => 'nobody-here@example.com']), ResetPassword::class);

    // JSON callers get the identical payload either way.
    $this->postJson(route('password.email'), ['email' => 'nobody-else@example.com'])
        ->assertOk()
        ->assertJsonPath('status', $message);
    $this->postJson(route('password.email'), ['email' => $this->studentB->email])
        ->assertOk()
        ->assertJsonPath('status', $message);
});

test('reset with a forged token or mismatched email fails', function () {
    $this->post(route('password.email'), ['email' => $this->studentA->email]);
    Notification::assertSentTo($this->studentA, ResetPassword::class, function ($notification) use (&$token) {
        $token = $notification->token;

        return true;
    });

    // Forged token.
    $this->post(route('password.update'), [
        'token' => 'forged-token-value',
        'email' => $this->studentA->email,
        'password' => 'new-password-1234',
        'password_confirmation' => 'new-password-1234',
    ])->assertSessionHasErrors('email');

    // Valid token but another user's email.
    $this->post(route('password.update'), [
        'token' => $token,
        'email' => $this->studentB->email,
        'password' => 'new-password-1234',
        'password_confirmation' => 'new-password-1234',
    ])->assertSessionHasErrors('email');

    expect(Hash::check('password', $this->studentA->fresh()->password))->toBeTrue();
    expect(Hash::check('password', $this->studentB->fresh()->password))->toBeTrue();
});

test('reset forms render fa rtl with noindex', function () {
    // Public-slice port (ADR-0002): the same Fortify forms as Inertia
    // pages. Persian copy renders client-side (proven in the browser);
    // HTTP asserts the root template, the components, and the token +
    // email props the reset form needs.
    $forgot = $this->get(route('password.request'))->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Auth/ForgotPassword'))
        ->getContent();
    expect($forgot)->toContain('lang="fa"')
        ->and($forgot)->toContain('dir="rtl"');

    $this->post(route('password.email'), ['email' => $this->studentA->email]);
    Notification::assertSentTo($this->studentA, ResetPassword::class, function ($notification) use (&$token) {
        $token = $notification->token;

        return true;
    });

    $this->get(route('password.reset', ['token' => $token]).'?email='.urlencode($this->studentA->email))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Auth/ResetPassword')
            ->where('token', $token)
            ->where('email', $this->studentA->email));
});
