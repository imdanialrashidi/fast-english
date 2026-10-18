<?php

use App\Models\PaymentDestination;
use App\Models\PaymentRequest;
use App\Models\Plan;
use Database\Seeders\S5PaymentFixtureSeeder;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S5-5 (snapshot isolation): later plan/destination edits never mutate an
// existing snapshot; a new request uses the new values. Two users prove
// the old row stays byte-identical while the new row picks up the edits.

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = ContentFixtures::student();
    $this->studentB = ContentFixtures::student();
});

test('an existing request keeps its snapshot after plan and destination edits', function () {
    $plan30 = Plan::where('slug', 's5-test-30')->firstOrFail();

    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $plan30->id]);
    $old = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();
    $before = $old->fresh()->getAttributes();

    // Change the plan price and rotate the destination (single-active).
    $plan30->update(['price_toman' => 200000]);
    $oldDestination = PaymentDestination::where('is_active', true)->firstOrFail();
    $oldDestination->update(['is_active' => false]);
    $newDestination = PaymentDestination::create([
        'card_number' => '6219861012345678',
        'holder_name' => 'صاحب تازه (TEST)',
        'bank_name' => 'بانک تازه (TEST)',
        'instructions' => 'متن آزمایشی تازه.',
        'is_active' => true,
    ]);

    // The existing row is byte-identical; its page still shows the old
    // amount and card (snapshot, not live data).
    expect($old->fresh()->getAttributes())->toBe($before);

    // Public-slice port (ADR-0002): the snapshot values travel as
    // decoded props (the Persian amount renders client-side).
    $shown = $this->actingAs($this->studentA)
        ->get(route('payments.show', $old))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Payments/Show'));
    $shownProps = $shown->inertiaProps();
    expect($shownProps['request']['amount_label'])->toBe('۱۰۰٬۰۰۰ تومان')
        ->and($shownProps['request']['card_number'])->toBe($oldDestination->card_number)
        ->and($shownProps['request']['amount_label'])->not->toBe('۲۰۰٬۰۰۰ تومان')
        ->and($shownProps['request']['card_number'])->not->toBe($newDestination->card_number);

    // A new request (second student) uses the new values.
    $this->actingAs($this->studentB)->post(route('payments.store'), ['plan_id' => $plan30->id]);
    $new = PaymentRequest::where('user_id', $this->studentB->id)->firstOrFail();
    expect((int) $new->amount_toman_snapshot)->toBe(200000)
        ->and($new->destination_snapshot['card_number'])->toBe($newDestination->card_number);
});
