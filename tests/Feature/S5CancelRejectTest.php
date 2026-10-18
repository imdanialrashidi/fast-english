<?php

use App\Models\PaymentDestination;
use App\Models\PaymentRequest;
use App\Models\Plan;
use Database\Seeders\S5PaymentFixtureSeeder;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S5-7 (cancel + reject): the learner can cancel awaiting_receipt (row is
// kept); pending cannot be cancelled by the learner; a rejected row shows
// its public reason and a new purchase creates a new request while the old
// row stays unchanged. Two users + negative paths.

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = ContentFixtures::student();
    $this->studentB = ContentFixtures::student();
    $this->plan30 = Plan::where('slug', 's5-test-30')->firstOrFail();
    $this->plan90 = Plan::where('slug', 's5-test-90')->firstOrFail();
});

test('the learner can cancel awaiting_receipt and the row is kept', function () {
    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan30->id]);
    $row = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();

    $this->actingAs($this->studentA)
        ->post(route('payments.cancel', $row))
        ->assertRedirect();

    $fresh = $row->fresh();
    expect($fresh->status)->toBe(PaymentRequest::STATUS_CANCELLED)
        ->and($fresh->cancelled_by)->toBe($this->studentA->id)
        ->and($fresh->cancelled_at)->not->toBeNull()
        ->and(PaymentRequest::where('user_id', $this->studentA->id)->count())->toBe(1);

    // Another student cannot cancel it (negative path).
    $this->actingAs($this->studentB)->post(route('payments.cancel', $row))->assertForbidden();

    // A guest cannot cancel (negative path): log out first because
    // actingAs() persists in the same test.
    auth()->logout();
    $this->post(route('payments.cancel', $row))->assertRedirect();
});

test('the learner cannot cancel a pending request', function () {
    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan30->id]);
    $row = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();
    $row->forceFill(['status' => PaymentRequest::STATUS_PENDING])->save();

    $this->actingAs($this->studentA)
        ->post(route('payments.cancel', $row))
        ->assertForbidden();
    expect($row->fresh()->status)->toBe(PaymentRequest::STATUS_PENDING);
});

test('a rejected row shows its reason and a new purchase creates a new request', function () {
    // Rejected rows are written by the future S6 review action; here the
    // row is shaped directly so the S5 learner surface can be proven.
    $rejected = new PaymentRequest;
    $rejected->forceFill([
        'user_id' => $this->studentA->id,
        'plan_id' => $this->plan30->id,
        'destination_id' => PaymentDestination::where('is_active', true)->firstOrFail()->id,
        'plan_name_snapshot' => $this->plan30->name_fa,
        'amount_toman_snapshot' => $this->plan30->price_toman,
        'duration_days_snapshot' => $this->plan30->duration_days,
        'destination_snapshot' => ['card_number' => 'x', 'holder_name' => 'y', 'bank_name' => 'z'],
        'status' => PaymentRequest::STATUS_REJECTED,
        'public_reason' => 'رسید ناخوانا بود (TEST).',
    ])->save();
    $rejected = $rejected->fresh();
    $before = $rejected->getAttributes();

    // Public-slice port (ADR-0002): the rejected state travels as
    // decoded props (the Persian reason renders client-side).
    $shown = $this->actingAs($this->studentA)
        ->get(route('payments.show', $rejected))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Payments/Show')
            ->where('request.status', 'rejected'));
    expect($shown->inertiaProps()['request']['public_reason'])->toContain('رسید ناخوانا بود');

    // A new purchase creates a new request; the old row is unchanged.
    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan90->id]);

    $rows = PaymentRequest::where('user_id', $this->studentA->id)->orderBy('id')->get();
    expect($rows)->toHaveCount(2)
        ->and($rows->first()->getAttributes())->toBe($before)
        ->and($rows->last()->status)->toBe(PaymentRequest::STATUS_AWAITING_RECEIPT);
});
