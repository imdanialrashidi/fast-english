<?php

use App\Models\VocabularyWord;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\BookFixtures;
use Tests\Support\ContentFixtures;
use Tests\Support\ExerciseFixtures;

// The review hub (owner request 2026-11-15; book cards retired 2026-11-18):
// due words and exercise mistakes in one read-only page with a deterministic
// primary action. The card queue and its Today task are gone.

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
            ->where('exercises.wrong', 0)
            ->missing('cards'));
});

test('the hub counts due words and exercise mistakes, and words win the primary action', function () {
    [$book, $unit] = BookFixtures::deck(1);
    $set = ExerciseFixtures::set($book, $unit);
    $items = $set->items()->get();
    $student = ContentFixtures::subscribedStudent();

    VocabularyWord::factory()->for($student)->create([
        'word' => 'reviewone',
        'due_at' => now()->subDay(),
        'status' => 'learning',
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
            ->where('exercises.wrong', 1)
            ->where('exercises.sets', 1)
            ->where('total', 2)
            ->where('primary.url', route('words.review'))
            ->where('exercises.retry_url', route('books.unit', ['book' => $book->slug, 'unit' => $unit->number])));
});

test('without due words the primary action moves to the exercise retry', function () {
    [$book, $unit] = BookFixtures::deck(1);
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
            ->where('total', 1)
            ->where('primary.url', route('books.unit', ['book' => $book->slug, 'unit' => $unit->number])));
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

test('today no longer adds a card task', function () {
    [$book, $unit] = BookFixtures::deck(1);
    ExerciseFixtures::set($book, $unit);
    $student = ContentFixtures::subscribedStudent();

    $response = $this->actingAs($student)->get(route('today.index'))->assertOk();
    $keys = collect($response->inertiaProps()['plan']['tasks'])->pluck('key')->all();

    expect($keys)->not->toContain('cards')
        ->and($keys)->toContain('exercise');
});
