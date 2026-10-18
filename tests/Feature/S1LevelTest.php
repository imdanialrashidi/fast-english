<?php

use Database\Seeders\S1SampleSeeder;
use Inertia\Testing\AssertableInertia;

// S1-3: an unavailable level shows the exact message with the available
// levels and substitutes no other level.
beforeEach(function () {
    $this->seed(S1SampleSeeder::class);
});

test('requesting a missing B2 level shows the exact message and available levels', function () {
    // M1 port (ADR-0002): the exact message renders client-side from the
    // NotReady props (proven in tests/browser/m1-journey.spec.ts); HTTP
    // asserts the component, the requested level, and the no-substitution
    // rule on the decoded props plus the encoded page.
    $response = $this->get(route('reader.show', ['topic' => 'city-park', 'level' => 'B2']));

    $response->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Reader/NotReady')
        ->where('requestedLevel', 'B2')
        ->where('availableLevels', ['A2', 'B1']));

    // No other level is substituted: neither body nor audio appears.
    $response->assertDontSee('On Saturday morning, Sara walks');
    $response->assertDontSee('Sara loves Saturday mornings');
    $response->assertDontSee('/media/lessons/', false);
});

test('lowercase level input is normalized instead of reported missing', function () {
    // Paid-only slice: b1 is a flagged sample level, so the normalized
    // request redirects to the public sample experience carrying it.
    $redirect = $this->get(route('reader.show', ['topic' => 'city-park', 'level' => 'b1']))
        ->assertRedirect(route('sample', ['topic' => 'city-park', 'level' => 'B1']));
    $this->followRedirects($redirect)
        ->assertOk()
        ->assertSee('Sara loves Saturday mornings');
});
