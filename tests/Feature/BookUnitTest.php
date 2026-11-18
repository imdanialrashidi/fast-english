<?php

use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ContentFixtures;
use Tests\Support\ExerciseFixtures;
use Tests\Support\FlashcardFixtures;

// The unit hub (owner request 2026-11-15): a unit's home with its deck and
// exercise paths, plus the books-section URLs and the legacy redirects.

test('the unit hub is paid-only', function () {
    [$book, $unit] = FlashcardFixtures::deck(1);

    $this->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))->assertRedirect();

    $student = ContentFixtures::student();
    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertForbidden();
});

test('the unit page shows the lesson topics, the deck and the progress', function () {
    [$book, $unit] = FlashcardFixtures::deck(3);
    ExerciseFixtures::set($book, $unit);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Books/Unit')
            ->where('book.slug', $book->slug)
            ->where('unit.number', $unit->number)
            ->where('unit.flashcards_url', route('flashcards.unit', ['book' => $book->slug, 'unit' => $unit->number]))
            ->where('unit.results_url', route('flashcards.results', ['book' => $book->slug, 'unit' => $unit->number]))
            ->where('flashcards.cards_count', 3)
            ->where('flashcards.known_count', 0)
            ->where('progress.questions', 3)
            ->where('progress.answered', 0)
            ->where('set.title', 'تمرین تست')
            ->has('topics', 2)
            ->has('items', 3)
            ->where('items.0.type', 'choice')
            ->missing('items.0.result'));
});

test('the unit page without a published set is calm and keeps the deck', function () {
    [$book, $unit] = FlashcardFixtures::deck(1);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Books/Unit')
            ->where('set', null)
            ->where('progress.questions', 0)
            ->has('topics', 0)
            ->has('items', 0)
            ->where('flashcards.cards_count', 1));
});

test('a draft book or an unknown unit is not found', function () {
    [$book, $unit] = FlashcardFixtures::deck(1);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => 99]))
        ->assertNotFound();

    $book->forceFill(['status' => 'draft'])->save();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertNotFound();
});

test('the legacy books URLs redirect to the new section', function () {
    [$book, $unit] = FlashcardFixtures::deck(1);

    $this->get('/app/flashcards')->assertRedirect('/app/books');
    $this->get('/app/flashcards/'.$book->slug)
        ->assertRedirect(route('flashcards.book', ['book' => $book->slug]));
    $this->get('/app/flashcards/'.$book->slug.'/'.$unit->number)
        ->assertRedirect(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]));
    $this->get('/app/flashcards/'.$book->slug.'/'.$unit->number.'/results')
        ->assertRedirect(route('flashcards.results', ['book' => $book->slug, 'unit' => $unit->number]));
});
