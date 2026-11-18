<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Validation\ValidationException;

/**
 * R4 spaced repetition (VOCAB-01): a small deterministic SM-2-style rule.
 *
 * Grades are Again, Hard, Good, Easy. Again resets progress and makes the
 * word due immediately; Hard/Good/Easy grow the interval from the current
 * ease factor. The rule is pure (inputs → schedule) so tests assert exact
 * dates without touching the clock or the network. No adaptive algorithm,
 * no external service.
 */
final class SpacedRepetition
{
    public const GRADES = ['again', 'hard', 'good', 'easy'];

    /**
     * A hard ceiling on the interval. Without it, repeated Easy grades grow
     * the interval without bound and eventually produce a date the database
     * or Carbon cannot represent (observed as year 39326 in the lane).
     */
    public const MAX_INTERVAL_DAYS = 365;

    /**
     * @param  array{ease_factor: float, interval_days: int, repetitions: int, lapses: int}  $state
     * @return array{ease_factor: float, interval_days: int, repetitions: int, lapses: int, due_at: CarbonInterface, last_reviewed_at: CarbonInterface}
     *
     * @throws ValidationException
     */
    public static function schedule(array $state, string $grade, CarbonInterface $now): array
    {
        if (! in_array($grade, self::GRADES, true)) {
            throw ValidationException::withMessages([
                'grade' => 'The grade must be one of: again, hard, good, easy.',
            ]);
        }

        $ease = max(1.3, (float) ($state['ease_factor'] ?? 2.5));
        $interval = max(0, (int) ($state['interval_days'] ?? 0));
        $repetitions = max(0, (int) ($state['repetitions'] ?? 0));
        $lapses = max(0, (int) ($state['lapses'] ?? 0));

        if ($grade === 'again') {
            return [
                'ease_factor' => round(max(1.3, $ease - 0.2), 2),
                'interval_days' => 0,
                'repetitions' => 0,
                'lapses' => $lapses + 1,
                'due_at' => $now->copy(),
                'last_reviewed_at' => $now->copy(),
            ];
        }

        $repetitions++;
        if ($grade === 'hard') {
            $ease = round(max(1.3, $ease - 0.15), 2);
            $interval = $interval < 1 ? 1 : (int) max(1, round($interval * 1.2));
        } elseif ($grade === 'good') {
            $interval = $interval < 1 ? 1 : ($repetitions <= 2 ? 3 : (int) max(1, round($interval * $ease)));
        } else {
            $ease = round($ease + 0.15, 2);
            $interval = $interval < 1 ? 4 : (int) max(1, round($interval * $ease * 1.3));
        }

        $interval = min($interval, self::MAX_INTERVAL_DAYS);

        return [
            'ease_factor' => $ease,
            'interval_days' => $interval,
            'repetitions' => $repetitions,
            'lapses' => $lapses,
            'due_at' => $now->copy()->addDays($interval)->startOfDay(),
            'last_reviewed_at' => $now->copy(),
        ];
    }

    /**
     * A freshly saved word is due immediately so the first review session
     * can pick it up.
     *
     * @return array{ease_factor: float, interval_days: int, repetitions: int, lapses: int, due_at: CarbonInterface, last_reviewed_at: null}
     */
    public static function initial(CarbonInterface $now): array
    {
        return [
            'ease_factor' => 2.5,
            'interval_days' => 0,
            'repetitions' => 0,
            'lapses' => 0,
            'due_at' => $now->copy(),
            'last_reviewed_at' => null,
        ];
    }
}
