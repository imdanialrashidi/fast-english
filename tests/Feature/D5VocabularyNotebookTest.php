<?php

use App\Models\Lesson;
use App\Models\VocabularyWord;
use App\Support\PlacementLevel;
use App\Support\Vocabulary;
use Illuminate\Validation\ValidationException;
use Tests\Support\ContentFixtures;

// D5 vocabulary notebook (C4) + placement bands (C2 follow-up): the
// write paths own dedup, guards, prefill, and scheduling behind one
// seam. The interface is the test surface.

test('save dedups case-insensitively and reuses the glossary', function () {
    $student = ContentFixtures::subscribedStudent();
    $topic = ContentFixtures::publishedTopic(['slug' => 'd5-vocab']);
    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'body_en' => 'The park was crowded.',
        'duration_seconds' => 10,
        'glossary' => [['word' => 'Crowded', 'meaning_fa' => 'شلوغ', 'example_en' => 'The park was crowded.']],
    ]);

    $first = Vocabulary::save($student, 'Crowded', null, null, $lesson->fresh(), now());

    expect($first['created'])->toBeTrue()
        ->and($first['entry']->meaning_fa)->toBe('شلوغ')
        ->and($first['entry']->example_en)->toBe('The park was crowded.')
        ->and($first['entry']->word_key)->toBe('crowded');

    $second = Vocabulary::save($student, 'crowded', null, null, $lesson->fresh(), now());

    expect($second['created'])->toBeFalse()
        ->and($second['existingId'])->toBe($first['entry']->id)
        ->and(VocabularyWord::where('user_id', $student->id)->count())->toBe(1);
});

test('grade reschedules and refuses non-learning words', function () {
    $student = ContentFixtures::subscribedStudent();
    $saved = Vocabulary::save($student, 'fresh', 'تازه', null, null, now());
    $entry = $saved['entry'];

    $graded = Vocabulary::grade($student, $entry->fresh(), 'good', now());

    // First good review: 1-day interval, one repetition (R4 contract).
    expect($graded['entry']->interval_days)->toBe(1)
        ->and($graded['entry']->repetitions)->toBe(1);

    $graded['entry']->forceFill(['status' => 'known'])->save();
    try {
        Vocabulary::grade($student, $graded['entry']->fresh(), 'good', now());
        $this->fail('Grading a known word should refuse.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('word');
    }
});

test('note updates touch only sent keys and reset first review', function () {
    $student = ContentFixtures::subscribedStudent();
    $saved = Vocabulary::save($student, 'bright', 'روشن', null, null, now());
    $entry = $saved['entry']->fresh();

    $patch = Vocabulary::noteUpdates($entry, true, 'خیلی روشن', false, null, null, now());

    expect($patch)->toBe(['meaning_fa' => 'خیلی روشن']);

    $reset = Vocabulary::noteUpdates($entry, false, null, false, null, 'learning', now());

    expect($reset['due_at'])->not->toBeNull();
});

test('placement bands and fixture map agree on every score', function () {
    $map = PlacementLevel::fixtureMap();

    expect($map)->toBe([
        'A1' => [0, 3],
        'A2' => [4, 7],
        'B1' => [8, 11],
        'B2' => [12, 15],
        'C1' => [16, 18],
        'C2' => [19, 20],
    ]);

    foreach (range(0, 20) as $score) {
        $level = PlacementLevel::forScore($score);
        [$floor, $ceiling] = $map[$level];
        expect($score >= $floor && $score <= $ceiling)->toBeTrue("score {$score} maps to {$level} [{$floor},{$ceiling}]");
    }
});
