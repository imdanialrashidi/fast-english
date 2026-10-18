<?php

use App\Models\Lesson;
use App\Models\LessonProgress;
use Database\Seeders\S1SampleSeeder;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S4-3 completion: ended or explicit action marks completion; seeking to
// the end does not (client rule, server never completes on save). Completion
// survives pause, resets only on explicit reset, and never inherits across
// revisions.

beforeEach(function () {
    $this->seed(S1SampleSeeder::class);
    $this->a2 = Lesson::where('level', 'A2')
        ->whereHas('topic', fn ($q) => $q->where('slug', 'city-park'))
        ->firstOrFail();
    // Paid-only slice: progress mutations need an active subscription.
    $this->student = ContentFixtures::subscribedStudent();
    ContentFixtures::student();
});

test('explicit complete marks the lesson and survives a later pause-save', function () {
    $this->actingAs($this->student)
        ->postJson(route('progress.store'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
            'position_seconds' => 10,
        ])
        ->assertOk();

    $this->actingAs($this->student)
        ->postJson(route('progress.complete'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
        ])
        ->assertOk()
        ->assertJsonStructure(['completed_at']);

    // A later pause-save does not clear completion.
    $this->actingAs($this->student)
        ->postJson(route('progress.store'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
            'position_seconds' => 12,
        ])
        ->assertOk();

    $progress = LessonProgress::where('user_id', $this->student->id)
        ->where('lesson_id', $this->a2->id)
        ->firstOrFail();

    expect($progress->completed_at)->not->toBeNull();

    // M1 port: the completion note renders client-side from this prop.
    $this->actingAs($this->student)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('completed', true));
});

test('saving at the end position does not complete the lesson', function () {
    $this->actingAs($this->student)
        ->postJson(route('progress.store'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
            'position_seconds' => 20,
        ])
        ->assertOk();

    $progress = LessonProgress::where('user_id', $this->student->id)
        ->where('lesson_id', $this->a2->id)
        ->firstOrFail();

    expect($progress->completed_at)->toBeNull();
});

test('completion resets only on explicit reset', function () {
    $this->actingAs($this->student)
        ->postJson(route('progress.complete'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
        ])
        ->assertOk();

    $this->actingAs($this->student)
        ->postJson(route('progress.reset'), ['lesson_id' => $this->a2->id])
        ->assertOk()
        ->assertJsonPath('completed_at', null);

    $progress = LessonProgress::where('user_id', $this->student->id)
        ->where('lesson_id', $this->a2->id)
        ->firstOrFail();

    expect($progress->completed_at)->toBeNull();
});

test('a new audio revision does not inherit the old completion', function () {
    $this->actingAs($this->student)
        ->postJson(route('progress.complete'), [
            'lesson_id' => $this->a2->id,
            'audio_revision' => $this->a2->audio_revision,
        ])
        ->assertOk();

    $this->a2->audio_path = 'lessons/s1-replaced-complete.mp3';
    copy(
        database_path('seeders/fixtures/s1-b1-tone-fixture.mp3'),
        Storage::disk('local')->path('lessons/s1-replaced-complete.mp3')
    );
    $this->a2->save();
    $this->a2->refresh();

    $this->actingAs($this->student)
        ->get(route('reader.show', ['topic' => 'city-park', 'level' => 'A2']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('completed', false)
            ->where('initialPosition', 0));
});
