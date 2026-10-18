<?php

use App\Actions\ApprovePayment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionEvent;
use App\Support\SubscriptionAccess;
use Carbon\Carbon;
use Database\Seeders\S5PaymentFixtureSeeder;
use Illuminate\Validation\ValidationException;
use Tests\Support\S6Payments;

// S6 manual grant + revoke (scope §11.3, AC-16): reason required, one event
// each, same lock order, revoke stops access with no refund, and a replayed
// old approval never reactivates a revoked subscription.

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = S6Payments::student();
    $this->studentB = S6Payments::student();
    $this->staff = S6Payments::staff();
    $this->plan = Plan::where('slug', 's5-test-30')->firstOrFail();
    $this->now = Carbon::parse('2026-10-01 12:00:00', 'UTC');
});

test('manual grant creates a window and writes one event with a reason', function () {
    $outcome = ApprovePayment::grant($this->studentA->id, $this->staff, 30, 'support grant (TEST)', $this->now);

    $subscription = $outcome['subscription'];
    expect($subscription->starts_at->equalTo($this->now))->toBeTrue()
        ->and($subscription->expires_at->equalTo($this->now->copy()->addDays(30)))->toBeTrue()
        ->and($subscription->revoked_at)->toBeNull();

    $event = $outcome['event'];
    expect($event->type)->toBe(SubscriptionEvent::TYPE_GRANTED)
        ->and($event->source_payment_request_id)->toBeNull()
        ->and((int) $event->duration_days)->toBe(30)
        ->and($event->reason)->toBe('support grant (TEST)')
        ->and((int) $event->actor_id)->toBe((int) $this->staff->id);

    expect(SubscriptionAccess::eligible($this->studentA, $this->now))->toBeTrue();

    // Isolation: the second student gains nothing.
    expect(Subscription::where('user_id', $this->studentB->id)->exists())->toBeFalse();
    expect(SubscriptionAccess::eligible($this->studentB, $this->now))->toBeFalse();
});

test('grant requires a reason and a positive duration', function () {
    foreach ([
        ['duration' => 30, 'reason' => '   '],
        ['duration' => 0, 'reason' => 'support (TEST)'],
        ['duration' => -5, 'reason' => 'support (TEST)'],
    ] as $bad) {
        try {
            ApprovePayment::grant($this->studentA->id, $this->staff, $bad['duration'], $bad['reason'], $this->now);
            $granted = true;
        } catch (ValidationException) {
            $granted = false;
        }
        expect($granted)->toBeFalse("grant(duration={$bad['duration']}) must be refused");
    }
    expect(Subscription::where('user_id', $this->studentA->id)->exists())->toBeFalse();

    // Non-staff cannot grant (negative path).
    try {
        ApprovePayment::grant($this->studentA->id, $this->studentB, 30, 'x (TEST)', $this->now);
        $byStudent = true;
    } catch (ValidationException) {
        $byStudent = false;
    }
    expect($byStudent)->toBeFalse();
});

test('revoke stops access with no automatic refund and writes one event', function () {
    ApprovePayment::grant($this->studentA->id, $this->staff, 30, 'support (TEST)', $this->now);
    $before = Subscription::where('user_id', $this->studentA->id)->firstOrFail();

    $revokeAt = $this->now->copy()->addDays(3);
    $outcome = ApprovePayment::revoke($this->studentA->id, $this->staff, 'abuse (TEST)', $revokeAt);

    $subscription = $outcome['subscription'];
    expect($subscription->revoked_at?->equalTo($revokeAt))->toBeTrue();
    // No refund, no date rewrite: the paid window is untouched.
    expect($subscription->starts_at->equalTo($before->starts_at))->toBeTrue()
        ->and($subscription->expires_at->equalTo($before->expires_at))->toBeTrue();

    expect($outcome['event']->type)->toBe(SubscriptionEvent::TYPE_REVOKED)
        ->and($outcome['event']->source_payment_request_id)->toBeNull()
        ->and($outcome['event']->reason)->toBe('abuse (TEST)');

    expect(SubscriptionAccess::eligible($this->studentA, $revokeAt))->toBeFalse('revoked access stops on the next request');

    // Revoke needs a reason and an existing subscription (negative paths).
    try {
        ApprovePayment::revoke($this->studentB->id, $this->staff, 'abuse (TEST)', $revokeAt);
        $missing = true;
    } catch (Throwable) {
        $missing = false;
    }
    expect($missing)->toBeFalse('revoking a user without a subscription must fail');

    try {
        ApprovePayment::revoke($this->studentA->id, $this->staff, '   ', $revokeAt);
        $emptyReason = true;
    } catch (ValidationException) {
        $emptyReason = false;
    }
    expect($emptyReason)->toBeFalse();
});

test('a replayed old approval never reactivates a revoked subscription', function () {
    $pending = S6Payments::pendingRequest($this, $this->studentA, $this->plan);
    ApprovePayment::approve($pending->id, $this->staff, $this->now);

    $revokeAt = $this->now->copy()->addDays(2);
    ApprovePayment::revoke($this->studentA->id, $this->staff, 'abuse (TEST)', $revokeAt);
    $revoked = Subscription::where('user_id', $this->studentA->id)->firstOrFail();

    // Replaying the old approval returns the prior result and changes
    // nothing: still revoked, same expiry, no new event.
    $replay = ApprovePayment::approve($pending->id, $this->staff, $this->now->copy()->addDays(4));

    expect($replay['replayed'])->toBeTrue();
    $current = Subscription::where('user_id', $this->studentA->id)->firstOrFail();
    expect($current->revoked_at?->equalTo($revoked->revoked_at))->toBeTrue('revocation survives the replay')
        ->and($current->expires_at->equalTo($revoked->expires_at))->toBeTrue('no extension on replay');
    expect(SubscriptionEvent::where('source_payment_request_id', $pending->id)->count())->toBe(1);
    expect(SubscriptionAccess::eligible($this->studentA, $this->now->copy()->addDays(4)))->toBeFalse();
});

test('staff cannot grant their own subscription', function () {
    $eventsBefore = SubscriptionEvent::count();

    try {
        ApprovePayment::grant($this->staff->id, $this->staff, 30, 'self grant (TEST)', $this->now);
        $granted = true;
    } catch (ValidationException $e) {
        $granted = false;
        expect(collect($e->errors())->flatten()->implode(' '))->toContain('own');
    }
    expect($granted)->toBeFalse('self-grant must be refused');
    expect(Subscription::where('user_id', $this->staff->id)->exists())->toBeFalse();
    expect(SubscriptionEvent::count())->toBe($eventsBefore);
});

test('staff cannot revoke their own subscription', function () {
    $eventsBefore = SubscriptionEvent::where('user_id', $this->staff->id)->count();

    try {
        ApprovePayment::revoke($this->staff->id, $this->staff, 'self revoke (TEST)', $this->now);
        $revoked = true;
    } catch (ValidationException $e) {
        $revoked = false;
        expect(collect($e->errors())->flatten()->implode(' '))->toContain('own');
    }
    expect($revoked)->toBeFalse('self-revoke must be refused');
    expect(Subscription::where('user_id', $this->staff->id)->exists())->toBeFalse();
    expect(SubscriptionEvent::where('user_id', $this->staff->id)->count())->toBe($eventsBefore);
});
