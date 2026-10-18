<?php

use App\Models\PaymentDestination;
use App\Models\PaymentRequest;
use App\Models\Plan;
use Database\Seeders\S5PaymentFixtureSeeder;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S5-1 (snapshot): the server creates awaiting_receipt with an immutable
// snapshot from the active plan + destination. The client sends only the
// plan ID — amount/duration/destination/status keys are 422 with no write.
// Two users + negative path per protected route (guest + inactive plan).

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = ContentFixtures::student();
    $this->studentB = ContentFixtures::student();
    $this->plan30 = Plan::where('slug', 's5-test-30')->firstOrFail();
    $this->destination = PaymentDestination::where('is_active', true)->firstOrFail();
});

test('selecting a plan creates awaiting_receipt with the server snapshot', function () {
    $response = $this->actingAs($this->studentA)
        ->post(route('payments.store'), ['plan_id' => $this->plan30->id]);

    $response->assertRedirect();

    $row = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();
    expect($row->status)->toBe(PaymentRequest::STATUS_AWAITING_RECEIPT)
        ->and($row->plan_name_snapshot)->toBe($this->plan30->name_fa)
        ->and((int) $row->amount_toman_snapshot)->toBe((int) $this->plan30->price_toman)
        ->and((int) $row->duration_days_snapshot)->toBe((int) $this->plan30->duration_days)
        ->and($row->destination_snapshot['card_number'])->toBe($this->destination->card_number)
        ->and($row->destination_snapshot['holder_name'])->toBe($this->destination->holder_name)
        ->and($row->destination_snapshot['bank_name'])->toBe($this->destination->bank_name)
        ->and($row->receipt_path)->toBeNull();

    // The request page shows the snapshot values (not live plan data).
    // Public-slice port (ADR-0002): asserted on the decoded Inertia
    // props instead of the encoded page.
    $shown = $this->actingAs($this->studentA)
        ->get(route('payments.show', $row))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Payments/Show'));
    $shownProps = $shown->inertiaProps();
    expect($shownProps['request']['plan_name'])->toBe($this->plan30->name_fa)
        ->and($shownProps['request']['card_number'])->toBe($this->destination->card_number);
});

test('client-sent amount, duration, destination, or status is rejected with 422', function () {
    $count = PaymentRequest::count();

    foreach ([
        ['plan_id' => $this->plan30->id, 'amount_toman_snapshot' => 1],
        ['plan_id' => $this->plan30->id, 'price_toman' => 1],
        ['plan_id' => $this->plan30->id, 'duration_days_snapshot' => 999],
        ['plan_id' => $this->plan30->id, 'destination_id' => 999],
        ['plan_id' => $this->plan30->id, 'status' => 'pending'],
        ['plan_id' => $this->plan30->id, 'plan_name_snapshot' => 'forged'],
    ] as $payload) {
        $this->actingAs($this->studentA)
            ->postJson(route('payments.store'), $payload)
            ->assertStatus(422);
    }

    expect(PaymentRequest::count())->toBe($count);
});

test('an inactive plan is refused and a guest cannot create', function () {
    // Guest leg first (negative path): JSON gets 401, never a row.
    // actingAs() persists for later requests, so the guest assertion must
    // run before any authenticated call in this test.
    $this->postJson(route('payments.store'), ['plan_id' => $this->plan30->id])
        ->assertUnauthorized();
    expect(PaymentRequest::count())->toBe(0);

    $this->plan30->update(['is_active' => false]);

    $this->actingAs($this->studentA)
        ->postJson(route('payments.store'), ['plan_id' => $this->plan30->id])
        ->assertStatus(422);
    expect(PaymentRequest::count())->toBe(0);
});

test('two students each own their snapshot', function () {
    $plan90 = Plan::where('slug', 's5-test-90')->firstOrFail();

    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan30->id]);
    $this->actingAs($this->studentB)->post(route('payments.store'), ['plan_id' => $plan90->id]);

    $a = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();
    $b = PaymentRequest::where('user_id', $this->studentB->id)->firstOrFail();

    expect((int) $a->amount_toman_snapshot)->toBe((int) $this->plan30->price_toman)
        ->and((int) $b->amount_toman_snapshot)->toBe((int) $plan90->price_toman)
        ->and($a->id)->not->toBe($b->id);
});
