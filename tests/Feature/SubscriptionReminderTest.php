<?php

use App\Actions\ApprovePayment;
use App\Models\Subscription;
use App\Notifications\SubscriptionExpiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;
use Tests\Support\ContentFixtures;

// Owner follow-up 2026-10-22: one renewal reminder per current window.
// Delivery is proven with Notification::fake(); real SMTP send remains a
// launch prerequisite and is intentionally not claimed here.

test('an expiring active subscription is reminded exactly once', function () {
    Notification::fake();
    $user = ContentFixtures::subscribedStudent();
    $subscription = $user->subscription;
    $subscription->forceFill([
        'starts_at' => now()->subDay(),
        'expires_at' => now()->addDays(2),
        'revoked_at' => null,
        'renewal_reminder_sent_at' => null,
    ])->save();

    Artisan::call('subscriptions:remind-expiring');
    expect(Artisan::output())->toContain('sent=1');

    Notification::assertSentTo($user, SubscriptionExpiring::class, fn (SubscriptionExpiring $notification) => $notification->daysLeft === 2);
    expect($subscription->fresh()->renewal_reminder_sent_at)->not->toBeNull();

    // A second run in the same window sends nothing.
    Artisan::call('subscriptions:remind-expiring');
    Notification::assertSentToTimes($user, SubscriptionExpiring::class, 1);
});

test('revoked, expired, disabled, far-future, and unstarted windows are skipped', function () {
    Notification::fake();

    $revoked = ContentFixtures::subscribedStudent();
    $revoked->subscription->forceFill([
        'expires_at' => now()->addDay(),
        'revoked_at' => now()->subHour(),
        'renewal_reminder_sent_at' => null,
    ])->save();

    $expired = ContentFixtures::subscribedStudent();
    $expired->subscription->forceFill([
        'starts_at' => now()->subDays(10),
        'expires_at' => now()->subDay(),
        'renewal_reminder_sent_at' => null,
    ])->save();

    $disabled = ContentFixtures::subscribedStudent();
    $disabled->forceFill(['disabled_at' => now()])->save();
    $disabled->subscription->forceFill([
        'expires_at' => now()->addDay(),
        'renewal_reminder_sent_at' => null,
    ])->save();

    $far = ContentFixtures::subscribedStudent();
    $far->subscription->forceFill([
        'expires_at' => now()->addDays(30),
        'renewal_reminder_sent_at' => null,
    ])->save();

    $unstarted = ContentFixtures::subscribedStudent();
    $unstarted->subscription->forceFill([
        'starts_at' => now()->addDay(),
        'expires_at' => now()->addDays(2),
        'renewal_reminder_sent_at' => null,
    ])->save();

    Artisan::call('subscriptions:remind-expiring');
    Notification::assertNothingSent();
});

test('dry run neither sends nor writes the reminder marker', function () {
    Notification::fake();
    $user = ContentFixtures::subscribedStudent();
    $user->subscription->forceFill([
        'expires_at' => now()->addDay(),
        'renewal_reminder_sent_at' => null,
    ])->save();

    Artisan::call('subscriptions:remind-expiring', ['--dry-run' => true]);

    Notification::assertNothingSent();
    expect($user->subscription->fresh()->renewal_reminder_sent_at)->toBeNull();
});

test('renewal resets the marker so the next window can remind again', function () {
    Notification::fake();
    $user = ContentFixtures::subscribedStudent();
    $user->subscription->forceFill([
        'expires_at' => now()->addDay(),
        'renewal_reminder_sent_at' => null,
    ])->save();

    Artisan::call('subscriptions:remind-expiring');
    expect($user->subscription->fresh()->renewal_reminder_sent_at)->not->toBeNull();

    ApprovePayment::grant($user->id, ContentFixtures::staff(), 30, 'renewal fixture (TEST)');

    $subscription = Subscription::where('user_id', $user->id)->firstOrFail();
    expect($subscription->renewal_reminder_sent_at)->toBeNull();
});
