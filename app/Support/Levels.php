<?php

namespace App\Support;

use App\Models\Lesson;
use Illuminate\Database\Eloquent\Builder;

/**
 * Level ordering (content attribute, never a permission): the single
 * CEFR-level CASE expression shared by the library and reader queries.
 * Previously pasted as two private levelOrder() copies.
 */
final class Levels
{
    public const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

    public static function orderExpression(): string
    {
        $cases = [];
        foreach (self::ORDER as $i => $level) {
            $cases[] = "when level = '{$level}' then {$i}";
        }

        return 'case '.implode(' ', $cases).' else 99 end';
    }

    public static function valid(?string $level): ?string
    {
        $upper = strtoupper(trim((string) $level));

        return in_array($upper, self::ORDER, true) ? $upper : null;
    }

    /**
     * @param  Builder<Lesson>  $query
     * @return Builder<Lesson>
     */
    public static function ordered(Builder $query): Builder
    {
        return $query->orderByRaw(self::orderExpression());
    }
}
