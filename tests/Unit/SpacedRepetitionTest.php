<?php

use App\Support\SpacedRepetition;

// The vocabulary SRS grows the interval on Good/Easy; an unbounded growth
// produced dates the app could not parse. The cap is the contract.

test('the interval is capped at one year', function () {
    $state = [
        'ease_factor' => 2.5,
        'interval_days' => 300,
        'repetitions' => 10,
        'lapses' => 0,
    ];

    $easy = SpacedRepetition::schedule($state, 'easy', now());
    $good = SpacedRepetition::schedule($state, 'good', now());

    expect($easy['interval_days'])->toBe(365)
        ->and($good['interval_days'])->toBe(365)
        ->and($easy['due_at']->year)->toBeLessThanOrEqual(now()->year + 1);
});

test('a huge existing interval is clamped instead of overflowing', function () {
    $state = [
        'ease_factor' => 4.15,
        'interval_days' => 13_623_583,
        'repetitions' => 11,
        'lapses' => 0,
    ];

    $next = SpacedRepetition::schedule($state, 'easy', now());

    expect($next['interval_days'])->toBe(365)
        ->and($next['due_at']->year)->toBeLessThanOrEqual(now()->year + 1);
});
