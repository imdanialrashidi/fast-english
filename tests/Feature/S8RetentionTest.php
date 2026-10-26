<?php

use App\Models\PaymentRequest;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S8-8 (retention, scope §19.3): an old reviewed receipt loses its FILE,
// keeps its ROW (with receipt_deleted_at set); a pending receipt is never
// touched. Two users + a recent-reviewed negative path.

function s8ReceiptRow(object $user, string $status, ?string $reviewedAt, ?string $cancelledAt = null): PaymentRequest
{
    $path = 'receipts/s8-'.str()->random(12).'.jpg';
    Storage::disk('local')->put($path, (string) file_get_contents(database_path('seeders/fixtures/s3-cover-fixture.jpg')));

    return PaymentRequest::factory()->create([
        'user_id' => $user->id,
        'receipt_path' => $path,
        'status' => $status,
        'reviewed_at' => $reviewedAt,
        'cancelled_at' => $cancelledAt,
        'receipt_deleted_at' => null,
    ]);
}

beforeEach(function () {
    $this->userA = ContentFixtures::student();
    $this->userB = ContentFixtures::student();
});

test('an old reviewed receipt is removed but its row remains', function () {
    $row = s8ReceiptRow($this->userA, PaymentRequest::STATUS_APPROVED, now()->subDays(100)->toDateTimeString());
    expect(Storage::disk('local')->exists($row->receipt_path))->toBeTrue();

    $this->artisan('receipts:retain-reviewed')->assertSuccessful();

    $fresh = $row->fresh();
    expect(Storage::disk('local')->exists($row->receipt_path))->toBeFalse()
        ->and($fresh)->not->toBeNull()
        ->and($fresh->receipt_deleted_at)->not->toBeNull()
        // The financial row and its references survive.
        ->and($fresh->amount_toman_snapshot)->toBe($row->amount_toman_snapshot)
        ->and($fresh->status)->toBe(PaymentRequest::STATUS_APPROVED);

    // The owner's receipt route now 404s instead of serving bytes, and
    // the status page no longer renders a dead receipt link.
    $this->actingAs($this->userA)->get(route('payments.receipt.show', $fresh))->assertNotFound();
    $this->actingAs($this->userA)
        ->get(route('payments.show', $fresh))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('request.receipt_url', null)
            ->where('request.has_receipt', false));
});

test('pending and recent receipts are never touched', function () {
    $pending = s8ReceiptRow($this->userA, PaymentRequest::STATUS_PENDING, null);
    $pending->forceFill(['created_at' => now()->subDays(200), 'updated_at' => now()->subDays(200)])->save();
    $recent = s8ReceiptRow($this->userB, PaymentRequest::STATUS_REJECTED, now()->subDays(10)->toDateTimeString());
    $cancelled = s8ReceiptRow($this->userB, PaymentRequest::STATUS_CANCELLED, null, now()->subDays(10)->toDateTimeString());

    $this->artisan('receipts:retain-reviewed')->assertSuccessful();

    foreach ([$pending, $recent, $cancelled] as $row) {
        $fresh = $row->fresh();
        expect(Storage::disk('local')->exists($row->receipt_path))->toBeTrue()
            ->and($fresh->receipt_deleted_at)->toBeNull();
    }

    // The pending owner can still fetch their receipt bytes.
    $this->actingAs($this->userA)->get(route('payments.receipt.show', $pending->fresh()))->assertOk();
});

test('a second run is idempotent and dry run changes nothing', function () {
    $row = s8ReceiptRow($this->userA, PaymentRequest::STATUS_APPROVED, now()->subDays(120)->toDateTimeString());

    $this->artisan('receipts:retain-reviewed', ['--dry-run' => true])->assertSuccessful();
    expect(Storage::disk('local')->exists($row->receipt_path))->toBeTrue()
        ->and($row->fresh()->receipt_deleted_at)->toBeNull();

    $this->artisan('receipts:retain-reviewed')->assertSuccessful();
    $first = $row->fresh()->receipt_deleted_at;
    $this->artisan('receipts:retain-reviewed')->assertSuccessful();
    expect($row->fresh()->receipt_deleted_at->equalTo($first))->toBeTrue();
});
