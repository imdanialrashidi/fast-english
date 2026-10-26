<?php

use App\Actions\ApprovePayment;
use App\Models\Subscription;
use App\Support\Entitlement;
use Tests\Support\ContentFixtures;

// D5 entitlement gate (C1): the interface is the test surface. One
// module owns the window predicate, the staff bypass, the freshness
// rule, and the locked props — callers cross this seam, never past it.

test('window predicate: active inside the window only', function () {
    $student = ContentFixtures::subscribedStudent(30);
    $subscription = Subscription::where('user_id', $student->id)->firstOrFail();
    $now = now();

    expect(Entitlement::active($student->fresh()))->toBeTrue()
        ->and(Entitlement::windowActive($subscription, $now, $student))->toBeTrue()
        // Expired: day after expiry the window is closed.
        ->and(Entitlement::active($student->fresh(), $now->copy()->addDays(31)))->toBeFalse()
        // Revoked: closed even inside the paid window.
        ->and((function () use ($subscription, $now, $student) {
            $subscription->forceFill(['revoked_at' => $now->copy()->subDay()])->save();

            return Entitlement::windowActive($subscription->fresh(), $now, $student->fresh());
        })())->toBeFalse();
});

test('disabled owner closes the window even when dates hold', function () {
    $student = ContentFixtures::subscribedStudent(30);
    $subscription = Subscription::where('user_id', $student->id)->firstOrFail();
    $student->forceFill(['disabled_at' => now()])->save();

    expect(Entitlement::active($student->fresh()))->toBeFalse()
        ->and(Entitlement::windowActive($subscription->fresh(), now(), $student->fresh()))->toBeFalse()
        ->and(Entitlement::eligible($student->fresh()))->toBeFalse();
});

test('staff bypass passes without a window; suspended staff refused', function () {
    $staff = ContentFixtures::staff();

    expect(Entitlement::eligible($staff))->toBeTrue()
        ->and(Entitlement::staff($staff))->toBeTrue();

    $staff->forceFill(['disabled_at' => now()])->save();

    expect(Entitlement::staff($staff->fresh()))->toBeFalse();
});

test('eligible takes effect on next request after grant (freshness)', function () {
    $student = ContentFixtures::student();

    expect(Entitlement::eligible($student))->toBeFalse();

    $staff = ContentFixtures::staff();
    ApprovePayment::grant($student->id, $staff, 30, 'd5 freshness (TEST)');

    // The stale in-memory instance still passes because eligible()
    // re-queries — approvals take effect on the next request.
    expect(Entitlement::eligible($student))->toBeTrue();
});

test('locked props carry one CTA and no premium content', function () {
    $guest = Entitlement::lockedProps(null);
    $student = ContentFixtures::student();
    $signed = Entitlement::lockedProps($student);

    expect($guest['isGuest'])->toBeTrue()
        ->and($signed['isGuest'])->toBeFalse()
        ->and($signed['subscribeUrl'])->toBe(route('subscribe.index'))
        ->and($signed['sampleUrl'])->toBe(route('sample'));

    $encoded = json_encode([$guest, $signed]);
    foreach (['body_en', 'glossary', 'audio_url', 'correct_option', 'receipt_path'] as $leak) {
        expect($encoded)->not->toContain($leak);
    }
});
