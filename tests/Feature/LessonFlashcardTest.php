<?php

use App\Models\Lesson;
use App\Models\VocabularyWord;
use App\Models\WordAudio;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ContentFixtures;

// Lesson vocabulary decks (owner clarification 2026-11-15): the article's
// glossary is the deck with no entry cap, cards are text-first with an
// optional word clip, and grading writes the same vocabulary row the
// notebook schedules. No second SRS, no duplicate content.

function lessonVocabDeck(array $words, array $overrides = []): Lesson
{
    $glossary = array_map(
        fn (string $word): array => [
            'word' => $word,
            'meaning_fa' => 'معنی '.$word,
            'example_en' => "This is {$word}.",
        ],
        $words,
    );

    return Lesson::factory()
        ->for(ContentFixtures::publishedTopic())
        ->create(array_merge([
            'level' => 'A2',
            'status' => 'published',
            'published_at' => now(),
            'glossary' => $glossary,
        ], $overrides));
}

test('a lesson deck is paid-only', function () {
    $lesson = lessonVocabDeck(['alpha']);

    $this->get(route('lessons.flashcards', ['lesson' => $lesson->id]))->assertRedirect();

    $student = ContentFixtures::student();
    $this->actingAs($student)
        ->get(route('lessons.flashcards', ['lesson' => $lesson->id]))
        ->assertForbidden();
});

test('the deck shows every glossary word with its Persian meaning and no cap', function () {
    $words = array_map(fn (int $i): string => "word{$i}", range(1, 15));
    $lesson = lessonVocabDeck($words);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('lessons.flashcards', ['lesson' => $lesson->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Flashcards/Lesson')
            ->where('lesson.id', $lesson->id)
            ->where('lesson.level', 'A2')
            ->where('lesson.reader_url', route('reader.show', [
                'topic' => $lesson->topic->slug,
                'level' => $lesson->level,
            ]))
            ->has('cards', 15)
            ->where('cards.0.word_key', 'word1')
            ->where('cards.0.word', 'word1')
            ->where('cards.0.translation_fa', 'معنی word1')
            ->where('cards.0.audio_url', null)
            ->where('counts.total', 15)
            ->where('counts.new', 15));
});

test('only an approved word clip is offered to the player', function () {
    $lesson = lessonVocabDeck(['alpha', 'beta']);
    $student = ContentFixtures::subscribedStudent();

    $approved = WordAudio::create([
        'word_key' => 'alpha',
        'path' => 'flashcards/words/alpha-test.mp3',
        'status' => 'approved',
    ]);
    WordAudio::create([
        'word_key' => 'beta',
        'path' => 'flashcards/words/beta-test.mp3',
        'status' => 'draft',
    ]);

    $this->actingAs($student)
        ->get(route('lessons.flashcards', ['lesson' => $lesson->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('cards.0.audio_url', route('media.word.audio', ['wordAudio' => $approved->id]))
            ->where('cards.1.audio_url', null));
});

test('grading a card creates the notebook row with the glossary meaning', function () {
    $lesson = lessonVocabDeck(['alpha']);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->postJson(route('lessons.flashcards.store', ['lesson' => $lesson->id]), [
            'word_key' => 'ALPHA',
            'rating' => 'again',
        ])
        ->assertOk()
        ->assertJsonPath('status', 'learning')
        ->assertJsonPath('interval_days', 0);

    $word = VocabularyWord::where('user_id', $student->id)->firstOrFail();

    expect($word->word_key)->toBe('alpha')
        ->and($word->lesson_id)->toBe($lesson->id)
        ->and($word->topic_id)->toBe($lesson->topic_id)
        ->and($word->meaning_fa)->toBe('معنی alpha')
        ->and($word->example_en)->toBe('This is alpha.')
        ->and($word->lapses)->toBe(1)
        ->and($word->due_at->lessThanOrEqualTo(now()))->toBeTrue();

    $this->actingAs($student)
        ->postJson(route('lessons.flashcards.store', ['lesson' => $lesson->id]), [
            'word_key' => 'alpha',
            'rating' => 'good',
        ])
        ->assertOk()
        ->assertJsonPath('interval_days', 1);

    expect($word->fresh()->interval_days)->toBe(1)
        ->and($word->fresh()->repetitions)->toBe(1)
        ->and($word->fresh()->status)->toBe('learning')
        ->and(VocabularyWord::where('user_id', $student->id)->count())->toBe(1);
});

test('a word outside the lesson glossary is refused', function () {
    $lesson = lessonVocabDeck(['alpha']);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->postJson(route('lessons.flashcards.store', ['lesson' => $lesson->id]), [
            'word_key' => 'not-in-this-lesson',
            'rating' => 'good',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('word_key');

    expect(VocabularyWord::count())->toBe(0);
});

test('one learner never sees another learner state', function () {
    $lesson = lessonVocabDeck(['alpha']);
    $studentA = ContentFixtures::subscribedStudent();
    $studentB = ContentFixtures::subscribedStudent();

    $this->actingAs($studentA)
        ->postJson(route('lessons.flashcards.store', ['lesson' => $lesson->id]), [
            'word_key' => 'alpha',
            'rating' => 'good',
        ])
        ->assertOk();

    $this->actingAs($studentB)
        ->get(route('lessons.flashcards', ['lesson' => $lesson->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('cards.0.status', 'new')
            ->where('counts.new', 1)
            ->where('counts.learning', 0));
});

test('a known word stays known on good and reopens on again', function () {
    $lesson = lessonVocabDeck(['alpha']);
    $student = ContentFixtures::subscribedStudent();

    $word = VocabularyWord::create([
        'user_id' => $student->id,
        'word' => 'alpha',
        'word_key' => 'alpha',
        'meaning_fa' => 'معنی alpha',
        'lesson_id' => $lesson->id,
        'topic_id' => $lesson->topic_id,
        'status' => 'known',
        'ease_factor' => 2.5,
        'interval_days' => 10,
        'repetitions' => 4,
        'lapses' => 0,
        'due_at' => now()->addDay(),
    ]);

    $this->actingAs($student)
        ->get(route('lessons.flashcards', ['lesson' => $lesson->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('cards.0.status', 'known')
            ->where('counts.known', 1));

    $this->actingAs($student)
        ->postJson(route('lessons.flashcards.store', ['lesson' => $lesson->id]), [
            'word_key' => 'alpha',
            'rating' => 'good',
        ])
        ->assertOk()
        ->assertJsonPath('status', 'known');

    expect($word->fresh()->status)->toBe('known');

    $this->actingAs($student)
        ->postJson(route('lessons.flashcards.store', ['lesson' => $lesson->id]), [
            'word_key' => 'alpha',
            'rating' => 'again',
        ])
        ->assertOk()
        ->assertJsonPath('status', 'learning');

    expect($word->fresh()->status)->toBe('learning');
});

test('a draft lesson has no deck', function () {
    $lesson = lessonVocabDeck(['alpha'], ['status' => 'draft', 'published_at' => null]);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('lessons.flashcards', ['lesson' => $lesson->id]))
        ->assertNotFound();

    $this->actingAs($student)
        ->postJson(route('lessons.flashcards.store', ['lesson' => $lesson->id]), [
            'word_key' => 'alpha',
            'rating' => 'good',
        ])
        ->assertNotFound();
});

test('an approved word clip is private and no-store', function () {
    $student = ContentFixtures::subscribedStudent();
    $audio = WordAudio::create([
        'word_key' => 'alpha',
        'path' => 'flashcards/words/alpha-media-test.mp3',
        'status' => 'approved',
    ]);

    Storage::disk('local')->put(
        $audio->path,
        (string) file_get_contents(database_path('seeders/fixtures/s1-a2-tone-fixture.mp3')),
    );

    $this->actingAs($student)
        ->get(route('media.word.audio', ['wordAudio' => $audio->id]))
        ->assertOk()
        ->assertHeader('Content-Type', 'audio/mpeg')
        ->assertHeader('Cache-Control', 'no-store, private');

    $audio->forceFill(['status' => 'rejected'])->save();

    $this->actingAs($student)
        ->get(route('media.word.audio', ['wordAudio' => $audio->id]))
        ->assertNotFound();
});
