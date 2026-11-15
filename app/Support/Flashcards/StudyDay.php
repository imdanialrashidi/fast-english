<?php

namespace App\Support\Flashcards;

use Carbon\CarbonImmutable;

/**
 * The study day is Asia/Tehran, never UTC. Timestamps stay UTC in the
 * database; daily limits and "today" counters are derived from this
 * boundary so a learner at 00:30 Tehran is on the new day, not 03:30.
 */
final class StudyDay
{
    public static function startUtc(?CarbonImmutable $now = null): CarbonImmutable
    {
        $moment = $now ?? CarbonImmutable::now('UTC');

        return $moment->setTimezone('Asia/Tehran')->startOfDay()->setTimezone('UTC');
    }

    public static function endUtc(?CarbonImmutable $now = null): CarbonImmutable
    {
        return self::startUtc($now)->addDay();
    }

    public static function todayTehran(?CarbonImmutable $now = null): string
    {
        return ($now ?? CarbonImmutable::now('UTC'))->setTimezone('Asia/Tehran')->format('Y-m-d');
    }
}
