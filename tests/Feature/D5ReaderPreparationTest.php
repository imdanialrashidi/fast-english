<?php

use App\Models\Lesson;
use App\Support\Reading;
use Tests\Support\ContentFixtures;

// D5 reader preparation (C3): one module owns the paragraph split and the
// glossary allowlist for both the learner reader and the public sample.
// The interface is the test surface.

test('prepared exposes plain paragraphs and the glossary allowlist', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'd5-reading']);
    $body = "First short sentence. Second short sentence here.\n\nA second paragraph follows.";
    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'body_en' => $body,
        'duration_seconds' => 20,
        'audio_revision' => 1,
        'glossary' => [['word' => 'Crowded', 'meaning_fa' => 'شلوغ', 'example_en' => 'The park was crowded.']],
    ]);

    $prepared = Reading::prepared($lesson->fresh());

    expect(array_keys($prepared))->toBe(['paragraphs', 'glossary'])
        ->and($prepared['paragraphs'])->toBe([
            'First short sentence. Second short sentence here.',
            'A second paragraph follows.',
        ])
        ->and($prepared['glossary'][0])->toBe(['word' => 'Crowded', 'meaning_fa' => 'شلوغ', 'example_en' => 'The park was crowded.'])
        ->and($prepared)->not->toHaveKey('cues')
        ->and($prepared)->not->toHaveKey('sentences');
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
