<?php

use App\Models\Lesson;
use App\Models\VocabularyWord;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// R4 vocabulary notebook (VOCAB-01, AC-25): persistent, owner-isolated,
// deterministic SRS scheduling with Again/Hard/Good/Easy.

test('a student saves a lesson word with glossary reuse and sees it after reload', function () {
    $student = ContentFixtures::subscribedStudent();
    $topic = ContentFixtures::publishedTopic(['slug' => 'r4-gloss']);
    $lesson = Lesson::factory()->for($topic)->create([
        'level' => 'A2',
        'status' => 'published',
        'published_at' => now(),
        'is_public_sample' => true,
        'glossary' => [
            ['word' => 'crowded', 'meaning_fa' => 'شلوغ', 'example_en' => 'The park was crowded.'],
        ],
    ]);

    $this->actingAs($student)
        ->postJson(route('words.store'), [
            'word' => 'Crowded',
            'lesson_id' => $lesson->id,
        ])
        ->assertCreated()
        ->assertJsonPath('word', 'Crowded');

    $entry = VocabularyWord::where('user_id', $student->id)->firstOrFail();
    // Glossary reuse: meaning + example prefilled from the lesson entry.
    expect($entry->meaning_fa)->toBe('شلوغ')
        ->and($entry->example_en)->toBe('The park was crowded.')
        ->and((int) $entry->lesson_id)->toBe($lesson->id)
        ->and((int) $entry->topic_id)->toBe($topic->id)
        ->and($entry->status)->toBe('learning');

    // A fresh GET (reload) lists the saved word with its lesson context.
    // Public-slice port (ADR-0002): English survives the encoded page;
    // the Persian meaning is asserted on the decoded props.
    $reload = $this->actingAs($student)
        ->get(route('words.index'))
        ->assertOk()
        ->assertSee('Crowded');
    $listed = collect($reload->inertiaProps()['words']);
    expect($listed->firstWhere('word', 'Crowded')['meaning_fa'])->toBe('شلوغ');

    // Duplicate (case-insensitive) is refused, not doubled.
    $this->actingAs($student)
        ->postJson(route('words.store'), ['word' => 'crowded'])
        ->assertStatus(422);
    expect(VocabularyWord::where('user_id', $student->id)->count())->toBe(1);
});

test('guests cannot save and students cannot touch each others words', function () {
    $owner = ContentFixtures::subscribedStudent();
    $other = ContentFixtures::subscribedStudent();
    $entry = VocabularyWord::factory()->for($owner)->create(['word' => 'habit']);

    $this->postJson(route('words.store'), ['word' => 'habit'])->assertUnauthorized();
    $this->get(route('words.index'))->assertRedirect();

    $this->actingAs($other)->get(route('words.index'))->assertOk()->assertDontSee('habit');
    $this->actingAs($other)
        ->postJson(route('words.grade', $entry), ['grade' => 'good'])
        ->assertForbidden();
    $this->actingAs($other)
        ->patchJson(route('words.update', $entry), ['meaning_fa' => 'x'])
        ->assertForbidden();
    $this->actingAs($other)
        ->deleteJson(route('words.destroy', $entry))
        ->assertForbidden();

    expect($entry->fresh())->not->toBeNull();
});

test('grading reschedules deterministically and known words leave review', function () {
    $student = ContentFixtures::subscribedStudent();
    $entry = VocabularyWord::factory()->for($student)->create([
        'word' => 'opportunity',
        'due_at' => now()->subDay(),
    ]);

    // First good review: 1-day interval, one repetition.
    $this->actingAs($student)
        ->postJson(route('words.grade', $entry), ['grade' => 'good'])
        ->assertOk()
        ->assertJsonPath('interval_days', 1);

    $entry->refresh();
    expect((int) $entry->repetitions)->toBe(1)
        ->and($entry->due_at->isSameDay(now()->addDay()->startOfDay()))->toBeTrue()
        ->and($entry->last_reviewed_at)->not->toBeNull();

    // Again resets progress and makes the word due immediately.
    $this->actingAs($student)
        ->postJson(route('words.grade', $entry), ['grade' => 'again'])
        ->assertOk()
        ->assertJsonPath('interval_days', 0)
        ->assertJsonPath('repetitions', 0);

    $entry->refresh();
    expect((int) $entry->lapses)->toBe(1)
        ->and($entry->due_at->lessThanOrEqualTo(now()))->toBeTrue();

    // Marking known removes the word from review; it stays listed.
    $this->actingAs($student)
        ->patchJson(route('words.update', $entry), ['status' => 'known'])
        ->assertOk()
        ->assertJsonPath('status', 'known');

    $this->actingAs($student)
        ->postJson(route('words.grade', $entry), ['grade' => 'good'])
        ->assertStatus(422);

    $review = $this->actingAs($student)
        ->get(route('words.review'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Words/Review')
            ->where('card', null)
            ->where('remaining', 0));
    expect($review->inertiaProps()['card'])->toBeNull();
});

test('editing notes and removing a word persist across reloads', function () {
    $student = ContentFixtures::subscribedStudent();
    $entry = VocabularyWord::factory()->for($student)->create(['word' => 'progress']);

    $this->actingAs($student)
        ->patchJson(route('words.update', $entry), [
            'meaning_fa' => 'پیشرفت',
            'example_en' => 'She made progress.',
        ])
        ->assertOk();

    $edited = $this->actingAs($student)
        ->get(route('words.index'))
        ->assertOk();
    expect(collect($edited->inertiaProps()['words'])->firstWhere('word', 'progress')['meaning_fa'])->toBe('پیشرفت');

    $this->actingAs($student)
        ->deleteJson(route('words.destroy', $entry))
        ->assertOk();

    expect(VocabularyWord::where('user_id', $student->id)->count())->toBe(0);

    $emptied = $this->actingAs($student)
        ->get(route('words.index'))
        ->assertOk();
    expect($emptied->inertiaProps()['words'])->toBe([]);
});
