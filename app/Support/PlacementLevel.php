<?php

namespace App\Support;

/**
 * S7 suggested-level fixture (scope §12): score → suggested level.
 *
 * This table is a FIXTURE for the optional placement suggestion — not a
 * validated CEFR scale. Teacher approval of real questions and cut scores
 * is required before any public exam (recorded BLOCKED in the plan).
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
            ['max' => 18, 'level' => 'C1'],
            ['max' => 20, 'level' => 'C2'],
        ];
    }

    public static function forScore(int $score): string
    {
        foreach (self::bands() as $band) {
            if ($score <= $band['max']) {
                return $band['level'];
            }
        }

        return 'C2';
    }

    /** @return array<string, array{int, int}> */
    public static function fixtureMap(): array
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
