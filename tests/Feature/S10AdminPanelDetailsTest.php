<?php

use App\Filament\Pages\BusinessSettings;
use App\Filament\Widgets\OperationsOverview;
use App\Models\PaymentDestination;
use App\Models\PaymentRequest;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\Support\ContentFixtures;

// Payment review details, retention state, Tehran display, dashboard and
// owner-settings hardening found in the complete admin-panel review.

test('the payment record shows transfer hints, audit and current subscription', function () {
    $staff = ContentFixtures::staff();
    $learner = ContentFixtures::subscribedStudent();

    $request = PaymentRequest::factory()->create([
        'user_id' => $learner->id,
        'status' => PaymentRequest::STATUS_PENDING,
        'receipt_path' => 'receipts/details.jpg',
        'bank_reference' => 'AUDITREF-123',
        'sender_last4' => '4321',
        'transferred_at' => now()->subHour(),
        'internal_note' => 'AUDIT-INTERNAL-NOTE',
        'reviewed_by' => $staff->id,
        'reviewed_at' => now(),
    ]);
    Storage::disk('local')->put('receipts/details.jpg', 'receipt-bytes');

    $html = $this->actingAs($staff)
        ->get("/admin/payment-requests/{$request->id}")
        ->assertOk()
        ->getContent();

    expect($html)
        ->toContain('AUDITREF-123')
        ->toContain('4321')
        ->toContain('AUDIT-INTERNAL-NOTE')
        ->toContain($staff->name)
        ->toContain('Active');
});

test('a retained or missing receipt is explained rather than shown broken', function () {
    $staff = ContentFixtures::staff();
    $learner = ContentFixtures::student();

    $retained = PaymentRequest::factory()->create([
        'user_id' => $learner->id,
        'status' => PaymentRequest::STATUS_APPROVED,
        'receipt_path' => 'receipts/retained.jpg',
        'receipt_deleted_at' => now(),
    ]);

    $html = $this->actingAs($staff)
        ->get("/admin/payment-requests/{$retained->id}")
        ->assertOk()
        ->getContent();

    expect($html)->toContain('removed by 90-day retention');

    $missing = PaymentRequest::factory()->create([
        'user_id' => $learner->id,
        'status' => PaymentRequest::STATUS_PENDING,
        'receipt_path' => 'receipts/does-not-exist.jpg',
    ]);

    $this->actingAs($staff)
        ->get("/admin/payment-requests/{$missing->id}")
        ->assertOk()
        ->assertSee('missing on disk');
});

test('the panel displays timestamps in Asia/Tehran', function () {
    $staff = ContentFixtures::staff();
    $learner = ContentFixtures::student();

    $request = PaymentRequest::factory()->create([
        'user_id' => $learner->id,
        'status' => PaymentRequest::STATUS_PENDING,
        'created_at' => '2026-10-25 19:14:23',
        'updated_at' => '2026-10-25 19:14:23',
    ]);

    $this->actingAs($staff)
        ->get("/admin/payment-requests/{$request->id}")
        ->assertOk()
        ->assertSee('22:44:23');
});

test('the dashboard shows pending payment and content counts', function () {
    $staff = ContentFixtures::staff();
    PaymentRequest::factory()->create(['status' => PaymentRequest::STATUS_PENDING]);

    $this->actingAs($staff);

    Livewire::test(OperationsOverview::class)
        ->assertSee('Pending payments')
        ->assertSee('Active subscriptions');
});

test('persian card digits are normalized and a card without holder is rejected', function () {
    $staff = ContentFixtures::staff();
    $this->actingAs($staff);

    Livewire::test(BusinessSettings::class)
        ->set('supportChannel', '@review_support')
        ->set('cooperationChannel', '@review_coop')
        ->set('cardNumber', '۶۰۳۷ ۹۹۱۱ ۱۲۳۴ ۵۶۷۸')
        ->set('cardHolder', 'صاحب کارت')
        ->set('cardBank', 'بانک نمونه')
        ->set('terms', 'شرایط')
        ->set('privacy', 'حریم خصوصی')
        ->set('refund', 'بازگشت وجه')
        ->call('save')
        ->assertHasNoErrors();

    $destination = PaymentDestination::where('is_active', true)->firstOrFail();
    expect($destination->card_number)->toBe('6037991112345678');

    Livewire::test(BusinessSettings::class)
        ->set('cardNumber', '6037991112345678')
        ->set('cardHolder', '')
        ->set('cardBank', 'بانک نمونه')
        ->call('save')
        ->assertHasErrors(['cardHolder']);
});

test('staff bootstrap refuses to create an account without a password', function () {
    $this->artisan('staff:bootstrap', [
        'email' => 'no-password@example.com',
        '--by' => 'ops (TEST)',
    ])->assertFailed();

    expect(User::where('email', 'no-password@example.com')->exists())->toBeFalse();
});

test('staff two-factor reset clears only the second factor and is audited', function () {
    $staff = ContentFixtures::staff();
    $staff->forceFill([
        'two_factor_secret' => 'JBSWY3DPEHPK3PXP',
        'two_factor_recovery_codes' => [str_repeat('a', 64)],
        'two_factor_confirmed_at' => now(),
    ])->save();

    $this->artisan('staff:2fa-reset', [
        'email' => $staff->email,
        '--by' => 'owner (TEST)',
        '--reason' => 'lost authenticator',
    ])->assertSuccessful();

    $fresh = $staff->fresh();
    expect($fresh->two_factor_secret)->toBeNull()
        ->and($fresh->two_factor_recovery_codes)->toBeNull()
        ->and($fresh->two_factor_confirmed_at)->toBeNull();

    $this->artisan('staff:2fa-reset', [
        'email' => $staff->email,
        '--reason' => 'missing by',
    ])->assertFailed();
});
