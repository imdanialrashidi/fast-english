<?php

use App\Support\Exercises\ExerciseProgress;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\BookFixtures;
use Tests\Support\ContentFixtures;
use Tests\Support\ExerciseFixtures;

// Progress is answered-question count, first answer only (owner request
// 2026-11-16): the shelf, the book list and the unit page read the same
// numbers, and a retry never raises them.

test('the shelf, book and unit read the same answered-question progress', function () {
    [$book, $unit] = BookFixtures::deck(1);
    $set = ExerciseFixtures::set($book, $unit);
    $items = $set->items()->get();
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('flashcards.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('books.0.exercise.questions', 3)
            ->where('books.0.exercise.answered', 0));

    $this->actingAs($student)
        ->get(route('flashcards.book', ['book' => $book->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('units.0.exercise.questions', 3)
            ->where('units.0.exercise.answered', 0));

    $this->actingAs($student)->postJson(
        route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]),
        ['item_id' => $items[0]->id, 'response' => 0],
    )->assertOk();

    $this->actingAs($student)
        ->get(route('flashcards.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('books.0.exercise.answered', 1));

    $this->actingAs($student)
        ->get(route('flashcards.book', ['book' => $book->slug]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('units.0.exercise.answered', 1));

    // The same question again changes nothing.
    $this->actingAs($student)->postJson(
        route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]),
        ['item_id' => $items[0]->id, 'response' => 2],
    )->assertOk();

    $this->actingAs($student)
        ->get(route('flashcards.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('books.0.exercise.answered', 1));
});

test('the daily task points at the first unit with unanswered questions', function () {
    [$book, $unit] = BookFixtures::deck(1);
    $set = ExerciseFixtures::set($book, $unit);
    $student = ContentFixtures::subscribedStudent();

    $task = ExerciseProgress::next($student);
    expect($task)->not->toBeNull()
        ->and($task['url'])->toBe(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]));

    foreach ($set->items()->get() as $index => $item) {
        $response = $item->type === 'choice' ? (int) $item->answer['index'] : [0, 1, 2];
        $this->actingAs($student)->postJson(
            route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]),
            ['item_id' => $item->id, 'response' => $response],
        )->assertOk();
    }

    expect(ExerciseProgress::next($student))->toBeNull();
});
