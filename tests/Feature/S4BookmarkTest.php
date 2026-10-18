<?php

use App\Actions\ApprovePayment;
use App\Models\Bookmark;
use App\Models\Lesson;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S4-4 bookmarks: idempotent toggle, per-user isolation, archived behavior,
// and no access change. Two users, negative path per protected route.

beforeEach(function () {
    $this->topicA = ContentFixtures::publishedTopic(['slug' => 's4-save-a', 'title_en' => 'S4 Save A']);
    $this->topicB = ContentFixtures::publishedTopic(['slug' => 's4-save-b', 'title_en' => 'S4 Save B']);
    Lesson::factory()->for($this->topicA)->create([
        'level' => 'A1', 'status' => 'published', 'published_at' => now(), 'is_public_sample' => true,
    ]);
    Lesson::factory()->for($this->topicB)->create([
        'level' => 'A1', 'status' => 'published', 'published_at' => now(), 'is_public_sample' => true,
    ]);
    // Paid-only slice: bookmark mutations need an active subscription.
    $this->studentA = ContentFixtures::subscribedStudent();
    $this->studentB = ContentFixtures::subscribedStudent();
});

test('concurrent toggles leave one bookmark per user and topic', function () {
    foreach ([1, 2, 3] as $_) {
        $this->actingAs($this->studentA)
            ->postJson(route('bookmarks.store'), ['topic_id' => $this->topicA->id])
            ->assertOk()
            ->assertJsonPath('bookmarked', true);
    }

    expect(
        Bookmark::where('user_id', $this->studentA->id)
            ->where('topic_id', $this->topicA->id)
            ->count()
    )->toBe(1);

    // Destroy is idempotent too: repeat deletes stay gone.
    $this->actingAs($this->studentA)
        ->deleteJson(route('bookmarks.destroy', $this->topicA))
        ->assertOk();
    $this->actingAs($this->studentA)
        ->deleteJson(route('bookmarks.destroy', $this->topicA))
        ->assertOk();

    expect(
        Bookmark::where('user_id', $this->studentA->id)
            ->where('topic_id', $this->topicA->id)
            ->count()
    )->toBe(0);
});

test('the saved page lists only the user own bookmarks', function () {
    $this->actingAs($this->studentA)
        ->postJson(route('bookmarks.store'), ['topic_id' => $this->topicA->id])
        ->assertOk();

    $htmlA = $this->actingAs($this->studentA)
        ->get(route('app.saved'))
        ->assertOk()
        ->getContent();

    expect($htmlA)->toContain('S4 Save A');
    expect($htmlA)->not->toContain('S4 Save B');

    // Public-slice port (ADR-0002): the empty state travels as an empty
    // topics prop (the Persian copy renders client-side).
    $empty = $this->actingAs($this->studentB)
        ->get(route('app.saved'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Saved/Index'));
    expect($empty->inertiaProps()['topics'])->toBe([]);
    expect($empty->getContent())->not->toContain('S4 Save A');
});

test('an archived bookmarked topic disappears from saved while the row persists', function () {
    // Recorded proposal: archived topics vanish from /app/saved (matching
    // the library), the bookmark row persists, republishing restores it.
    $this->actingAs($this->studentA)
        ->postJson(route('bookmarks.store'), ['topic_id' => $this->topicA->id])
        ->assertOk();

    $this->topicA->forceFill(['status' => 'archived'])->save();

    $html = $this->actingAs($this->studentA)
        ->get(route('app.saved'))
        ->assertOk()
        ->getContent();

    expect($html)->not->toContain('S4 Save A');
    expect(
        Bookmark::where('user_id', $this->studentA->id)
            ->where('topic_id', $this->topicA->id)
            ->count()
    )->toBe(1);

    $this->topicA->forceFill(['status' => 'published'])->save();

    $restored = $this->actingAs($this->studentA)
        ->get(route('app.saved'))
        ->assertOk()
        ->getContent();

    expect($restored)->toContain('S4 Save A');
});

test('a bookmark never grants access to premium content', function () {
    $premiumTopic = ContentFixtures::publishedTopic(['slug' => 's4-premium', 'title_en' => 'S4 Premium']);
    $premium = Lesson::factory()->for($premiumTopic)->create([
        'level' => 'B1', 'status' => 'published', 'published_at' => now(), 'is_public_sample' => false,
    ]);

    $this->actingAs($this->studentA)
        ->postJson(route('bookmarks.store'), ['topic_id' => $premiumTopic->id])
        ->assertOk();

    // Paid-only slice: access comes from the subscription, never the
    // bookmark row. Revoking the subscription denies the premium body
    // and audio while the bookmark row persists.
    $staff = ContentFixtures::staff();
    ApprovePayment::revoke($this->studentA->id, $staff, 'abuse (TEST)');
    $this->studentA = $this->studentA->fresh();

    $this->actingAs($this->studentA)
        ->get(route('reader.show', ['topic' => 's4-premium', 'level' => 'B1']))
        ->assertForbidden();
    $this->actingAs($this->studentA)
        ->get(route('media.lesson.audio', $premium))
        ->assertForbidden();
    expect(Bookmark::where('user_id', $this->studentA->id)->count())->toBe(1);
});

test('guests cannot save or list bookmarks', function () {
    $this->postJson(route('bookmarks.store'), ['topic_id' => $this->topicA->id])
        ->assertUnauthorized();
    $this->get(route('app.saved'))->assertRedirect();
});
