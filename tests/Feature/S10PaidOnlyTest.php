<?php

use App\Actions\ApprovePayment;
use App\Models\Bookmark;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\PlacementAttempt;
use App\Models\Plan;
use App\Models\VocabularyWord;
use Carbon\Carbon;
use Database\Seeders\S1SampleSeeder;
use Database\Seeders\S5PaymentFixtureSeeder;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;
use Tests\Support\S6Payments;

// S10 paid-only learner gate (owner requirement): every learner-app route
// and learner mutation recomputes an active subscription per request.
// States × routes: no subscription, pending, expired, and revoked lose
// premium learner functionality; active subscribers and staff keep it;
// disabled accounts stay blocked by the account-security contract. The
// designated public sample stays open through the public experience only;
// learner URLs resolving to it redirect there. Denied responses carry no
// premium content, answers, vocabulary, or usable media URLs.

beforeEach(function () {
    $this->seed(S1SampleSeeder::class);
    $this->seed(S5PaymentFixtureSeeder::class);
    $this->plan = Plan::where('slug', 's5-test-30')->firstOrFail();
    $this->now = Carbon::parse('2026-10-01 12:00:00', 'UTC');
    $this->premium = Lesson::whereHas('topic', fn ($q) => $q->where('slug', 'night-trains'))
        ->where('level', 'B1')
        ->firstOrFail();
    $this->noSub = ContentFixtures::student();
    $this->staff = ContentFixtures::staff();
});

test('guests reach login for learner pages and the locked state for premium content', function () {
    // Session learner pages bounce to login (auth layer, unchanged).
    $this->get(route('app.home'))->assertRedirect(route('login'));
    $this->get(route('today.index'))->assertRedirect(route('login'));
    $this->get(route('placement.index'))->assertRedirect(route('login'));

    // The premium reader resolves without a session, so it renders the
    // locked state directly: 403, guest CTA, no premium body.
    $this->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))
        ->assertForbidden()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Locked/Index'))
        ->assertDontSee('The night train left the station');

    // Guest mutations are refused by the auth layer before the gate.
    $this->postJson(route('progress.store'), [
        'lesson_id' => $this->premium->id,
        'audio_revision' => $this->premium->audio_revision,
        'position_seconds' => 5,
    ])->assertUnauthorized();
    expect(LessonProgress::count())->toBe(0);
});

test('learners without a subscription can see the shell but no lesson content', function () {
    // Owner instruction 2026-11-25: the environment and its sections are
    // visible with lock states; the lesson body, transcript, glossary and
    // audio stay closed until the monthly subscription is active.
    foreach (['app.home', 'today.index', 'books.index'] as $route) {
        $this->actingAs($this->noSub)->get(route($route))->assertOk();
    }

    foreach (['app.saved', 'words.index', 'words.review', 'placement.index'] as $route) {
        $this->actingAs($this->noSub)->get(route($route))
            ->assertForbidden()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Locked/Index')
                ->where('subscribeUrl', route('subscribe.index'))
                ->missing('sampleUrl'));
    }

    $this->actingAs($this->noSub)->get(route('today.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Today/Index')
            ->has('plan.tasks'));
    $html = $this->actingAs($this->noSub)->get(route('today.index'))->getContent();
    expect($html)->not->toContain('The night train left the station');
});

test('pending, expired, and revoked learners lose learner functionality', function () {
    // Pending grants nothing.
    $pendingUser = ContentFixtures::student();
    S6Payments::pendingRequest($this, $pendingUser, $this->plan);
    $this->actingAs($pendingUser)->get(route('today.index'))->assertOk();
    $this->actingAs($pendingUser)->postJson(route('progress.store'), [
        'lesson_id' => $this->premium->id,
        'audio_revision' => $this->premium->audio_revision,
        'position_seconds' => 5,
    ])->assertForbidden();
    expect(LessonProgress::count())->toBe(0);

    // Expired: the day after expiry the same requests refuse.
    $expiredUser = ContentFixtures::student();
    $request = S6Payments::pendingRequest($this, $expiredUser, $this->plan);
    ApprovePayment::approve($request->id, $this->staff, $this->now);
    $expiredUser = $expiredUser->fresh();
    Carbon::setTestNow($this->now->copy()->addDays(31));
    try {
        $this->actingAs($expiredUser)->get(route('today.index'))->assertOk();
        $this->actingAs($expiredUser)->get(route('media.lesson.audio', $this->premium))->assertForbidden();
    } finally {
        Carbon::setTestNow(null);
    }

    // Revoked: access stops even inside the paid window.
    $revokedUser = ContentFixtures::student();
    $request = S6Payments::pendingRequest($this, $revokedUser, $this->plan);
    ApprovePayment::approve($request->id, $this->staff, $this->now);
    ApprovePayment::revoke($revokedUser->id, $this->staff, 'abuse (TEST)', $this->now->copy()->addDays(2));
    $revokedUser = $revokedUser->fresh();
    Carbon::setTestNow($this->now->copy()->addDays(3));
    try {
        $this->actingAs($revokedUser)->get(route('today.index'))->assertOk();
        $this->actingAs($revokedUser)->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))->assertForbidden();
    } finally {
        Carbon::setTestNow(null);
    }
});

test('denied learner mutations leave protected state unchanged', function () {
    $this->actingAs($this->noSub)->postJson(route('bookmarks.store'), ['topic_id' => 1])->assertForbidden();
    $this->actingAs($this->noSub)->postJson(route('words.store'), [
        'word' => 'park',
        'meaning_fa' => 'پارک',
    ])->assertForbidden();
    $this->actingAs($this->noSub)->postJson(route('placement.start'), [])->assertForbidden();

    expect(Bookmark::count())->toBe(0)
        ->and(VocabularyWord::count())->toBe(0)
        ->and(PlacementAttempt::count())->toBe(0)
        ->and(LessonProgress::count())->toBe(0);
});

test('disabled accounts stay blocked without leaking learner content', function () {
    $user = ContentFixtures::subscribedStudent();
    $user->forceFill(['disabled_at' => $this->now])->save();

    // Session routes destroy the session and bounce to login (existing
    // account-security contract, unchanged).
    $this->actingAs($user->fresh())->get(route('app.home'))->assertRedirect(route('login'));
    $this->actingAs($user->fresh())->get(route('today.index'))->assertRedirect(route('login'));

    // The sessionless premium reader denies via the locked state.
    $this->actingAs($user->fresh())
        ->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))
        ->assertForbidden()
        ->assertDontSee('The night train left the station');
});

test('active subscribers and staff keep full learner access', function () {
    $active = ContentFixtures::subscribedStudent();

    foreach (['app.home', 'today.index', 'app.saved', 'words.index', 'words.review', 'placement.index'] as $route) {
        $this->actingAs($active)->get(route($route))->assertOk();
    }
    $this->actingAs($active)
        ->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))
        ->assertOk()
        ->assertSee('The night train left the station');
    $this->actingAs($active)->get(route('media.lesson.audio', $this->premium))->assertOk();

    // Eligible mutations persist.
    $this->actingAs($active)->postJson(route('progress.store'), [
        'lesson_id' => $this->premium->id,
        'audio_revision' => $this->premium->audio_revision,
        'position_seconds' => 5,
    ])->assertSuccessful();
    expect(LessonProgress::where('user_id', $active->id)->count())->toBe(1);

    // Staff keeps preview without any subscription.
    $this->actingAs($this->staff)->get(route('app.home'))->assertOk();
    $this->actingAs($this->staff)->get(route('today.index'))->assertOk();
    $this->actingAs($this->staff)
        ->get(route('reader.show', ['topic' => 'night-trains', 'level' => 'B1']))
        ->assertOk();
});

test('no lesson body or lesson audio opens before an active subscription', function () {
    $a2 = Lesson::whereHas('topic', fn ($q) => $q->where('slug', 'city-park'))->where('level', 'A2')->firstOrFail();

    $this->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertForbidden()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Locked/Index'));
    $this->actingAs($this->noSub)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertForbidden()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Locked/Index'));

    $this->get(route('media.lesson.audio', $a2))->assertForbidden();
    $this->actingAs($this->noSub)->get(route('media.lesson.audio', $a2))->assertForbidden();

    // The public sample route is retired.
    $this->get('/sample')->assertNotFound();
});

test('an eligible subscriber keeps the learner reader for a flagged sample lesson', function () {
    $active = ContentFixtures::subscribedStudent();
    $this->actingAs($active)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Reader/Show'));
});

test('public pages and checkout stay reachable without a subscription', function () {
    // Marketing, auth, status, and checkout pages keep their existing
    // authorization: reachable, never a learner-content backdoor.
    $this->get(route('landing'))->assertOk();
    $this->get(route('trust.faq'))->assertOk();
    $this->get(route('download'))->assertOk();
    $this->get(route('login'))->assertOk();
    $this->get(route('register'))->assertOk();

    $this->actingAs($this->noSub)->get(route('app.account'))->assertOk();
    $this->actingAs($this->noSub)->get(route('subscribe.index'))->assertOk();

    // Status pages carry no lesson content.
    $html = $this->actingAs($this->noSub)->get(route('app.account'))->getContent();
    expect($html)->not->toContain('The night train left the station')
        ->and($html)->not->toContain('On Saturday morning, Sara walks');
});

test('public pages render public components with no premium props', function () {
    // HTTP observes components + props (layout binding and the rendered
    // shell are client-side; the DOM separation is proven in the
    // browser spec). No premium body, glossary, or audio URL may travel
    // with a public response.
    $this->get(route('landing'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Landing/Index'));
    $this->get(route('trust.faq'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('Trust/Show'));

    foreach ([$this->get(route('landing'))->getContent()] as $html) {
        expect($html)->not->toContain('The night train left the station')
            ->and($html)->not->toContain('body_en');
    }
});
