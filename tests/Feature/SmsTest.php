<?php

use App\Actions\ApprovePayment;
use App\Models\PaymentRequest;
use App\Models\Plan;
use App\Models\SmsMessage;
use App\Models\User;
use App\Support\Sms\SmsSender;
use App\Support\Sms\SmsSendFailed;
use App\Support\Sms\SmsStatus;
use Database\Seeders\S5PaymentFixtureSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

function smsTestConfigure(array $overrides = []): void
{
    config([
        'sms.driver' => 'melipayamak',
        'sms.melipayamak.base_url' => 'https://sms.test/api/SendSMS',
        'sms.melipayamak.username' => 'test-user',
        'sms.melipayamak.password' => 'test-pass',
        'sms.melipayamak.otp_body_id' => 1001,
        'sms.melipayamak.subscription_body_id' => 1002,
        'sms.subscription_notifications' => true,
        ...$overrides,
    ]);
}

function smsTestAccepted(): void
{
    Http::fake(['sms.test/*' => Http::response([
        'Value' => '1234567890123456',
        'RetStatus' => 1,
        'StrRetStatus' => 'Ok',
    ], 200)]);
}

function smsTestReceipt(): UploadedFile
{
    return UploadedFile::fake()->createWithContent(
        'receipt.jpg',
        (string) file_get_contents(database_path('seeders/fixtures/s3-cover-fixture.jpg'))
    );
}

function smsTestApprovalRequest(User $user, array $overrides = []): PaymentRequest
{
    return PaymentRequest::factory()->create([
        'user_id' => $user->id,
        'status' => PaymentRequest::STATUS_PENDING,
        'receipt_path' => 'receipts/test-receipt.jpg',
        'duration_days_snapshot' => 30,
        'plan_name_snapshot' => 'اشتراک سه‌ماهه',
        ...$overrides,
    ]);
}

test('a long receipt id survives the provider response and the database', function () {
    smsTestConfigure();
    // Raw JSON, not an array: a big integer must be decoded as a string
    // instead of losing digits through a numeric type.
    Http::fake(['sms.test/*' => Http::response(
        '{"Value":90071992547409931234,"RetStatus":1,"StrRetStatus":"Ok"}',
        200,
        ['Content-Type' => 'application/json'],
    )]);

    $receipt = app(SmsSender::class)->sendCode('09121234567', '123456');

    expect($receipt->recId)->toBe('90071992547409931234');

    $row = SmsMessage::firstOrFail();
    expect($row->rec_id)->toBe('90071992547409931234')
        ->and($row->kind)->toBe(SmsMessage::KIND_CODE)
        ->and($row->body_id)->toBe(1001)
        ->and($row->status)->toBe(SmsMessage::STATUS_ACCEPTED)
        ->and($row->phone)->toBe('09121234567');
});

test('the pattern request uses the panel credentials and the approved template id', function () {
    smsTestConfigure();
    smsTestAccepted();

    app(SmsSender::class)->sendCode('09121234567', '012345');

    Http::assertSent(fn ($request): bool => $request->url() === 'https://sms.test/api/SendSMS/BaseServiceNumber'
        && $request['username'] === 'test-user'
        && $request['password'] === 'test-pass'
        && $request['to'] === '09121234567'
        && (string) $request['bodyId'] === '1001'
        && $request['text'] === '012345'
        && ! isset($request['from']));
});

test('a 5xx response is unknown and never recorded as accepted', function () {
    smsTestConfigure();
    Http::fake(['sms.test/*' => Http::response('gateway error', 503)]);

    expect(fn () => app(SmsSender::class)->sendCode('09121234567', '123456'))
        ->toThrow(SmsSendFailed::class);

    $row = SmsMessage::firstOrFail();
    expect($row->status)->toBe(SmsMessage::STATUS_UNKNOWN)
        ->and($row->rec_id)->toBeNull()
        ->and($row->error_kind)->toBe('http_503');
});

test('approving a payment sends one activation pattern with the plan snapshot', function () {
    smsTestConfigure();
    smsTestAccepted();

    $user = User::factory()->create([
        'phone' => '09128889900',
        'phone_verified_at' => now(),
    ]);
    $staff = User::factory()->create(['is_staff' => true]);
    $request = smsTestApprovalRequest($user);

    ApprovePayment::approve($request->id, $staff);

    Http::assertSentCount(1);
    Http::assertSent(fn ($sent): bool => str_contains($sent->url(), '/BaseServiceNumber')
        && (string) $sent['bodyId'] === '1002'
        && $sent['text'] === 'اشتراک سه‌ماهه'
        && $sent['to'] === '09128889900');

    $row = SmsMessage::where('kind', SmsMessage::KIND_SUBSCRIPTION_ACTIVATED)->firstOrFail();
    expect($row->status)->toBe(SmsMessage::STATUS_ACCEPTED)
        ->and($row->user_id)->toBe($user->id);
});

test('an unverified phone receives no activation SMS but keeps its subscription', function () {
    smsTestConfigure();
    smsTestAccepted();

    $user = User::factory()->create([
        'phone' => '09128889901',
        'phone_verified_at' => null,
    ]);
    $staff = User::factory()->create(['is_staff' => true]);
    $request = smsTestApprovalRequest($user);

    ApprovePayment::approve($request->id, $staff);

    Http::assertNothingSent();
    expect(SmsMessage::count())->toBe(0)
        ->and($user->fresh()->subscription ?? null)->not->toBeNull();
});

test('a replayed approval does not send a second activation SMS', function () {
    smsTestConfigure();
    smsTestAccepted();

    $user = User::factory()->create([
        'phone' => '09128889902',
        'phone_verified_at' => now(),
    ]);
    $staff = User::factory()->create(['is_staff' => true]);
    $request = smsTestApprovalRequest($user);

    ApprovePayment::approve($request->id, $staff);
    $replay = ApprovePayment::approve($request->id, $staff);

    expect($replay['replayed'])->toBeTrue();
    Http::assertSentCount(1);
    expect(SmsMessage::count())->toBe(1);
});

test('submitting a receipt sends no SMS', function () {
    smsTestConfigure();
    smsTestAccepted();
    $this->seed(S5PaymentFixtureSeeder::class);

    $user = User::factory()->create([
        'phone' => '09128889903',
        'phone_verified_at' => now(),
    ]);
    $plan = Plan::where('slug', 's5-test-30')->firstOrFail();

    $this->actingAs($user)->post(route('payments.store'), ['plan_id' => $plan->id]);
    $request = PaymentRequest::where('user_id', $user->id)->firstOrFail();
    $this->actingAs($user)
        ->post(route('payments.receipt.store', $request), ['receipt' => smsTestReceipt()])
        ->assertRedirect();

    expect($request->fresh()->status)->toBe(PaymentRequest::STATUS_PENDING);
    Http::assertNothingSent();
    expect(SmsMessage::count())->toBe(0);
});

test('rejecting a payment sends no SMS', function () {
    smsTestConfigure();
    smsTestAccepted();

    $user = User::factory()->create([
        'phone' => '09128889904',
        'phone_verified_at' => now(),
    ]);
    $staff = User::factory()->create(['is_staff' => true]);
    $request = smsTestApprovalRequest($user);

    ApprovePayment::reject($request->id, $staff, 'رسید قابل بررسی نبود.');

    Http::assertNothingSent();
    expect(SmsMessage::count())->toBe(0);
});

test('readiness needs both approved pattern ids and the panel credentials', function () {
    smsTestConfigure(['sms.melipayamak.base_url' => '']);
    expect(SmsStatus::ready())->toBeFalse();

    smsTestConfigure(['sms.melipayamak.otp_body_id' => 0]);
    expect(SmsStatus::ready())->toBeFalse();

    smsTestConfigure(['sms.melipayamak.subscription_body_id' => 0]);
    expect(SmsStatus::ready())->toBeFalse();

    smsTestConfigure(['sms.melipayamak.password' => '']);
    expect(SmsStatus::ready())->toBeFalse();

    smsTestConfigure();
    expect(SmsStatus::ready())->toBeTrue();
});

test('the delivery command marks a delivered message and never resends', function () {
    smsTestConfigure();
    Http::fake(['sms.test/*GetDeliveries2' => Http::response(['Value' => 1, 'RetStatus' => 1])]);

    $row = (new SmsMessage)->forceFill([
        'kind' => SmsMessage::KIND_CODE,
        'phone' => '09121234567',
        'body_id' => 1001,
        'rec_id' => '1234567890123456',
        'status' => SmsMessage::STATUS_ACCEPTED,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $row->save();

    $this->artisan('sms:check-deliveries')->assertExitCode(0);

    Http::assertSentCount(1);
    Http::assertSent(fn ($request): bool => str_contains($request->url(), 'GetDeliveries2')
        && (string) $request['recId'] === '1234567890123456');

    expect($row->fresh()->status)->toBe(SmsMessage::STATUS_DELIVERED)
        ->and($row->fresh()->provider_code)->toBe('1')
        ->and($row->fresh()->check_attempts)->toBe(1);
});

test('a rejected delivery query stops the run and leaves the message untouched', function () {
    smsTestConfigure();
    Http::fake(['sms.test/*' => Http::response(['Value' => '-3', 'RetStatus' => 0])]);

    $row = (new SmsMessage)->forceFill([
        'kind' => SmsMessage::KIND_CODE,
        'phone' => '09121234567',
        'body_id' => 1001,
        'rec_id' => '1234567890123456',
        'status' => SmsMessage::STATUS_ACCEPTED,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $row->save();

    $this->artisan('sms:check-deliveries')->assertExitCode(1);

    expect($row->fresh()->status)->toBe(SmsMessage::STATUS_ACCEPTED)
        ->and($row->fresh()->check_attempts)->toBe(0);
});

test('delivery readiness is false when the phone surface is off', function () {
    config(['sms.driver' => 'null']);

    expect(SmsStatus::ready())->toBeFalse();
    $this->artisan('sms:check-deliveries')->assertExitCode(0);
    Http::assertNothingSent();
});
