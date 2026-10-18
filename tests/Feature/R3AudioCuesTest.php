<?php

use App\Models\Lesson;
use App\Support\AudioCues;
use App\Support\Sentences;
use Database\Seeders\S1SampleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// R3 sentence cues (READ-03, AC-24): real validated timing data drives the
// synced reader; missing or stale cues keep a usable plain reader.

test('valid cues pass and empty input normalizes to an empty list', function () {
    expect(AudioCues::validate(null, 20))->toBe([]);
    expect(AudioCues::validate([], 20))->toBe([]);

    $cues = AudioCues::validate([
        ['sentence_index' => 0, 'start_seconds' => 0, 'end_seconds' => 9.5],
        ['sentence_index' => 1, 'start_seconds' => 9.5, 'end_seconds' => 20],
    ], 20);

    expect($cues)->toHaveCount(2);
    expect($cues[0])->toBe(['sentence_index' => 0, 'start_seconds' => 0.0, 'end_seconds' => 9.5]);
});

test('overlapping, out-of-range, and non-contiguous cues are refused', function () {
    // Overlap.
    try {
        AudioCues::validate([
            ['sentence_index' => 0, 'start_seconds' => 0, 'end_seconds' => 12],
            ['sentence_index' => 1, 'start_seconds' => 10, 'end_seconds' => 20],
        ], 20);
        $this->fail('Overlapping cues were accepted.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('audio_cues');
    }

    // End beyond the measured duration.
    try {
        AudioCues::validate([
            ['sentence_index' => 0, 'start_seconds' => 0, 'end_seconds' => 25],
        ], 20);
        $this->fail('Out-of-range cues were accepted.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('audio_cues.0.end_seconds');
    }

    // Gap in sentence numbering.
    try {
        AudioCues::validate([
            ['sentence_index' => 0, 'start_seconds' => 0, 'end_seconds' => 10],
            ['sentence_index' => 2, 'start_seconds' => 10, 'end_seconds' => 20],
        ], 20);
        $this->fail('Non-contiguous cues were accepted.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('audio_cues');
    }
});

test('the reader exposes cues only for the current audio revision', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'r3-cues']);
    $body = 'First short sentence. Second short sentence here.';
    $sentences = Sentences::split($body);
    expect($sentences)->toHaveCount(2);

    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
        'body_en' => $body,
        'duration_seconds' => 20,
        'audio_revision' => 1,
        'audio_cues' => [
            ['sentence_index' => 0, 'start_seconds' => 0, 'end_seconds' => 10],
            ['sentence_index' => 1, 'start_seconds' => 10, 'end_seconds' => 20],
        ],
        'audio_cues_revision' => 1,
    ]);

    // Bypass the model hook to simulate cues timed against an older
    // revision: the reader must ignore them.
    DB::table('lessons')->where('id', $lesson->id)->update(['audio_revision' => 2]);

    // Paid-only slice: the flagged lesson resolves through the public
    // sample experience; cue props travel with it unchanged.
    $staleRedirect = $this->get(route('reader.show', ['topic' => 'r3-cues', 'level' => 'A2']))->assertRedirect();
    $stale = $this->followRedirects($staleRedirect)->assertOk();
    // M1 port: the fallback notice renders client-side (proven in the
    // browser journey); HTTP asserts the empty cue set on decoded props.
    $stale->assertInertia(fn (AssertableInertia $page) => $page
        ->component('Sample/Show')
        ->where('cuesUsable', false)
        ->where('cues', []));

    DB::table('lessons')->where('id', $lesson->id)->update(['audio_revision' => 1]);

    $syncedRedirect = $this->get(route('reader.show', ['topic' => 'r3-cues', 'level' => 'A2']))->assertRedirect();
    $synced = $this->followRedirects($syncedRedirect)->assertOk();
    $synced->assertInertia(fn (AssertableInertia $page) => $page
        ->where('cuesUsable', true)
        ->where('cues.0.start_seconds', 0)
        ->where('cues.1.end_seconds', 20));
});

test('cue count must match the reader sentence split while cues are edited', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'r3-count']);
    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
        'body_en' => 'One sentence only.',
        'duration_seconds' => 20,
    ]);

    try {
        $lesson->forceFill([
            'audio_cues' => [
                ['sentence_index' => 0, 'start_seconds' => 0, 'end_seconds' => 10],
                ['sentence_index' => 1, 'start_seconds' => 10, 'end_seconds' => 20],
            ],
        ])->save();
        $this->fail('Mismatched cue count was accepted.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('audio_cues');
    }
    $lesson->refresh();

    // A plain typo fix without touching cues is never blocked.
    $lesson->forceFill(['title_en' => 'Fixed Title'])->save();
    expect($lesson->fresh()->title_en)->toBe('Fixed Title');
});

test('the seeded sample carries fixture cues for the browser lane', function () {
    $this->seed(S1SampleSeeder::class);

    $lesson = Lesson::query()
        ->whereHas('topic', fn ($topics) => $topics->where('slug', 'city-park'))
        ->where('level', 'A2')
        ->firstOrFail();

    expect($lesson->audio_cues)->not->toBeNull();
    expect(count($lesson->audio_cues))->toBe(count(Sentences::split($lesson->body_en)));
    expect((int) $lesson->audio_cues_revision)->toBe((int) $lesson->audio_revision);
});
