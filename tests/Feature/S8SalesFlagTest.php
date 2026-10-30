<?php

use App\Models\PaymentRequest;
use App\Models\Plan;
use App\Support\Toman;
use Database\Seeders\S5PaymentFixtureSeeder;
use Illuminate\Config\Repository;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S8 sales switch: a configuration flag, off by default in production.
// When off, prices stay visible but no payment request can be created.
// Both states tested, two users + negative path.

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = ContentFixtures::student();
    $this->studentB = ContentFixtures::student();
    $this->plan30 = Plan::where('slug', 's5-test-30')->firstOrFail();
});

test('sales flag defaults off outside testing config', function () {
    // The shipped default (no env set) is OFF: production stays closed
    // until the owner opts in with real commercial inputs.
    $default = (new Repository([]))->get('sales.enabled', 'unset');
    expect($default)->toBe('unset');
    expect(config('sales.enabled'))->toBeTrue(); // test lane enables it (phpunit.xml)
});

test('sales off still lists priced plans while refusing purchase', function () {
    config(['sales.enabled' => false]);

    // Public-slice port (ADR-0002): salesOn=false closes the purchase
    // action, but the priced plan list is still product information and
    // remains visible to the signed-in learner.
    $off = $this->actingAs($this->studentA)->get(route('subscribe.index'))->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Subscribe/Index')
            ->where('salesOn', false));
    $plans = $off->inertiaProps()['plans'];
    expect($plans)->not->toBeEmpty()
        ->and($plans[0])->toHaveKeys(['name_fa', 'price_label', 'duration_days'])
        ->and($plans[0]['price_label'])->toBe(Toman::format(100000))
        ->and($plans[0])->not->toHaveKey('price_toman');

    $offB = $this->actingAs($this->studentB)->get(route('subscribe.index'))->assertOk();
    expect($offB->inertiaProps()['plans'])->toBe($plans);
});

test('sales off refuses payment creation with nothing stored', function () {
    config(['sales.enabled' => false]);

    $this->actingAs($this->studentA)
        ->postJson(route('payments.store'), ['plan_id' => $this->plan30->id])
        ->assertStatus(422)
        ->assertJsonPath('message', 'فروش در حال حاضر فعال نیست.');

    $this->actingAs($this->studentB)
        ->postJson(route('payments.store'), ['plan_id' => $this->plan30->id])
        ->assertStatus(422);

    // HTML form posts bounce back with no row either.
    $this->actingAs($this->studentA)
        ->post(route('payments.store'), ['plan_id' => $this->plan30->id])
        ->assertRedirect(route('subscribe.index'));

    expect(PaymentRequest::count())->toBe(0);
});

test('sales on lists plans and allows creation', function () {
    config(['sales.enabled' => true]);

    // Public-slice port (ADR-0002): plans travel as decoded props.
    $on = $this->actingAs($this->studentA)->get(route('subscribe.index'))->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Subscribe/Index')
            ->where('salesOn', true));
    expect($on->inertiaProps()['plans'])->not->toBe([]);

    $this->actingAs($this->studentA)
        ->post(route('payments.store'), ['plan_id' => $this->plan30->id])
        ->assertRedirect();

    expect(PaymentRequest::where('user_id', $this->studentA->id)->count())->toBe(1);
    // Second student is independent: their own request works too.
    $this->actingAs($this->studentB)
        ->post(route('payments.store'), ['plan_id' => $this->plan30->id])
        ->assertRedirect();
    expect(PaymentRequest::where('user_id', $this->studentB->id)->count())->toBe(1);
});
