<?php

use App\Mail\VerifyEmailCodeMail;
use App\Models\EmailVerificationCode;
use App\Models\Lesson;
use App\Models\User;
use Database\Seeders\S1SampleSeeder;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;

function registerWithCode(string $email = 'verify@example.com'): string
{
    Mail::fake();

    test()->post(route('register.store'), [
        'name' => 'Verify User',
        'email' => $email,
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertRedirect(route('verification.notice'));

    $code = null;
    Mail::assertSent(VerifyEmailCodeMail::class, function (VerifyEmailCodeMail $mail) use (&$code, $email): bool {
        $code = $mail->code;

        return $mail->hasTo($email);
    });

    return (string) $code;
}

test('registration mails a hashed six-digit code and the account starts unverified', function () {
    $code = registerWithCode('new-code@example.com');

    $user = User::where('email', 'new-code@example.com')->firstOrFail();
    $row = EmailVerificationCode::where('user_id', $user->id)->firstOrFail();

    expect($user->email_verified_at)->toBeNull()
        ->and($code)->toMatch('/^\d{6}$/')
        ->and($row->code_hash)->not->toBe($code)
        ->and(password_verify($code, $row->code_hash))->toBeTrue()
        ->and($row->attempts)->toBe(0)
        ->and($row->expires_at->isFuture())->toBeTrue();

    $this->actingAs($user)
        ->get(route('verification.notice'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Auth/VerifyEmail')
            ->where('hasActiveCode', true)
            ->where('ttlMinutes', 10)
            ->where('retryAfter', fn (int $seconds): bool => $seconds > 50 && $seconds <= 60));
});

test('registration sends only the six-digit code mail, not the default signed-link mail', function () {
    Mail::fake();
    Notification::fake();

    $this->post(route('register.store'), [
        'name' => 'One Mail User',
        'email' => 'one-mail@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertRedirect(route('verification.notice'));

    $user = User::where('email', 'one-mail@example.com')->firstOrFail();

    Mail::assertSent(VerifyEmailCodeMail::class, 1);
    // Laravel's default notification would be a second, English
    // signed-link email whose GET route shows the code page instead of
    // verifying, so it must not be sent.
    Notification::assertNotSentTo($user, VerifyEmail::class);
});

test('the emailed code verifies the account and opens the learner surface', function () {
    $code = registerWithCode('verify-ok@example.com');
    $user = User::where('email', 'verify-ok@example.com')->firstOrFail();

    $this->actingAs($user)
        ->post(route('verification.verify'), ['code' => $code])
        ->assertRedirect(route('account'))
        ->assertSessionHas('status');

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
    $this->assertDatabaseMissing('email_verification_codes', ['user_id' => $user->id]);

    $this->actingAs($user->fresh())->get(route('account'))->assertOk();
});

test('a wrong code is rejected without verifying and counts an attempt', function () {
    registerWithCode('verify-wrong@example.com');
    $user = User::where('email', 'verify-wrong@example.com')->firstOrFail();

    $this->actingAs($user)
        ->from(route('verification.notice'))
        ->post(route('verification.verify'), ['code' => '000000'])
        ->assertRedirect(route('verification.notice'))
        ->assertSessionHasErrors('code');

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
    expect(EmailVerificationCode::where('user_id', $user->id)->firstOrFail()->attempts)->toBe(1);
});

test('five wrong guesses destroy the code and the correct code no longer works', function () {
    $code = registerWithCode('verify-limit@example.com');
    $user = User::where('email', 'verify-limit@example.com')->firstOrFail();

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->actingAs($user)
            ->from(route('verification.notice'))
            ->post(route('verification.verify'), ['code' => '000000'])
            ->assertSessionHasErrors('code');
    }

    $this->assertDatabaseMissing('email_verification_codes', ['user_id' => $user->id]);

    $this->actingAs($user)
        ->from(route('verification.notice'))
        ->post(route('verification.verify'), ['code' => $code])
        ->assertSessionHasErrors('code');

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

test('an expired code is rejected and must be resent', function () {
    $code = registerWithCode('verify-expired@example.com');
    $user = User::where('email', 'verify-expired@example.com')->firstOrFail();

    $this->travel(11)->minutes();

    $this->actingAs($user)
        ->from(route('verification.notice'))
        ->post(route('verification.verify'), ['code' => $code])
        ->assertSessionHasErrors('code');

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
    $this->assertDatabaseMissing('email_verification_codes', ['user_id' => $user->id]);
});

test('resend waits for the cooldown, replaces the code, and sends a new mail', function () {
    $firstCode = registerWithCode('verify-resend@example.com');
    $user = User::where('email', 'verify-resend@example.com')->firstOrFail();

    $this->actingAs($user)
        ->from(route('verification.notice'))
        ->post(route('verification.send'))
        ->assertSessionHas('error');

    Mail::assertSentTimes(VerifyEmailCodeMail::class, 1);

    $this->travel(61)->seconds();

    $newCode = null;

    $this->actingAs($user)
        ->from(route('verification.notice'))
        ->post(route('verification.send'))
        ->assertSessionHas('status');

    Mail::assertSentTimes(VerifyEmailCodeMail::class, 2);

    $newCode = Mail::sent(VerifyEmailCodeMail::class)->last()?->code;

    expect($newCode)->toMatch('/^\d{6}$/')
        ->and($newCode)->not->toBe($firstCode);
    expect(EmailVerificationCode::where('user_id', $user->id)->firstOrFail()->attempts)->toBe(0);
});

test('an unverified account reaches only the verification and public surfaces', function () {
    $user = User::factory()->unverified()->create(['email' => 'gate@example.com']);

    $this->actingAs($user)->get(route('account'))->assertRedirect(route('verification.notice'));
    $this->actingAs($user)->get(route('app.account'))->assertRedirect(route('verification.notice'));
    $this->actingAs($user)->get(route('app.home'))->assertRedirect(route('verification.notice'));

    $this->actingAs($user)->get(route('install'))->assertOk();
});

test('an unverified account can still play the free public sample audio', function () {
    $this->seed(S1SampleSeeder::class);
    $sample = Lesson::query()->where('is_public_sample', true)->firstOrFail();
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)->get(route('media.lesson.audio', $sample))->assertOk();
});

test('a verified account is not redirected by the email gate', function () {
    $user = User::factory()->create(['email' => 'verified@example.com']);

    $this->actingAs($user)->get(route('account'))->assertOk();
});

test('the notice page redirects an already verified account', function () {
    $user = User::factory()->create(['email' => 'already@example.com']);

    $this->actingAs($user)
        ->get(route('verification.notice'))
        ->assertRedirect(route('account'));
});
