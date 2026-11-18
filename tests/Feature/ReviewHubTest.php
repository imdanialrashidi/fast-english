<?php

use App\Models\UserFlashcard;
use App\Models\VocabularyWord;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ContentFixtures;
use Tests\Support\ExerciseFixtures;
use Tests\Support\FlashcardFixtures;

// Cross-track review hub (owner request 2026-11-15): due words, due book
// cards and exercise mistakes in one read-only page with a deterministic
// primary action, plus the due-card task on Today.

test('the review hub is paid-only', function () {
    $this->get(route('review.index'))->assertRedirect();

    $student = ContentFixtures::student();
    $this->actingAs($student)->get(route('review.index'))->assertForbidden();
});

test('an empty hub is calm and offers the notebook', function () {
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('review.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Review/Index')
            ->where('total', 0)
            ->where('primary', null)
            ->where('words.due', 0)
            ->where('cards.due', 0)
            ->where('exercises.wrong', 0));
});

test('the hub counts words, cards and exercise mistakes, and words win the primary action', function () {
    [$book, $unit, $cards] = FlashcardFixtures::deck(1);
    $set = ExerciseFixtures::set($book, $unit);
    $items = $set->items()->get();
    $student = ContentFixtures::subscribedStudent();

    VocabularyWord::factory()->for($student)->create([
        'word' => 'reviewone',
        'due_at' => now()->subDay(),
        'status' => 'learning',
    ]);

    UserFlashcard::create([
        'user_id' => $student->id,
        'flashcard_id' => $cards[0]->id,
        'phase' => 'learning',
        'step' => 0,
        'due_at' => now()->subMinute(),
        'interval_days' => 0,
        'ease_factor' => 2.5,
        'reps' => 1,
        'lapses' => 0,
        'last_rating' => 'again',
    ]);

    $this->actingAs($student)->postJson(
        route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]),
        ['item_id' => $items[0]->id, 'response' => 0],
    )->assertOk();

    $this->actingAs($student)
        ->get(route('review.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('words.due', 1)
            ->where('cards.due', 1)
            ->where('exercises.wrong', 1)
            ->where('exercises.sets', 1)
            ->where('total', 3)
            ->where('primary.url', route('words.review'))
            ->where('exercises.retry_url', route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
            ->where('exercises.result_url', null));
});

test('without due words the primary action moves to cards, then exercise mistakes', function () {
    [$book, $unit, $cards] = FlashcardFixtures::deck(1);
    $set = ExerciseFixtures::set($book, $unit);
    $items = $set->items()->get();
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)->postJson(
        route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]),
        ['item_id' => $items[0]->id, 'response' => 0],
    )->assertOk();

    $this->actingAs($student)
        ->get(route('review.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('primary.url', route('books.unit', ['book' => $book->slug, 'unit' => $unit->number])));

    UserFlashcard::create([
        'user_id' => $student->id,
        'flashcard_id' => $cards[0]->id,
        'phase' => 'learning',
        'step' => 0,
        'due_at' => now()->subMinute(),
        'interval_days' => 0,
        'ease_factor' => 2.5,
        'reps' => 1,
        'lapses' => 0,
        'last_rating' => 'again',
    ]);

    $this->actingAs($student)
        ->get(route('review.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('primary.url', route('flashcards.review')));
});

test('the hub is owner-scoped', function () {
    $studentA = ContentFixtures::subscribedStudent();
    $studentB = ContentFixtures::subscribedStudent();

    VocabularyWord::factory()->for($studentA)->create([
        'word' => 'privateword',
        'due_at' => now()->subDay(),
    ]);

    $this->actingAs($studentB)
        ->get(route('review.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('words.due', 0)->where('total', 0));
});

test('today adds a due-card task that links to the card review', function () {
    [, , $cards] = FlashcardFixtures::deck(1);
    $student = ContentFixtures::subscribedStudent();

    $without = $this->actingAs($student)->get(route('today.index'))->assertOk();
    expect(collect($without->inertiaProps()['plan']['tasks'])->pluck('key')->all())->not->toContain('cards');

    UserFlashcard::create([
        'user_id' => $student->id,
        'flashcard_id' => $cards[0]->id,
        'phase' => 'learning',
        'step' => 0,
        'due_at' => now()->subMinute(),
        'interval_days' => 0,
        'ease_factor' => 2.5,
        'reps' => 1,
        'lapses' => 0,
        'last_rating' => 'again',
    ]);

    $with = $this->actingAs($student)->get(route('today.index'))->assertOk();
    $task = collect($with->inertiaProps()['plan']['tasks'])->firstWhere('key', 'cards');

    expect($task)->not->toBeNull()
        ->and($task['url'])->toBe(route('flashcards.review'))
        ->and($task['detail'])->toBe('1 کارت');
});
