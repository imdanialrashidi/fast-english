<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia;

// S0-3 (public slice port, ADR-0002): the display-name rule the retired
// learner Livewire component enforced (required/string/255, owner-only)
// now lives in the explicit settings PATCH. Same claims: a valid name is
// stored server-side and survives a full reload; an empty name fails,
// saves nothing, and shows no success.
test('logged-in user can save a display name and still sees it after a full reload', function () {
    $user = User::factory()->create(['name' => 'Old Name']);
    $other = User::factory()->create(['name' => 'Other Name']);
    $this->actingAs($user);

    $this->patch(route('account.settings.update'), ['name' => 'New Name'])
        ->assertRedirect(route('account.settings'))
        ->assertSessionHasNoErrors();

    expect($user->fresh()->name)->toBe('New Name');
    // The other user's row is untouched.
    expect($other->fresh()->name)->toBe('Other Name');

    // Full HTTP reload of the account page shows the stored value.
    $this->get(route('account'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Account/Index')
            ->where('user.name', 'New Name'));

    $this->get(route('account.settings'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Account/Settings')
            ->where('user.name', 'New Name'));
});

test('empty display name shows a field error, saves nothing, and shows no success message', function () {
    $user = User::factory()->create(['name' => 'Kept Name']);
    $this->actingAs($user);

    $this->from(route('account.settings'))
        ->patch(route('account.settings.update'), ['name' => ''])
        ->assertRedirect(route('account.settings'))
        ->assertSessionHasErrors(['name']);

    expect($user->fresh()->name)->toBe('Kept Name');

    $this->get(route('account'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Account/Index')
            ->where('user.name', 'Kept Name'));
});
