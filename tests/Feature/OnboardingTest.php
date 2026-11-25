<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// Owner instruction 2026-11-25: after activation the learner sees the
// welcome page once, completes first name/surname and a Jalali birth date,
// and only then enters the learning environment.

test('an activated account completes the profile before the app opens', function () {
    $student = ContentFixtures::subscribedStudent();
    $student->forceFill(['needs_profile' => true, 'profile_completed_at' => null, 'first_name' => null, 'last_name' => null])->save();

    $this->actingAs($student)
        ->get(route('today.index'))
        ->assertRedirect(route('onboarding.show'));

    $this->actingAs($student)
        ->get(route('onboarding.show'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Onboarding/Welcome')
            ->where('user.phone', $student->phone ?? ''));

    $this->actingAs($student)
        ->post(route('onboarding.store'), [
            'first_name' => '  سارا ',
            'last_name' => ' احمدی ',
            'birth_day' => 12,
            'birth_month' => 5,
            'birth_year' => 1370,
        ])
        ->assertRedirect(route('today.index'));

    $student->refresh();
    expect($student->first_name)->toBe('سارا')
        ->and($student->last_name)->toBe('احمدی')
        ->and($student->name)->toBe('سارا احمدی')
        ->and($student->birth_date_jalali)->toBe('1370-05-12')
        ->and($student->needs_profile)->toBeFalse()
        ->and($student->profile_completed_at)->not->toBeNull();

    $this->actingAs($student)->get(route('today.index'))->assertOk();
});

test('the profile form refuses a missing surname or birth date', function () {
    $student = ContentFixtures::subscribedStudent();
    $student->forceFill(['needs_profile' => true, 'profile_completed_at' => null])->save();

    $this->actingAs($student)
        ->post(route('onboarding.store'), [
            'first_name' => 'سارا',
            'last_name' => '',
            'birth_day' => 1,
            'birth_month' => 1,
            'birth_year' => 1370,
        ])
        ->assertSessionHasErrors('last_name');

    $this->actingAs($student)
        ->post(route('onboarding.store'), [
            'first_name' => 'سارا',
            'last_name' => 'احمدی',
            'birth_day' => 1,
            'birth_month' => 1,
            'birth_year' => 1200,
        ])
        ->assertSessionHasErrors('birth_year');

    expect($student->fresh()->needs_profile)->toBeTrue();
});
