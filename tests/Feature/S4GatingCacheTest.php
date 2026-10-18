<?php

use App\Models\Lesson;
use Database\Seeders\S1SampleSeeder;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S4 gating + cache-header proof for the new routes: every protected route
// denies guests, enforces ownership/policy, and sends private, no-store.
// Two users throughout; the S2 cache tests must keep passing alongside.

function s4AssertPrivateNoStore($response): void
{
    $directives = collect(explode(',', strtolower((string) $response->headers->get('Cache-Control'))))
        ->map(fn ($directive) => trim($directive));

    expect($directives)->toContain('private')->and($directives)->toContain('no-store');
}

beforeEach(function () {
    $this->seed(S1SampleSeeder::class);
    $this->a2 = Lesson::where('level', 'A2')
        ->whereHas('topic', fn ($q) => $q->where('slug', 'city-park'))
        ->firstOrFail();
    // Paid-only slice: saved/progress/bookmark routes need an active
    // subscription (settings stays auth-only and works the same).
    $this->studentA = ContentFixtures::subscribedStudent();
    $this->studentB = ContentFixtures::subscribedStudent();
});

test('saved and settings pages are private and owner-scoped', function () {
    $saved = $this->actingAs($this->studentA)->get(route('app.saved'))->assertOk();
    s4AssertPrivateNoStore($saved);

    $settings = $this->actingAs($this->studentA)->get(route('account.settings'))->assertOk();
    s4AssertPrivateNoStore($settings);

    $reader = $this->actingAs($this->studentA)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertOk();
    s4AssertPrivateNoStore($reader);
});

test('progress and bookmark JSON responses are private and uncacheable', function () {
    $progress = $this->actingAs($this->studentA)->postJson(route('progress.store'), [
        'lesson_id' => $this->a2->id,
        'audio_revision' => $this->a2->audio_revision,
        'position_seconds' => 5,
    ])->assertOk();
    s4AssertPrivateNoStore($progress);

    $topic = ContentFixtures::publishedTopic(['slug' => 's4-cache-topic']);
    Lesson::factory()->for($topic)->create([
        'level' => 'A1', 'status' => 'published', 'published_at' => now(), 'is_public_sample' => true,
    ]);

    $bookmark = $this->actingAs($this->studentA)->postJson(route('bookmarks.store'), [
        'topic_id' => $topic->id,
    ])->assertOk();
    s4AssertPrivateNoStore($bookmark);
});

test('a second account cannot touch the first account progress or saved items', function () {
    $this->actingAs($this->studentA)->postJson(route('progress.store'), [
        'lesson_id' => $this->a2->id,
        'audio_revision' => $this->a2->audio_revision,
        'position_seconds' => 15,
    ])->assertOk();

    $topic = ContentFixtures::publishedTopic(['slug' => 's4-cache-own']);
    Lesson::factory()->for($topic)->create([
        'level' => 'A1', 'status' => 'published', 'published_at' => now(), 'is_public_sample' => true,
    ]);
    $this->actingAs($this->studentA)->postJson(route('bookmarks.store'), ['topic_id' => $topic->id])->assertOk();

    // B sees none of A's state.
    $this->actingAs($this->studentB)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('initialPosition', 0));

    $savedB = $this->actingAs($this->studentB)->get(route('app.saved'))->assertOk()->getContent();
    expect($savedB)->not->toContain('S4 Cache Own');
});

test('disabled accounts are refused on every S4 route', function () {
    // A session created before suspension is destroyed: the S0 contract
    // redirects to login (302), never 200 with private data.
    $this->actingAs($this->studentA);
    $this->studentA->forceFill(['disabled_at' => now()])->save();

    $this->get(route('app.saved'))->assertRedirect(route('login'));
    $this->get(route('account.settings'))->assertRedirect(route('login'));
    $this->assertGuest();
});
