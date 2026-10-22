<?php

use App\Models\Category;
use App\Models\Lesson;
use App\Models\Topic;
use App\Support\Levels;
use App\Support\ReadingPayload;
use App\Support\TopicCard;
use Tests\Support\ContentFixtures;

// D5 payload seams: the topic card and reading payload are the test
// surface for the four card call sites and the two reading pages. The
// tests assert the allowlisted keys and the derived values directly, so
// a page cannot drift field-by-field without failing here.

test('topic card owns one allowlisted shape across the four pages', function () {
    $category = Category::factory()->create(['name_fa' => 'دسته آزمون', 'slug' => 'd5-card-cat']);
    $topic = Topic::factory()->for($category)->create([
        'slug' => 'd5-card',
        'title_en' => 'D5 Card',
        'status' => 'published',
        'published_at' => now(),
    ]);

    foreach ([['B1', 4], ['A2', 6]] as [$level, $minutes]) {
        Lesson::factory()->for($topic)->create([
            'level' => $level,
            'status' => 'published',
            'published_at' => now(),
            'estimated_minutes' => $minutes,
        ]);
    }

    $topic->load([
        'category',
        'lessons' => fn ($query) => $query
            ->where('status', 'published')
            ->orderByRaw(Levels::orderExpression())
            ->select(['id', 'topic_id', 'level', 'estimated_minutes']),
    ]);

    $card = TopicCard::for($topic);

    expect(array_keys($card))->toBe([
        'slug',
        'title_en',
        'cover_url',
        'category_name',
        'levels',
        'first_level',
        'extra_levels',
        'minutes',
        'reader_url',
    ]);

    expect($card['levels'])->toBe(['A2', 'B1'])
        ->and($card['first_level'])->toBe('A2')
        ->and($card['extra_levels'])->toBe(1)
        ->and($card['minutes'])->toBe(10)
        ->and($card['category_name'])->toBe('دسته آزمون')
        ->and($card['reader_url'])->toBe(route('reader.show', $topic))
        ->and($card)->not->toHaveKey('body_en')
        ->and($card)->not->toHaveKey('glossary');
});

test('reading payload owns the reader and sample fields and the preview slice', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'd5-reading', 'title_en' => 'D5 Reading']);
    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
        'body_en' => 'One two. Three four!',
        'glossary' => [['word' => 'one', 'meaning_fa' => 'یک', 'example_en' => null]],
        'audio_revision' => 7,
        'duration_seconds' => 10,
    ]);
    $lesson->load('topic');

    $payload = ReadingPayload::for($lesson);

    expect(array_keys($payload))->toBe([
        'topic',
        'lesson',
        'paragraphs',
        'glossary',
    ]);

    expect(array_keys($payload['topic']))->toBe(['id', 'slug', 'title_en', 'summary_public', 'cover_url'])
        ->and(array_keys($payload['lesson']))->toBe([
            'id',
            'title_en',
            'level',
            'estimated_minutes',
            'duration_seconds',
            'audio_revision',
            'audio_url',
        ])
        ->and($payload['paragraphs'])->toBe(['One two. Three four!'])
        ->and($payload['lesson']['audio_url'])->toBe(route('media.lesson.audio', $lesson))
        ->and($payload)->not->toHaveKey('body_en')
        ->and($payload)->not->toHaveKey('cues');

    $preview = ReadingPayload::preview($lesson);

    expect($preview['sample']['reader_url'])->toBe(route('sample', ['topic' => $topic->slug, 'level' => 'A2']))
        ->and($preview['sampleParagraphs'])->toBe(['One two. Three four!'])
        ->and($preview['sampleAudioUrl'])->toBe(route('media.lesson.audio', $lesson))
        ->and($preview)->not->toHaveKey('sampleSentences')
        ->and($preview)->not->toHaveKey('sampleCues');

    expect(ReadingPayload::preview(null))->toBe([
        'sample' => null,
        'sampleParagraphs' => [],
        'sampleAudioUrl' => null,
    ]);
});
