<?php

use App\Models\Lesson;
use App\Models\LessonProgress;
use Database\Seeders\S1SampleSeeder;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S4-1/S4-2/S4-3 progress: validation, revision isolation, completion.
// Two users, negative path per protected route, real PostgreSQL, no mocks.

beforeEach(function () {
    $this->seed(S1SampleSeeder::class);
    $this->a2 = Lesson::where('level', 'A2')
        ->whereHas('topic', fn ($q) => $q->where('slug', 'city-park'))
        ->firstOrFail();
    // Paid-only slice: progress mutations need an active subscription.
    $this->studentA = ContentFixtures::subscribedStudent();
    $this->studentB = ContentFixtures::subscribedStudent();
});

test('a logged-in student saves and resumes position, nothing auto-plays', function () {
    // A 120 s lesson so the 40 s acceptance position fits the server
    // duration (the S1 A2 tone fixture is 20 s; duration_seconds is the
    // server truth, not the fixture byte length).
    $topic = ContentFixtures::publishedTopic(['slug' => 's4-resume', 'title_en' => 'S4 Resume']);
    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A1', 'status' => 'published', 'published_at' => now(),
        'is_public_sample' => true, 'duration_seconds' => 120,
    ]);

    $this->actingAs($this->studentA)
        ->postJson(route('progress.store'), [
            'lesson_id' => $lesson->id,
            'audio_revision' => $lesson->audio_revision,
            'position_seconds' => 40,
        ])
        ->assertOk();

    // Refresh: the reader receives the saved position as the
    // initialPosition prop (applied once to the persistent element),
    // the resume notice renders client-side, and nothing auto-plays.
    // M1 port (ADR-0002): data-initial-position travels as a prop.
    $this->actingAs($this->studentA)
        ->get(route('reader.show', ['topic' => 's4-resume', 'level' => 'A1']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Reader/Show')
            ->where('initialPosition', 40));

    $html = $this->actingAs($this->studentA)
        ->get(route('reader.show', ['topic' => 's4-resume', 'level' => 'A1']))
        ->assertOk()
        ->getContent();
    expect($html)->not->toContain('autoplay');
});

test('an anonymous visitor listening is never saved', function () {
    $this->postJson(route('progress.store'), [
        'lesson_id' => $this->a2->id,
        'audio_revision' => $this->a2->audio_revision,
        'position_seconds' => 15,
    ])->assertUnauthorized();

    expect(LessonProgress::count())->toBe(0);
});

test('a different lesson starts at zero', function () {
    $b1 = Lesson::where('level', 'B1')
        ->whereHas('topic', fn ($q) => $q->where('slug', 'city-park'))
        ->firstOrFail();

    $this->actingAs($this->studentA)
        ->postJson(route('progress.store'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
            'position_seconds' => 15,
        ])
        ->assertOk();

    $this->actingAs($this->studentA)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'B1']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('initialPosition', 0));
});

test('a stale-revision save is rejected and old progress is not applied', function () {
    $this->actingAs($this->studentA)
        ->postJson(route('progress.store'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
            'position_seconds' => 15,
        ])
        ->assertOk();

    // Replace the audio file: revision increments (model hook).
    $this->a2->audio_path = 'lessons/s1-replaced-a2.mp3';
    copy(
        database_path('seeders/fixtures/s1-b1-tone-fixture.mp3'),
        Storage::disk('local')->path('lessons/s1-replaced-a2.mp3')
    );
    $this->a2->save();
    $this->a2->refresh();
    expect((int) $this->a2->audio_revision)->toBe(2);

    // Stale save rejected with the current position (zero for the new rev).
    $stale = $this->actingAs($this->studentA)
        ->postJson(route('progress.store'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => 1,
            'position_seconds' => 18,
        ]);
    $stale->assertStatus(409);
    expect($stale->json('current_revision'))->toBe(2);
    expect((float) $stale->json('position_seconds'))->toBe(0.0);

    // Refresh shows zero for the new revision.
    $this->actingAs($this->studentA)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('initialPosition', 0));
});

test('two users never see each other progress', function () {
    $this->actingAs($this->studentA)
        ->postJson(route('progress.store'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
            'position_seconds' => 15,
        ])
        ->assertOk();

    $this->actingAs($this->studentB)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('initialPosition', 0));
    expect(LessonProgress::where('user_id', $this->studentB->id)->count())->toBe(0);
});

test('position outside the server duration is refused', function () {
    // duration is 20 s for the A2 fixture; the client duration is ignored.
    $this->actingAs($this->studentA)
        ->postJson(route('progress.store'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
            'position_seconds' => 999,
        ])
        ->assertStatus(422);

    $this->actingAs($this->studentA)
        ->postJson(route('progress.store'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
            'position_seconds' => -5,
        ])
        ->assertStatus(422);

    expect(LessonProgress::count())->toBe(0);
});

test('concurrent saves never create duplicate rows', function () {
    foreach ([10, 12, 14] as $position) {
        $this->actingAs($this->studentA)
            ->postJson(route('progress.store'), [
                'lesson_id' => $this->a2->id,
                'audio_revision' => $this->a2->audio_revision,
                'position_seconds' => $position,
            ])
            ->assertOk();
    }

    expect(
        LessonProgress::where('user_id', $this->studentA->id)
            ->where('lesson_id', $this->a2->id)
            ->count()
    )->toBe(1);
});
