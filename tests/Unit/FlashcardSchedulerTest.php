<?php

use App\Support\Flashcards\Scheduler;
use Carbon\CarbonImmutable;

// Pure scheduler contract: exact next timestamps, no database or clock.

function flashNow(): CarbonImmutable
{
    return CarbonImmutable::parse('2026-11-15 10:00:00', 'UTC');
}

test('a new good card walks the learning steps then graduates', function () {
    $now = flashNow();

    $learning = Scheduler::review(Scheduler::initial(), 'good', $now);

    expect($learning['phase'])->toBe('learning')
        ->and($learning['step'])->toBe(1)
        ->and($learning['interval_days'])->toBe(0)
        ->and($learning['due_at']->toIso8601String())->toBe('2026-11-15T10:10:00+00:00');

    $graduated = Scheduler::review($learning, 'good', $now->addMinutes(10));

    expect($graduated['phase'])->toBe('review')
        ->and($graduated['step'])->toBe(0)
        ->and($graduated['interval_days'])->toBe(1)
        ->and($graduated['reps'])->toBe(1)
        ->and($graduated['due_at']->toIso8601String())->toBe('2026-11-16T10:10:00+00:00');
});

test('a new again card returns in one minute and stays in learning', function () {
    $now = flashNow();

    $state = Scheduler::review(Scheduler::initial(), 'again', $now);

    expect($state['phase'])->toBe('learning')
        ->and($state['step'])->toBe(0)
        ->and($state['due_at']->toIso8601String())->toBe('2026-11-15T10:01:00+00:00')
        ->and($state['last_rating'])->toBe('again')
        ->and($state['lapses'])->toBe(0);
});

test('a good review grows by the current ease and caps at the maximum', function () {
    $now = flashNow();
    $review = Scheduler::initial();
    $review['phase'] = 'review';
    $review['interval_days'] = 10;
    $review['ease'] = 2.5;
    $review['reps'] = 3;

    $next = Scheduler::review($review, 'good', $now);

    expect($next['phase'])->toBe('review')
        ->and($next['interval_days'])->toBe(25)
        ->and($next['reps'])->toBe(4)
        ->and($next['ease'])->toBe(2.5)
        ->and($next['due_at']->toIso8601String())->toBe('2026-12-10T10:00:00+00:00');

    $capped = $review;
    $capped['interval_days'] = 150;
    $capped['ease'] = 3.0;

    expect(Scheduler::review($capped, 'good', $now)['interval_days'])->toBe(180);
});

test('a review again card lapses, lowers ease and enters relearning', function () {
    $now = flashNow();
    $review = Scheduler::initial();
    $review['phase'] = 'review';
    $review['interval_days'] = 10;
    $review['ease'] = 2.5;
    $review['lapses'] = 1;

    $next = Scheduler::review($review, 'again', $now);

    expect($next['phase'])->toBe('relearning')
        ->and($next['interval_days'])->toBe(0)
        ->and($next['ease'])->toBe(2.3)
        ->and($next['lapses'])->toBe(2)
        ->and($next['due_at']->toIso8601String())->toBe('2026-11-15T10:10:00+00:00');
});

test('relearning good returns to one day and repeated again does not inflate lapses', function () {
    $now = flashNow();
    $review = Scheduler::initial();
    $review['phase'] = 'review';
    $review['interval_days'] = 10;
    $review['ease'] = 2.5;
    $review['lapses'] = 1;

    $relearning = Scheduler::review($review, 'again', $now);
    $again = Scheduler::review($relearning, 'again', $now->addMinutes(10));

    expect($again['phase'])->toBe('relearning')
        ->and($again['lapses'])->toBe(2)
        ->and($again['ease'])->toBe(2.3);

    $good = Scheduler::review($again, 'good', $now->addMinutes(20));

    expect($good['phase'])->toBe('review')
        ->and($good['interval_days'])->toBe(1)
        ->and($good['reps'])->toBe(1);
});

test('ease never falls below the floor', function () {
    $now = flashNow();
    $review = Scheduler::initial();
    $review['phase'] = 'review';
    $review['ease'] = 1.3;

    expect(Scheduler::review($review, 'again', $now)['ease'])->toBe(1.3);
});

test('isDue only reports scheduled cards at or before now', function () {
    $now = flashNow();

    expect(Scheduler::isDue(Scheduler::initial(), $now))->toBeFalse();

    $learning = Scheduler::review(Scheduler::initial(), 'good', $now);
    expect(Scheduler::isDue($learning, $now->addMinutes(9)))->toBeFalse()
        ->and(Scheduler::isDue($learning, $now->addMinutes(11)))->toBeTrue();
});
