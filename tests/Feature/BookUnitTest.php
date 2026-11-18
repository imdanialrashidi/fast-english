<?php

use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\BookFixtures;
use Tests\Support\ContentFixtures;
use Tests\Support\ExerciseFixtures;

// The unit page (owner request 2026-11-15; exercise-only 2026-11-18): topics
// and questions render together, the legacy book URLs still land in the
// books section, and a draft book or unknown unit is not found.

test('the unit page is paid-only', function () {
    [$book, $unit] = BookFixtures::deck(1);

    $this->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))->assertRedirect();

    $student = ContentFixtures::student();
    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertForbidden();
});

test('the unit page shows the lesson topics, the set and the progress', function () {
    [$book, $unit] = BookFixtures::deck(1);
    ExerciseFixtures::set($book, $unit);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Books/Unit')
            ->where('book.slug', $book->slug)
            ->where('unit.number', $unit->number)
            ->where('progress.questions', 3)
            ->where('progress.answered', 0)
            ->where('set.title', 'تمرین تست')
            ->has('topics', 2)
            ->has('items', 3)
            ->where('items.0.type', 'choice')
            ->missing('items.0.result')
            ->missing('flashcards'));
});

test('the unit page without a published set is calm', function () {
    [$book, $unit] = BookFixtures::deck(1);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Books/Unit')
            ->where('set', null)
            ->where('progress.questions', 0)
            ->has('topics', 0)
            ->has('items', 0));
});

test('a draft book or an unknown unit is not found', function () {
    [$book, $unit] = BookFixtures::deck(1);
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => 99]))
        ->assertNotFound();

    $book->forceFill(['status' => 'draft'])->save();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertNotFound();
});

test('the legacy books URLs redirect to the section', function () {
    [$book, $unit] = BookFixtures::deck(1);

    $this->get('/app/flashcards')->assertRedirect('/app/books');
    $this->get('/app/flashcards/'.$book->slug)
        ->assertRedirect(route('flashcards.book', ['book' => $book->slug]));
    $this->get('/app/flashcards/'.$book->slug.'/'.$unit->number)
        ->assertRedirect(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]));
});
