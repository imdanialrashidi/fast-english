<?php

use App\Models\Lesson;
use App\Support\Reading;
use Tests\Support\ContentFixtures;

// D5 reader preparation (C3): one module owns sentences, paragraphs,
// cue usability, and the glossary allowlist for both the learner reader
// and the public sample. The interface is the test surface.

test('prepared exposes usable cues only on revision + count match', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'd5-reading']);
    $body = 'First short sentence. Second short sentence here.';
    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'body_en' => $body,
        'duration_seconds' => 20,
        'audio_revision' => 1,
        'audio_cues' => [
            ['sentence_index' => 0, 'start_seconds' => 0, 'end_seconds' => 10],
            ['sentence_index' => 1, 'start_seconds' => 10, 'end_seconds' => 20],
        ],
        'audio_cues_revision' => 1,
        'glossary' => [['word' => 'Crowded', 'meaning_fa' => 'شلوغ', 'example_en' => 'The park was crowded.']],
    ]);

    $prepared = Reading::prepared($lesson->fresh());

    expect($prepared['cuesUsable'])->toBeTrue()
        ->and($prepared['sentences'])->toHaveCount(2)
        ->and($prepared['cues'])->toHaveCount(2)
        ->and($prepared['glossary'][0])->toBe(['word' => 'Crowded', 'meaning_fa' => 'شلوغ', 'example_en' => 'The park was crowded.'])
        ->and($prepared['paragraphs'])->not->toBeEmpty();

    // Stale revision: cues ignored, plain reader stays usable.
    $lesson->forceFill(['audio_revision' => 2])->saveQuietly();
    $stale = Reading::prepared($lesson->fresh());

    expect($stale['cuesUsable'])->toBeFalse()
        ->and($stale['cues'])->toBe([])
        ->and($stale['sentences'])->toHaveCount(2);
});

test('glossary match is case-insensitive and null when absent', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'd5-gloss-match']);
    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'body_en' => 'One sentence only.',
        'duration_seconds' => 10,
        'glossary' => [['word' => 'Crowded', 'meaning_fa' => 'شلوغ', 'example_en' => 'The park was crowded.']],
    ]);

    expect(Reading::glossaryMatch($lesson->fresh(), 'crowded')['meaning_fa'])->toBe('شلوغ')
        ->and(Reading::glossaryMatch($lesson->fresh(), 'absent'))->toBeNull();
});
