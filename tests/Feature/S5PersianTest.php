<?php

use App\Models\PaymentRequest;
use App\Models\Plan;
use Database\Seeders\S5PaymentFixtureSeeder;
use Illuminate\Http\UploadedFile;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S7 pre-slice 3: learner-facing validation and status messages on the
// subscribe, request, and receipt pages are Persian, with lang=fa and
// dir=rtl on those forms. The browser's native file-picker label follows
// the browser locale and is outside our control (recorded in the plan).

beforeEach(function () {
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = ContentFixtures::student();
    $this->studentB = ContentFixtures::student();
    $this->plan = Plan::where('slug', 's5-test-30')->firstOrFail();
});

test('subscribe and request forms carry lang=fa dir=rtl', function () {
    $subscribe = $this->actingAs($this->studentA)->get(route('subscribe.index'))->assertOk()->getContent() ?? '';
    expect($subscribe)->toContain('lang="fa"')
        ->and($subscribe)->toContain('dir="rtl"');

    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan->id]);
    $row = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();
    $page = $this->actingAs($this->studentA)->get(route('payments.show', $row))->assertOk()->getContent() ?? '';
    expect($page)->toContain('lang="fa"')
        ->and($page)->toContain('dir="rtl"');
});

test('plan tamper and unavailable-plan messages are Persian', function () {
    $tamper = $this->actingAs($this->studentA)
        ->postJson(route('payments.store'), ['plan_id' => $this->plan->id, 'amount_toman_snapshot' => 1])
        ->assertStatus(422)
        ->json('message');
    expect($tamper)->toContain('غیرمجاز');

    $this->plan->update(['is_active' => false]);
    $inactive = $this->actingAs($this->studentB)
        ->postJson(route('payments.store'), ['plan_id' => $this->plan->id])
        ->assertStatus(422)
        ->json('message');
    expect($inactive)->toContain('در دسترس نیست');
});

test('payment create failures stay in the page, not a JSON modal', function () {
    $this->actingAs($this->studentA)
        ->post(route('payments.store'), [
            'plan_id' => $this->plan->id,
            'amount_toman_snapshot' => 1,
        ])
        ->assertRedirect(route('subscribe.index'))
        ->assertSessionHasErrors('plan_id');

    expect(PaymentRequest::where('user_id', $this->studentA->id)->count())->toBe(0);
});

test('receipt validation errors are Persian', function () {
    $this->actingAs($this->studentA)->post(route('payments.store'), ['plan_id' => $this->plan->id]);
    $row = PaymentRequest::where('user_id', $this->studentA->id)->firstOrFail();

    $bad = UploadedFile::fake()->createWithContent('receipt.jpg', 'not an image at all');
    $response = $this->actingAs($this->studentA)
        ->postJson(route('payments.receipt.store', $row), ['receipt' => $bad])
        ->assertStatus(422);
    $message = (string) json_encode($response->json(), JSON_UNESCAPED_UNICODE);
    expect($message)->toContain('رسید');

    // The Inertia page renders the Persian field error after redirect:
    // the 302 carries the error bag, and the next visit shares it.
    $this->actingAs($this->studentA)
        ->post(route('payments.receipt.store', $row), ['receipt' => $bad])
        ->assertStatus(302)
        ->assertSessionHasErrors('receipt');
    $bag = session('errors');
    expect($bag->first('receipt'))->toContain('رسید');
    $this->actingAs($this->studentA)
        ->get(route('payments.show', $row))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Payments/Show'));
});
