<?php

namespace App\Support;

/**
 * Placement suggestion: total score → CEFR entry level.
 *
 * Design (2026-10-26): twenty receptive items, four per CEFR band, ordered
 * from A1 to C1. A learner who clears the lower bands is placed at the band
 * whose items they can still answer; the floor is A1 and the ceiling is C1.
 *
 * The ceiling is deliberate: a 20-item multiple-choice test cannot place
 * C2, which needs productive (speaking/writing) assessment. A perfect score
 * therefore recommends C1, and the result page says so.
 *
 * Bands (one point per item): 0–3 A1 · 4–7 A2 · 8–11 B1 · 12–15 B2 ·
 * 16–20 C1. The boundaries follow the item distribution, so a learner who
 * answers the A1 and A2 items but little else lands on B1.
 *
 * This is an indicative placement suggestion, not a certified CEFR exam.
 */
final class PlacementLevel
{
    /**
     * @return list<array{max: int, level: string}>
     */
    private static function bands(): array
    {
        return [
            ['max' => 3, 'level' => 'A1'],
            ['max' => 7, 'level' => 'A2'],
            ['max' => 11, 'level' => 'B1'],
            ['max' => 15, 'level' => 'B2'],
            ['max' => 20, 'level' => 'C1'],
        ];
    }

    public static function forScore(int $score): string
    {
        foreach (self::bands() as $band) {
            if ($score <= $band['max']) {
                return $band['level'];
            }
        }

        return 'C1';
    }

    /** @return array<string, array{int, int}> */
    public static function map(): array
    {
        $map = [];
        $floor = 0;
        foreach (self::bands() as $band) {
            $map[$band['level']] = [$floor, $band['max']];
            $floor = $band['max'] + 1;
        }

        return $map;
    }
}
