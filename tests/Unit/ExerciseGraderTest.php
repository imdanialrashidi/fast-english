<?php

use App\Models\ExerciseItem;
use App\Support\Exercises\Grader;

// Exercise marking is pure: same item + response in, same boolean out.

test('choice compares the selected index', function () {
    $item = new ExerciseItem([
        'type' => 'choice',
        'options' => ['am', 'is', 'are'],
        'answer' => ['index' => 2],
    ]);

    expect(Grader::isCorrect($item, 2))->toBeTrue()
        ->and(Grader::isCorrect($item, '2'))->toBeTrue()
        ->and(Grader::isCorrect($item, 0))->toBeFalse()
        ->and(Grader::isCorrect($item, null))->toBeFalse()
        ->and(Grader::displayAnswer($item))->toBe('are')
        ->and(Grader::displayResponse($item, 0))->toBe('am');
});

test('matching marks the displayed right column against the authored map', function () {
    $item = new ExerciseItem([
        'id' => 7,
        'type' => 'matching',
        'options' => [
            'left' => ['How are you?', 'Are you Anna?', 'Where is she from?'],
            'right' => ["I'm fine, thanks.", 'Yes, I am.', 'She is from Spain.'],
        ],
        'answer' => ['map' => [0, 1, 2]],
    ]);

    $displayed = Grader::rights($item);
    $response = [];

    foreach ($item->options['right'] as $right) {
        $response[] = array_search($right, $displayed, true);
    }

    expect($displayed)->toHaveCount(3)
        ->and($displayed)->not->toBe($item->options['right'])
        ->and(Grader::isCorrect($item, $response))->toBeTrue();

    $wrong = $response;
    $wrong[2] = $response[0];
    expect(Grader::isCorrect($item, $wrong))->toBeFalse()
        ->and(Grader::isCorrect($item, [0]))->toBeFalse()
        ->and(Grader::isCorrect($item, null))->toBeFalse();
});

test('the right-column shuffle is stable for one item', function () {
    $item = new ExerciseItem([
        'id' => 42,
        'type' => 'matching',
        'options' => [
            'left' => ['a', 'b', 'c', 'd'],
            'right' => ['one', 'two', 'three', 'four'],
        ],
        'answer' => ['map' => [0, 1, 2, 3]],
    ]);

    expect(Grader::rights($item))->toBe(Grader::rights($item))
        ->and(Grader::rightOrder($item))->toBe(Grader::rightOrder($item));
});
