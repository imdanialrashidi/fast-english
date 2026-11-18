<?php

use App\Models\ExerciseAnswer;
use App\Models\ExerciseAttempt;
use App\Support\Exercises\Grader;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ContentFixtures;
use Tests\Support\ExerciseFixtures;
use Tests\Support\FlashcardFixtures;

// The grammar-first unit page (owner request 2026-11-16): topics and
// questions render together, one answer is marked in place, the key and the
// Persian feedback appear only after committing, and a question counts once.

function exerciseUnit(): array
{
    [$book, $unit] = FlashcardFixtures::deck(1);
    $set = ExerciseFixtures::set($book, $unit);

    return [$book, $unit, $set, $set->items()->get()];
}

test('the unit page and answer endpoint are paid-only', function () {
    [$book, $unit] = FlashcardFixtures::deck(1);
    $student = ContentFixtures::student();

    $this->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))->assertRedirect();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertForbidden();

    $this->actingAs($student)
        ->postJson(route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]), [
            'item_id' => 1,
            'response' => 0,
        ])
        ->assertForbidden();
});

test('the unit payload carries topics but no key or feedback before answering', function () {
    [$book, $unit, , $items] = exerciseUnit();
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Books/Unit')
            ->where('progress.questions', 3)
            ->where('progress.answered', 0)
            ->has('topics', 2)
            ->where('topics.0.title_en', 'verb be (singular): I and you')
            ->where('topics.0.formulas.0.label_fa', 'مثبت')
            ->where('topics.1.key', 't2')
            ->has('items', 3)
            ->where('items.0.id', $items[0]->id)
            ->where('items.0.type', 'choice')
            ->where('items.0.options.2', 'are')
            ->where('items.1.type', 'matching')
            ->has('items.1.left', 3)
            ->has('items.1.rights', 3)
            ->missing('items.0.result')
            ->missing('items.0.answer')
            ->where('set.title', 'تمرین تست'));
});

test('a wrong choice returns the key, the option feedback and the explanation', function () {
    [$book, $unit, , $items] = exerciseUnit();
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->postJson(route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]), [
            'item_id' => $items[0]->id,
            'response' => 0,
        ])
        ->assertOk()
        ->assertJsonPath('is_correct', false)
        ->assertJsonPath('correct', 'are')
        ->assertJsonPath('feedback_fa', 'با I از am استفاده می‌کنیم.')
        ->assertJsonPath('explanation_fa', 'با you از are استفاده می‌کنیم.')
        ->assertJsonPath('already', false);

    expect(ExerciseAttempt::query()->where('user_id', $student->id)->count())->toBe(1)
        ->and(ExerciseAnswer::query()->where('is_correct', false)->count())->toBe(1);
});

test('the first answer is the only one counted, and a retry returns it untouched', function () {
    [$book, $unit, , $items] = exerciseUnit();
    $student = ContentFixtures::subscribedStudent();
    $url = route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]);

    $this->actingAs($student)->postJson($url, ['item_id' => $items[0]->id, 'response' => 0])->assertOk();
    $this->actingAs($student)->postJson($url, ['item_id' => $items[0]->id, 'response' => 2])
        ->assertOk()
        ->assertJsonPath('already', true)
        ->assertJsonPath('is_correct', false);

    expect(ExerciseAttempt::query()->where('user_id', $student->id)->count())->toBe(1);

    $this->actingAs($student)
        ->get(route('books.unit', ['book' => $book->slug, 'unit' => $unit->number]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('progress.answered', 1)
            ->where('items.0.result.is_correct', false)
            ->where('items.0.result.correct', 'are')
            ->missing('items.1.result'));
});

test('a matching answer is marked from the shuffled right column', function () {
    [$book, $unit, , $items] = exerciseUnit();
    $student = ContentFixtures::subscribedStudent();
    $matching = $items[1];
    $displayed = Grader::rights($matching);
    $authored = $matching->options['right'];
    $response = [];

    foreach ($authored as $right) {
        $response[] = array_search($right, $displayed, true);
    }

    $this->actingAs($student)
        ->postJson(route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]), [
            'item_id' => $matching->id,
            'response' => $response,
        ])
        ->assertOk()
        ->assertJsonPath('is_correct', true);

    $wrong = $response;
    $wrong[0] = ($wrong[0] + 1) % count($displayed);

    // A different question is unaffected; this one stays correct.
    $this->actingAs($student)
        ->postJson(route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]), [
            'item_id' => $matching->id,
            'response' => $wrong,
        ])
        ->assertOk()
        ->assertJsonPath('already', true)
        ->assertJsonPath('is_correct', true);
});

test('an item from another set is rejected', function () {
    [$book, $unit] = FlashcardFixtures::deck(1);
    $otherBook = FlashcardFixtures::book(['slug' => 'other-book']);
    $otherUnit = FlashcardFixtures::unit($otherBook, ['number' => 1]);
    $otherSet = ExerciseFixtures::set($otherBook, $otherUnit);
    $foreign = $otherSet->items()->first();
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->postJson(route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]), [
            'item_id' => $foreign->id,
            'response' => 0,
        ])
        ->assertNotFound();
});

test('an out-of-range choice is a validation error', function () {
    [$book, $unit, , $items] = exerciseUnit();
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->postJson(route('exercises.answer', ['book' => $book->slug, 'unit' => $unit->number]), [
            'item_id' => $items[0]->id,
            'response' => 9,
        ])
        ->assertStatus(422);
});
