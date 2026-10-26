<?php

use App\Filament\Resources\Users\Pages\ViewUser;
use App\Models\Subscription;
use App\Models\User;
use Livewire\Livewire;
use Tests\Support\ContentFixtures;

// ADM-02 users: staff can find a learner even without a payment request,
// inspect their current window, suspend/reactivate the account, and use
// the shared audited subscription actions from the user record.

test('staff can list and open a learner with no payment request', function () {
    $staff = ContentFixtures::staff();
    $learner = ContentFixtures::student();

    $this->actingAs($staff)
        ->get('/admin/users')
        ->assertOk()
        ->assertSee($learner->email);

    $this->get("/admin/users/{$learner->id}")
        ->assertOk()
        ->assertSee($learner->email);
});

test('students cannot reach the users resource', function () {
    $this->actingAs(ContentFixtures::student())
        ->get('/admin/users')
        ->assertForbidden();
});

test('staff can suspend and reactivate an account', function () {
    $staff = ContentFixtures::staff();
    $learner = ContentFixtures::student();

    $this->actingAs($staff);

    Livewire::test(ViewUser::class, ['record' => $learner->id])
        ->callAction('suspend', ['reason' => 'chargeback investigation (TEST)'])
        ->assertHasNoErrors();

    expect($learner->fresh()->disabled_at)->not->toBeNull();

    $this->actingAs($learner->fresh())
        ->get('/app')
        ->assertRedirect(route('login'));

    $this->actingAs($staff);
    Livewire::test(ViewUser::class, ['record' => $learner->fresh()->id])
        ->callAction('activate', ['reason' => 'investigation cleared (TEST)'])
        ->assertHasNoErrors();

    expect($learner->fresh()->disabled_at)->toBeNull();
});

test('staff can grant and revoke from the user record through shared actions', function () {
    $staff = ContentFixtures::staff();
    $learner = ContentFixtures::student();

    $this->actingAs($staff);

    Livewire::test(ViewUser::class, ['record' => $learner->id])
        ->callAction('grant', [
            'duration_days' => 30,
            'reason' => 'manual support grant (TEST)',
        ])
        ->assertHasNoErrors();

    $subscription = Subscription::where('user_id', $learner->id)->first();
    expect($subscription)->not->toBeNull()
        ->and($subscription->revoked_at)->toBeNull();

    Livewire::test(ViewUser::class, ['record' => $learner->id])
        ->callAction('revoke', ['reason' => 'refund handled offline (TEST)'])
        ->assertHasNoErrors();

    expect($subscription->fresh()->revoked_at)->not->toBeNull();
});

test('staff cannot suspend their own account', function () {
    $staff = ContentFixtures::staff();

    $this->actingAs($staff);

    Livewire::test(ViewUser::class, ['record' => $staff->id])
        ->assertActionHidden('suspend')
        ->assertActionHidden('activate');
});
