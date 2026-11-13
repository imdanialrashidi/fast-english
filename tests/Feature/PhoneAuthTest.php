<?php

use App\Models\PhoneVerificationCode;
use App\Models\SmsMessage;
use App\Models\User;
use App\Support\PhoneVerificationCodes;
use App\Support\Sms\MelliPayamakSender;
use App\Support\Sms\SmsSendFailed;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

function smsConfigure(string|array $response = ['Value' => '1234567890123456', 'RetStatus' => 1, 'StrRetStatus' => 'Ok']): void
{
    config([
        'sms.driver' => 'melipayamak',
        'sms.melipayamak.base_url' => 'https://sms.test/api/SendSMS',
        'sms.melipayamak.username' => 'test-user',
        'sms.melipayamak.password' => 'test-pass',
        'sms.melipayamak.otp_body_id' => 1001,
        'sms.melipayamak.subscription_body_id' => 1002,
        'sms.subscription_notifications' => true,
    ]);

    Http::fake(['sms.test/*' => Http::response($response, 200)]);
}

function sentSmsCode(): string
{
    $pair = Http::recorded()
        ->reverse()
        ->first(fn (array $pair): bool => str_contains($pair[0]->url(), '/BaseServiceNumber')
            && (string) $pair[0]['bodyId'] === '1001');

    return $pair === null ? '' : (string) $pair[0]['text'];
}

test('registration with SMS requires a phone and verifies it by the six-digit code', function () {
    smsConfigure();

    $this->post(route('register.store'), [
        'name' => 'SMS User',
        'phone' => '۰۹۱۲۳۴۵۶۷۸۹',
        'email' => 'sms-user@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertRedirect(route('phone.notice'));

    $this->assertAuthenticated();

    $user = User::where('email', 'sms-user@example.com')->firstOrFail();
    expect($user->phone)->toBe('09123456789')
        ->and($user->phone_verified_at)->toBeNull()
        ->and($user->email_verified_at)->toBeNull();

    $row = PhoneVerificationCode::where('user_id', $user->id)->firstOrFail();
    $code = sentSmsCode();
    expect($code)->toMatch('/^\d{6}$/')
        ->and($row->purpose)->toBe(PhoneVerificationCodes::PURPOSE_VERIFY)
        ->and($row->code_hash)->not->toBe($code)
        ->and(Hash::check($code, $row->code_hash))->toBeTrue();

    // The learner surface stays closed until the SMS code is accepted.
    $this->get(route('account'))->assertRedirect(route('phone.notice'));
    $this->get(route('phone.notice'))->assertOk();

    $this->post(route('phone.verify'), ['code' => $code])
        ->assertRedirect(route('account'))
        ->assertSessionHas('status');

    expect($user->fresh()->hasVerifiedPhone())->toBeTrue();
    $this->assertDatabaseMissing('phone_verification_codes', ['user_id' => $user->id]);
    $this->get(route('account'))->assertOk();
});

test('registration without a phone keeps the email code path when SMS is off', function () {
    config(['sms.driver' => 'null']);

    $this->post(route('register.store'), [
        'name' => 'Email User',
        'email' => 'email-path@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertRedirect(route('verification.notice'));

    $user = User::where('email', 'email-path@example.com')->firstOrFail();
    expect($user->phone)->toBeNull()
        ->and($user->email_verified_at)->toBeNull();
});

test('a known phone receives a hashed login code and is signed in by it', function () {
    smsConfigure();

    $user = User::factory()->create([
        'email' => 'phone-login@example.com',
        'phone' => '09121112233',
        'phone_verified_at' => now(),
    ]);

    $this->post(route('phone.login.send'), ['phone' => '+98 912 111 2233'])
        ->assertRedirect(route('phone.login.verify'))
        ->assertSessionHas('status');

    $this->get(route('phone.login.verify'))->assertOk();

    $code = sentSmsCode();
    expect($code)->toMatch('/^\d{6}$/');

    $row = PhoneVerificationCode::where('user_id', $user->id)->firstOrFail();
    expect($row->purpose)->toBe(PhoneVerificationCodes::PURPOSE_LOGIN)
        ->and($row->code_hash)->not->toBe($code);

    $this->post(route('phone.login.verify.store'), ['code' => $code])
        ->assertRedirect(route('account'));

    $this->assertAuthenticatedAs($user->fresh());
    $this->assertDatabaseMissing('phone_verification_codes', ['user_id' => $user->id]);
});

test('an unknown phone gets the neutral message and no SMS is sent', function () {
    smsConfigure();

    $this->post(route('phone.login.send'), ['phone' => '09129998877'])
        ->assertRedirect(route('phone.login.verify'));

    Http::assertNothingSent();

    $this->get(route('phone.login.verify'))->assertOk();
    $this->post(route('phone.login.verify.store'), ['code' => '123456'])
        ->assertSessionHasErrors('code');
    $this->assertGuest();
});

test('five wrong login codes destroy the code and a correct one no longer works', function () {
    smsConfigure();

    $user = User::factory()->create([
        'phone' => '09125556677',
        'phone_verified_at' => now(),
    ]);

    $this->post(route('phone.login.send'), ['phone' => $user->phone]);
    $code = sentSmsCode();

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->post(route('phone.login.verify.store'), ['code' => '000000'])
            ->assertSessionHasErrors('code');
    }

    $this->assertDatabaseMissing('phone_verification_codes', ['user_id' => $user->id]);
    $this->post(route('phone.login.verify.store'), ['code' => $code])
        ->assertSessionHasErrors('code');
    $this->assertGuest();
});

test('an expired login code is rejected and a resend is blocked by the cooldown', function () {
    smsConfigure();

    $user = User::factory()->create([
        'phone' => '09124443322',
        'phone_verified_at' => now(),
    ]);

    $this->post(route('phone.login.send'), ['phone' => $user->phone]);
    $first = sentSmsCode();

    $this->post(route('phone.login.resend'))->assertSessionHas('error');
    Http::assertSentCount(1);

    $this->travel(61)->seconds();
    $this->post(route('phone.login.resend'))->assertSessionHas('status');
    Http::assertSentCount(2);

    $this->travel(6)->minutes();
    $this->post(route('phone.login.verify.store'), ['code' => $first])
        ->assertSessionHasErrors('code');
    $this->assertGuest();
});

test('a disabled account cannot complete phone login', function () {
    smsConfigure();

    $user = User::factory()->create([
        'phone' => '09127778899',
        'phone_verified_at' => now(),
        'disabled_at' => now(),
    ]);

    $this->post(route('phone.login.send'), ['phone' => $user->phone])
        ->assertRedirect(route('phone.login.verify'));

    Http::assertNothingSent();
    $this->assertGuest();
});

test('adding a phone in account settings sends a code and marks it verified', function () {
    smsConfigure();

    $user = User::factory()->create(['email' => 'settings-phone@example.com']);
    $this->actingAs($user);

    $this->patch(route('account.settings.update'), ['phone' => '09126665544'])
        ->assertRedirect(route('phone.notice'));

    expect($user->fresh()->phone)->toBe('09126665544')
        ->and($user->fresh()->phone_verified_at)->toBeNull();

    $this->post(route('phone.verify'), ['code' => sentSmsCode()])
        ->assertRedirect(route('account'));

    expect($user->fresh()->hasVerifiedPhone())->toBeTrue();
});

test('a second account cannot take an existing phone number', function () {
    smsConfigure();

    User::factory()->create(['phone' => '09120001122', 'phone_verified_at' => now()]);
    $other = User::factory()->create();
    $this->actingAs($other);

    $this->patch(route('account.settings.update'), ['phone' => '+989120001122'])
        ->assertSessionHasErrors('phone');

    expect($other->fresh()->phone)->toBeNull();
});

test('a failed provider send restores the previous phone and verified state', function () {
    config([
        'sms.driver' => 'melipayamak',
        'sms.melipayamak.base_url' => 'https://sms.test/api/SendSMS',
        'sms.melipayamak.username' => 'test-user',
        'sms.melipayamak.password' => 'test-pass',
        'sms.melipayamak.otp_body_id' => 1001,
        'sms.melipayamak.subscription_body_id' => 1002,
    ]);
    Http::fake(['sms.test/*' => Http::response(['Value' => '-2', 'RetStatus' => 0], 200)]);

    $user = User::factory()->create([
        'phone' => '09123334455',
        'phone_verified_at' => now(),
    ]);
    $this->actingAs($user);

    $this->patch(route('account.settings.update'), ['phone' => '09123334466'])
        ->assertSessionHasErrors('phone');

    $fresh = $user->fresh();
    expect($fresh->phone)->toBe('09123334455')
        ->and($fresh->hasVerifiedPhone())->toBeTrue()
        ->and(PhoneVerificationCode::where('user_id', $user->id)->exists())->toBeFalse()
        ->and(SmsMessage::where('kind', SmsMessage::KIND_CODE)->firstOrFail()->status)
        ->toBe(SmsMessage::STATUS_REJECTED);
});

test('the MelliPayamak client sends the login code as an approved pattern', function () {
    Http::fake(['sms.test/*' => Http::response(['Value' => '9876543210987654', 'RetStatus' => 1], 200)]);

    $sms = new MelliPayamakSender([
        'base_url' => 'https://sms.test/api/SendSMS',
        'username' => 'u',
        'password' => 'p',
        'otp_body_id' => 1001,
        'subscription_body_id' => 1002,
        'timeout' => 5,
    ]);

    $sms->sendCode('09121234567', '123456');

    Http::assertSent(fn ($request): bool => str_contains($request->url(), '/BaseServiceNumber')
        && $request['username'] === 'u'
        && $request['password'] === 'p'
        && $request['to'] === '09121234567'
        && (string) $request['bodyId'] === '1001'
        && $request['text'] === '123456'
        && ! $request->hasHeader('from')
        && ! isset($request['from']));
});

test('the MelliPayamak client rejects a provider refusal', function () {
    Http::fake(['sms.test/*' => Http::response(['Value' => '-2', 'RetStatus' => 0], 200)]);

    $sms = new MelliPayamakSender([
        'base_url' => 'https://sms.test/api/SendSMS',
        'username' => 'u',
        'password' => 'p',
        'otp_body_id' => 1001,
        'subscription_body_id' => 1002,
        'timeout' => 5,
    ]);

    expect(fn () => $sms->sendCode('09121234567', '123456'))
        ->toThrow(SmsSendFailed::class);
});

test('an unknown provider outcome keeps the code the learner may have received', function () {
    smsConfigure('<html>gateway</html>');

    $user = User::factory()->create([
        'phone' => '09127771234',
        'phone_verified_at' => now(),
    ]);

    $this->post(route('phone.login.send'), ['phone' => $user->phone])
        ->assertRedirect(route('phone.login.verify'))
        ->assertSessionHas('status');

    // The row stays: the SMS may have arrived, and a blind resend would
    // deliver a second code.
    expect(PhoneVerificationCode::where('user_id', $user->id)
        ->where('purpose', PhoneVerificationCodes::PURPOSE_LOGIN)->exists())->toBeTrue();
    expect(SmsMessage::where('kind', SmsMessage::KIND_CODE)->firstOrFail()->status)
        ->toBe(SmsMessage::STATUS_UNKNOWN);
});

test('the confirmed support phone and Bale channel are published on the support page', function () {
    $this->get(route('trust.support'))->assertOk()->assertInertia(fn ($page) => $page
        ->where('contact.support_phone', '09221889814')
        ->where('contact.support_phone_href', 'tel:+989221889814')
        ->where('contact.support_messenger', 'بله')
        ->where('contact.support_email', 'info@fastenglishpodcast.ir'));
});
