<?php

use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\VocabularyWord;
use Illuminate\Support\Facades\DB;
use Tests\Support\ContentFixtures;

// PLAN-004 query budgets: each page pins a constant app-query count as its
// data grows (siblings 2->6, completions/words scale up, notebook 5->50).
// Session noise is filtered: the SESSION_DRIVER=database lane logs session
// select/insert/update rows that differ between first and second requests
// on the same connection regardless of app queries (seen on the S3 lane:
// 9 vs 8 for identical app work), so the budgets below count only
// non-session statements.

function p004AppQueries(): array
{
    return array_values(array_filter(
        DB::getQueryLog(),
        fn ($entry) => ! str_contains((string) $entry['query'], '"sessions"')
    ));
}

test('the reader query count stays constant as sibling lessons grow', function () {
    $topic = ContentFixtures::publishedTopic(['slug' => 'p004-reader', 'title_en' => 'P004 Reader']);
    foreach (['A1', 'A2'] as $level) {
        Lesson::factory()->for($topic)->create([
            'level' => $level, 'status' => 'published', 'published_at' => now(),
            'is_public_sample' => ($level === 'A1'),
        ]);
    }
    $this->actingAs(ContentFixtures::subscribedStudent());

    DB::enableQueryLog();
    DB::flushQueryLog();
    $this->get(route('reader.show', ['topic' => $topic->slug, 'level' => 'A1']))->assertOk();
    $small = p004AppQueries();

    foreach (['B1', 'B2', 'C1', 'C2'] as $level) {
        Lesson::factory()->for($topic)->create([
            'level' => $level, 'status' => 'published', 'published_at' => now(),
            'is_public_sample' => false,
        ]);
    }

    DB::flushQueryLog();
    $this->get(route('reader.show', ['topic' => $topic->slug, 'level' => 'A1']))->assertOk();
    $large = p004AppQueries();
    DB::disableQueryLog();

    // Fixed: a levels pluck plus the single column-scoped lesson row, so
    // siblings 2 -> 6 change nothing. Fixed app queries: 8 (7 core + the
    // constant shared due-words badge query added 2026-10-25).
    expect($large)->toHaveCount(count($small))->and($small)->toHaveCount(8);
});

test('today stays constant as words and completed lessons grow', function () {
    $student = ContentFixtures::subscribedStudent();
    // One lesson per topic: lessons carry unique (topic_id, level).
    $mkLesson = function (string $prefix, string $suffix) {
        $topic = ContentFixtures::publishedTopic(['slug' => "p004-today-{$prefix}-{$suffix}", 'title_en' => "P004 Today {$suffix}"]);

        return Lesson::factory()->for($topic)->create([
            'level' => 'A2', 'status' => 'published', 'published_at' => now(),
            'is_public_sample' => true, 'estimated_minutes' => 4,
            'title_en' => "P004 Lesson {$suffix}",
        ]);
    };
    $first = $mkLesson('a', 'first');
    LessonProgress::create([
        'user_id' => $student->id, 'lesson_id' => $first->id,
        'audio_revision' => $first->audio_revision, 'position_seconds' => 5,
        'started_at' => now()->subHour(), 'completed_at' => now(),
    ]);
    VocabularyWord::factory()->for($student)->create(['word' => 'p004one', 'due_at' => now()->subDay()]);
    $this->actingAs($student);

    DB::enableQueryLog();
    DB::flushQueryLog();
    $this->get(route('today.index'))->assertOk();
    $small = p004AppQueries();

    foreach (['second', 'third', 'fourth'] as $suffix) {
        $extra = $mkLesson('b', $suffix);
        LessonProgress::create([
            'user_id' => $student->id, 'lesson_id' => $extra->id,
            'audio_revision' => $extra->audio_revision, 'position_seconds' => 5,
            'started_at' => now()->subHour(), 'completed_at' => now(),
        ]);
    }
    for ($i = 1; $i <= 6; $i++) {
        VocabularyWord::factory()->for($student)->create(['word' => "p004bulk{$i}", 'due_at' => now()->subDay()]);
    }

    DB::flushQueryLog();
    $response = $this->get(route('today.index'))->assertOk();
    $large = p004AppQueries();
    DB::disableQueryLog();

    // Fixed: recommendations() reuses build()'s eligibility (the fresh
    // user + subscription lookup is paid once per request) and learned
    // minutes come from one joined sum — neither moves as completions
    // (1 -> 4) or words (1 -> 7) grow. Four completions at 4 minutes
    // each; no word was reviewed today, so the review bonus is 0.
    // Pre-fix ran 17 app queries; fixed: 15 (14 core + the constant shared
    // due-words badge query added 2026-10-25).
    expect($large)->toHaveCount(count($small))->and($small)->toHaveCount(15);
    expect($response->inertiaProps()['plan']['learned_minutes'])->toBe(16);
});

test('the words index stays constant as the notebook grows', function () {
    $student = ContentFixtures::subscribedStudent();
    $topic = ContentFixtures::publishedTopic(['slug' => 'p004-words', 'title_en' => 'P004 Words']);
    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A2', 'status' => 'published', 'published_at' => now(),
        'is_public_sample' => true,
    ]);
    for ($i = 1; $i <= 5; $i++) {
        VocabularyWord::factory()->for($student)->create([
            'word' => "p004w{$i}", 'due_at' => now()->subDay(),
            'lesson_id' => $lesson->id, 'topic_id' => $topic->id,
            'status' => $i <= 3 ? 'learning' : 'known',
        ]);
    }
    $this->actingAs($student);

    DB::enableQueryLog();
    DB::flushQueryLog();
    $smallResponse = $this->get(route('words.index'))->assertOk();
    $small = p004AppQueries();

    for ($i = 6; $i <= 50; $i++) {
        VocabularyWord::factory()->for($student)->create([
            'word' => "p004w{$i}", 'due_at' => now()->subDay(),
            'lesson_id' => $lesson->id, 'topic_id' => $topic->id,
            'status' => $i % 2 === 0 ? 'learning' : 'known',
        ]);
    }

    DB::flushQueryLog();
    $largeResponse = $this->get(route('words.index'))->assertOk();
    $large = p004AppQueries();
    DB::disableQueryLog();

    // Fixed: the word page + total + two constrained eagers + one grouped
    // count row — constant at any notebook size. Pre-fix ran 9 (three
    // separate count queries); fixed: 8 (7 core + the constant shared
    // due-words badge query added 2026-10-25).
    expect($large)->toHaveCount(count($small))->and($small)->toHaveCount(8);
    expect($smallResponse->inertiaProps()['dueCount'])->toBe(3);
    expect($largeResponse->inertiaProps()['dueCount'])->toBe(26);
    expect($largeResponse->inertiaProps()['learningCount'])->toBe(26);
    expect($largeResponse->inertiaProps()['knownCount'])->toBe(24);
});
