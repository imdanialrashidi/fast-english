<?php

use App\Models\PaymentRequest;
use App\Models\Plan;
use Database\Seeders\S5PaymentFixtureSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ContentFixtures;

// S5-6 (privacy): the receipt bytes go only to the owner with no-store;
// another student gets 403. Receipt path + bank reference never appear in
// HTML, logs, or public JSON. The app shell, account page, and receipt
// route all carry private, no-store (two users).

function s5AssertPrivateNoStore($response): void
{
    $directives = collect(explode(',', strtolower((string) $response->headers->get('Cache-Control'))))
        ->map(fn ($directive) => trim($directive));

    expect($directives)->toContain('private')->and($directives)->toContain('no-store');
}

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = ContentFixtures::student();
    $this->studentB = ContentFixtures::student();
    $this->plan = Plan::where('slug', 's5-test-30')->firstOrFail();
});

test('the receipt route serves the owner with no-store and 403 to another student', function () {
    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan->id]);
    $row = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();
    $this->actingAs($this->studentA)->post(route('payments.receipt.store', $row), [
        'bank_reference' => 'S5BANKREF123',
        'sender_last4' => '7890',
        'receipt' => UploadedFile::fake()->createWithContent(
            'receipt.jpg',
            (string) file_get_contents(database_path('seeders/fixtures/s3-cover-fixture.jpg'))
        ),
    ]);
    $row = $row->fresh();

    $owner = $this->actingAs($this->studentA)->get(route('payments.receipt.show', $row));
    $owner->assertOk();
    s5AssertPrivateNoStore($owner);
    expect($owner->headers->get('Content-Type'))->toContain('image/');

    // Another student is refused on both the bytes and the page.
    $this->actingAs($this->studentB)->get(route('payments.receipt.show', $row))->assertForbidden();
    $this->actingAs($this->studentB)->get(route('payments.show', $row))->assertForbidden();

    // Guests are refused as well (log out first: actingAs persists).
    auth()->logout();
    $this->get(route('payments.receipt.show', $row))->assertRedirect();
});

test('receipt path and bank reference stay out of HTML, logs, and public JSON', function () {
    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan->id]);
    $row = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();
    $this->actingAs($this->studentA)->post(route('payments.receipt.store', $row), [
        'bank_reference' => 'S5SECRETREF999',
        'sender_last4' => '4321',
        'receipt' => UploadedFile::fake()->createWithContent(
            'receipt.jpg',
            (string) file_get_contents(database_path('seeders/fixtures/s3-cover-fixture.jpg'))
        ),
    ]);
    $row = $row->fresh();
    assert($row->receipt_path !== null);

    // Owner HTML carries the snapshot but never the private path, the
    // bank reference, or the last-four digits.
    $html = $this->actingAs($this->studentA)
        ->get(route('payments.show', $row))
        ->assertOk()
        ->getContent();
    expect($html)->not->toContain($row->receipt_path)
        ->and($html)->not->toContain('S5SECRETREF999')
        ->and($html)->not->toContain('receipts/');

    // The other student's library HTML carries none of it either (the
    // paid-only gate locks the page: 403 with no lesson content at all).
    $library = $this->actingAs($this->studentB)->get(route('app.home'))->assertForbidden()->getContent();
    expect($library)->not->toContain($row->receipt_path)
        ->and($library)->not->toContain('S5SECRETREF999');

    // JSON creation responses carry only id + status (never private paths
    // or transfer details). Note: 'awaiting_receipt' contains the substring
    // 'receipt', so the assertion targets receipt_path/bank keys instead.
    $this->actingAs($this->studentB)->postJson(route('payments.store'), ['plan_id' => $this->plan->id])->assertOk();
    $createJson = $this->actingAs($this->studentB)->postJson(route('payments.store'), ['plan_id' => $this->plan->id])->json();
    expect(json_encode($createJson))->not->toContain('receipt_path')
        ->and(json_encode($createJson))->not->toContain('bank_reference')
        ->and(json_encode($createJson))->not->toContain('S5SECRETREF999');

    // The receipt never lands on the public disk.
    expect(Storage::disk('public')->exists($row->receipt_path))->toBeFalse();

    // Application logs (when present) hold no receipt path or reference.
    $logPath = storage_path('logs/laravel.log');
    if (is_file($logPath)) {
        $log = (string) @file_get_contents($logPath);
        expect($log)->not->toContain($row->receipt_path)
            ->and($log)->not->toContain('S5SECRETREF999');
    }
});

test('the app shell, account page, and receipt route all send no-store', function () {
    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan->id]);
    $row = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();
    $this->actingAs($this->studentA)->post(route('payments.receipt.store', $row), [
        'receipt' => UploadedFile::fake()->createWithContent(
            'receipt.jpg',
            (string) file_get_contents(database_path('seeders/fixtures/s3-cover-fixture.jpg'))
        ),
    ]);
    $row = $row->fresh();

    s5AssertPrivateNoStore($this->actingAs($this->studentA)->get(route('app.home')));
    s5AssertPrivateNoStore($this->actingAs($this->studentB)->get(route('app.home')));
    s5AssertPrivateNoStore($this->actingAs($this->studentA)->get(route('app.account')));
    s5AssertPrivateNoStore($this->actingAs($this->studentB)->get(route('app.account')));
    s5AssertPrivateNoStore($this->actingAs($this->studentA)->get(route('subscribe.index')));
    s5AssertPrivateNoStore($this->actingAs($this->studentB)->get(route('subscribe.index')));
    s5AssertPrivateNoStore($this->actingAs($this->studentA)->get(route('payments.receipt.show', $row)));
});
