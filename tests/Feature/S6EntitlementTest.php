<?php

use App\Actions\ApprovePayment;
use App\Models\Lesson;
use App\Models\Plan;
use App\Support\Entitlement;
use Carbon\Carbon;
use Database\Seeders\S1SampleSeeder;
use Database\Seeders\S5PaymentFixtureSeeder;
use Tests\Support\S6Payments;

// S6 entitlement matrix (scope §8, AC-15): eligible = user exists AND
// disabled_at is null AND revoked_at is null AND starts_at <= now <
// expires_at. Premium pages and audio use this rule; progress mutations
// funnel through the same policy. Pending grants nothing. Expired,
// revoked, and suspended accounts lose access on the next request.

beforeEach(function () {
    $this->seed(S1SampleSeeder::class);
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->studentA = S6Payments::student();
    $this->studentB = S6Payments::student();
    $this->staff = S6Payments::staff();
    $this->plan = Plan::where('slug', 's5-test-30')->firstOrFail();
    $this->now = Carbon::parse('2026-10-01 12:00:00', 'UTC');
    $this->premium = Lesson::whereHas('topic', fn ($q) => $q->where('slug', 'night-trains'))
        ->where('level', 'B1')
        ->firstOrFail();
});

test('no subscription means no premium page, audio, or progress', function () {
    $this->actingAs($this->studentA)->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertForbidden();
    $this->actingAs($this->studentA)->get(route('media.lesson.audio', $this->premium))->assertForbidden();
    $this->actingAs($this->studentA)->post(route('progress.store'), [
        'lesson_id' => $this->premium->id,
        'audio_revision' => $this->premium->audio_revision,
        'position_seconds' => 5,
    ])->assertForbidden();

    // Second student isolated the same way; guests denied everywhere.
    $this->actingAs($this->studentB)->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertForbidden();
    $this->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertForbidden();
    $this->get(route('media.lesson.audio', $this->premium))->assertForbidden();
});

test('pending grants nothing but approval opens every published level', function () {
    $pending = S6Payments::pendingRequest($this, $this->studentA, $this->plan);

    expect(Entitlement::active($this->studentA->fresh(), $this->now))->toBeFalse();
    $this->actingAs($this->studentA)->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertForbidden();
    $this->actingAs($this->studentA)->get(route('media.lesson.audio', $this->premium))->assertForbidden();

    // Approval is the only path that grants access (status must leave the
    // open set first, so the check below uses the approved window).
    ApprovePayment::approve($pending->id, $this->staff, $this->now);
    // Per-request auth resolves a fresh user in production; the in-test
    // actingAs instance would otherwise reuse a cached null relation.
    $this->studentA = $this->studentA->fresh();
    Carbon::setTestNow($this->now);
    try {
        $this->actingAs($this->studentA)->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertOk();
        $this->actingAs($this->studentA)->get(route('media.lesson.audio', $this->premium))->assertOk();
        // The public sample stays open to everyone, including the
        // non-subscribed second student — through the public sample
        // experience (paid-only slice: learner URLs redirect there).
        $sampleRedirect = $this->actingAs($this->studentB)
            ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
            ->assertRedirect(route('sample', ['topic' => 'city-park', 'level' => 'A2']));
        $this->followRedirects($sampleRedirect)->assertOk();
        $this->actingAs($this->studentB)->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertForbidden();
    } finally {
        Carbon::setTestNow(null);
    }
});

test('expired, revoked, and suspended accounts lose access on the next request', function () {
    $pending = S6Payments::pendingRequest($this, $this->studentA, $this->plan);
    ApprovePayment::approve($pending->id, $this->staff, $this->now);

    // Expired: the day after expiry the same routes refuse.
    Carbon::setTestNow($this->now->copy()->addDays(31));
    try {
        $this->actingAs($this->studentA)->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertForbidden();
        $this->actingAs($this->studentA)->get(route('media.lesson.audio', $this->premium))->assertForbidden();
    } finally {
        Carbon::setTestNow(null);
    }

    // Revoked: access stops even inside the paid window.
    ApprovePayment::revoke($this->studentA->id, $this->staff, 'abuse (TEST)', $this->now->copy()->addDays(2));
    $this->studentA = $this->studentA->fresh();
    Carbon::setTestNow($this->now->copy()->addDays(3));
    try {
        $this->actingAs($this->studentA)->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertForbidden();
    } finally {
        Carbon::setTestNow(null);
    }

    // Suspended: disabled_at stops even an active subscriber; the second
    // student with a fresh grant is unaffected (isolation).
    ApprovePayment::grant($this->studentB->id, $this->staff, 30, 'support (TEST)', $this->now);
    $this->studentB->forceFill(['disabled_at' => $this->now])->save();
    $this->studentB = $this->studentB->fresh();
    Carbon::setTestNow($this->now->copy()->addDays(3));
    try {
        // The public reader route has no session middleware, so suspension
        // denies via policy (403); authenticated routes kill the session
        // and redirect to login (302). Both layers refuse.
        $this->actingAs($this->studentB->fresh())->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertForbidden();
        $this->actingAs($this->studentB->fresh())->get(route('app.account'))->assertRedirect(route('login'));
    } finally {
        Carbon::setTestNow(null);
    }
});

test('staff keeps panel preview while students stay isolated', function () {
    $this->actingAs($this->staff)->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertOk();
    $this->actingAs($this->staff)->get(route('media.lesson.audio', $this->premium))->assertOk();

    // Drafts stay 404 for everyone including staff (publication first).
    $draft = Lesson::where('status', 'draft')->first();
    if ($draft !== null) {
        $this->actingAs($this->staff)->get(route('media.lesson.audio', $draft))->assertNotFound();
    }

    // Unknown request IDs are 404, not 403 leaks (negative path).
    $this->actingAs($this->studentA)->get(route('payments.show', 999999))->assertNotFound();
});
