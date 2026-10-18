<?php

use Database\Seeders\S1SampleSeeder;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S4-5 preferred level (LEVEL-01): explicit settings writes only. The reader
// URL never changes it, the unavailable-level message still holds, and no
// silent substitution happens. Two users, negative paths included.

beforeEach(function () {
    $this->seed(S1SampleSeeder::class);
    // Paid-only slice: the reader leg needs an active subscription.
    $this->studentA = ContentFixtures::subscribedStudent();
    $this->studentB = ContentFixtures::subscribedStudent();
});

test('preferred level changes only through the settings page', function () {
    $this->actingAs($this->studentA)
        ->patch(route('account.settings.update'), ['preferred_level' => 'B1'])
        ->assertRedirect(route('account.settings'));

    expect($this->studentA->fresh()->preferred_level)->toBe('B1');
    expect($this->studentB->fresh()->preferred_level)->toBeNull();
});

test('the reader URL level does not change the preferred level', function () {
    $this->actingAs($this->studentA)
        ->patch(route('account.settings.update'), ['preferred_level' => 'A2'])
        ->assertRedirect();

    $this->actingAs($this->studentA)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'B1']))
        ->assertOk();

    expect($this->studentA->fresh()->preferred_level)->toBe('A2');
});

test('an invalid preferred level is refused and nothing is stored', function () {
    $this->actingAs($this->studentA)
        ->patch(route('account.settings.update'), ['preferred_level' => 'Z9'])
        ->assertSessionHasErrors('preferred_level');

    expect($this->studentA->fresh()->preferred_level)->toBeNull();
});

test('the unavailable-level message and no-substitution rule still hold', function () {
    $this->actingAs($this->studentA)
        ->patch(route('account.settings.update'), ['preferred_level' => 'B1'])
        ->assertRedirect();

    // city-park has no C1: the NotReady page renders the exact message
    // client-side with A2/B1 links, and no body or audio from another
    // level leaks in (proven in tests/browser/m1-journey.spec.ts).
    $this->actingAs($this->studentA)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'C1']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Reader/NotReady')
            ->where('requestedLevel', 'C1')
            ->where('availableLevels', ['A2', 'B1']));

    $response = $this->actingAs($this->studentA)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'C1']))
        ->assertOk();
    expect($response->getContent())->not->toContain('On Saturday morning, Sara walks');
    expect($response->getContent())->not->toContain('/media/lessons/');
});

test('guests cannot open the settings page', function () {
    $this->get(route('account.settings'))->assertRedirect();
    $this->patch(route('account.settings.update'), ['preferred_level' => 'B1'])
        ->assertRedirect();
});
