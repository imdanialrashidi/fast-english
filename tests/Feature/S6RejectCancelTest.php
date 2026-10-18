<?php

use App\Actions\ApprovePayment;
use App\Models\PaymentRequest;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionEvent;
use Database\Seeders\S5PaymentFixtureSeeder;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;
use Tests\Support\S6Payments;

// S6 reject + staff cancel (scope §10.1, §11.3, AC-14): pending-only, reason
// required, no new access effect, prior windows preserved, resubmission on
// a new row. Two users plus negative paths throughout.

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = S6Payments::student();
    $this->studentB = S6Payments::student();
    $this->staff = S6Payments::staff();
    $this->plan = Plan::where('slug', 's5-test-30')->firstOrFail();
});

test('reject carries the public reason, hides the internal note, and grants nothing', function () {
    $pending = S6Payments::pendingRequest($this, $this->studentA, $this->plan);

    $rejected = ApprovePayment::reject($pending->id, $this->staff, 'رسید ناخوانا بود (TEST).', 'card mismatch? check (TEST)');

    expect($rejected->status)->toBe(PaymentRequest::STATUS_REJECTED)
        ->and($rejected->public_reason)->toBe('رسید ناخوانا بود (TEST).')
        ->and($rejected->internal_note)->toBe('card mismatch? check (TEST)')
        ->and((int) $rejected->reviewed_by)->toBe((int) $this->staff->id)
        ->and($rejected->reviewed_at)->not->toBeNull();

    // No subscription effect and no audit event for the request.
    expect(Subscription::where('user_id', $this->studentA->id)->exists())->toBeFalse();
    expect(SubscriptionEvent::where('source_payment_request_id', $pending->id)->count())->toBe(0);

    // The learner page shows the public reason but never the internal note.
    // Public-slice port (ADR-0002): asserted on the decoded props.
    $page = $this->actingAs($this->studentA)->get(route('payments.show', $pending));
    $page->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Payments/Show'));
    $props = $page->inertiaProps();
    expect($props['request']['public_reason'])->toBe('رسید ناخوانا بود (TEST).');
    expect((string) json_encode($props))->not->toContain('card mismatch? check (TEST)');

    // The other student sees nothing of it (negative path).
    $this->actingAs($this->studentB)->get(route('payments.show', $pending))->assertForbidden();
});

test('reject needs a pending request and a public reason', function () {
    $pending = S6Payments::pendingRequest($this, $this->studentA, $this->plan);

    try {
        ApprovePayment::reject($pending->id, $this->staff, '   ', 'note (TEST)');
        $emptyReason = true;
    } catch (ValidationException) {
        $emptyReason = false;
    }
    expect($emptyReason)->toBeFalse('empty public reason must be refused');

    ApprovePayment::reject($pending->id, $this->staff, 'ناخوانا (TEST)', null);

    // Second reject on a terminal row is refused.
    try {
        ApprovePayment::reject($pending->id, $this->staff, 'again (TEST)', null);
        $second = true;
    } catch (ValidationException) {
        $second = false;
    }
    expect($second)->toBeFalse();

    // Non-staff cannot reject (negative path).
    $other = S6Payments::pendingRequest($this, $this->studentB, $this->plan);
    try {
        ApprovePayment::reject($other->id, $this->studentA, 'x (TEST)', null);
        $byStudent = true;
    } catch (ValidationException) {
        $byStudent = false;
    }
    expect($byStudent)->toBeFalse();
    expect($other->fresh()->status)->toBe(PaymentRequest::STATUS_PENDING);
});

test('resubmit after reject creates a new request and preserves the prior window', function () {
    $pending = S6Payments::pendingRequest($this, $this->studentA, $this->plan);
    ApprovePayment::reject($pending->id, $this->staff, 'ناخوانا (TEST)', null);

    // The prior row is kept byte-identical apart from the review columns.
    $response = $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan->id]);
    $response->assertRedirect();
    $fresh = PaymentRequest::where('user_id', $this->studentA->id)->orderByDesc('id')->firstOrFail();
    expect($fresh->id)->not->toBe($pending->id)
        ->and($fresh->status)->toBe(PaymentRequest::STATUS_AWAITING_RECEIPT);
    expect($pending->fresh()->status)->toBe(PaymentRequest::STATUS_REJECTED);

    // A prior valid subscription survives a later reject untouched.
    $grantedAt = now()->subDays(5);
    ApprovePayment::grant($this->studentA->id, $this->staff, 30, 'support (TEST)', $grantedAt);
    $before = Subscription::where('user_id', $this->studentA->id)->firstOrFail()->expires_at;
    $second = S6Payments::pendingRequest($this, $this->studentA, $this->plan);
    ApprovePayment::reject($second->id, $this->staff, 'تکراری (TEST)', null);
    expect(Subscription::where('user_id', $this->studentA->id)->firstOrFail()->expires_at->equalTo($before))->toBeTrue();
});

test('staff cancel needs a pending request and a reason', function () {
    $pending = S6Payments::pendingRequest($this, $this->studentA, $this->plan);

    try {
        ApprovePayment::cancel($pending->id, $this->staff, '  ');
        $emptyReason = true;
    } catch (ValidationException) {
        $emptyReason = false;
    }
    expect($emptyReason)->toBeFalse('empty cancel reason must be refused');

    $cancelled = ApprovePayment::cancel($pending->id, $this->staff, 'duplicate transfer (TEST)');
    expect($cancelled->status)->toBe(PaymentRequest::STATUS_CANCELLED)
        ->and((int) $cancelled->cancelled_by)->toBe((int) $this->staff->id)
        ->and($cancelled->cancelled_at)->not->toBeNull();
    expect(Subscription::where('user_id', $this->studentA->id)->exists())->toBeFalse();

    // Terminal rows cannot be cancelled again.
    try {
        ApprovePayment::cancel($pending->id, $this->staff, 'again (TEST)');
        $second = true;
    } catch (ValidationException) {
        $second = false;
    }
    expect($second)->toBeFalse();

    // The learner still cannot cancel a pending request themselves (S5
    // rule kept: pending cancellation is staff-only with a reason).
    $other = S6Payments::pendingRequest($this, $this->studentB, $this->plan);
    $this->actingAs($this->studentB)->post(route('payments.cancel', $other))->assertForbidden();
    expect($other->fresh()->status)->toBe(PaymentRequest::STATUS_PENDING);
});
