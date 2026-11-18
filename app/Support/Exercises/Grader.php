<?php

namespace App\Support\Exercises;

use App\Models\ExerciseItem;

/**
 * The one owner of exercise marking. Pure: an item plus a client response
 * in, a boolean and a human-readable answer out. The answer key never
 * leaves the server before submit.
 *
 * Types:
 * - choice:   answer {index:int}, options are the visible labels.
 * - matching: options {left:string[], right:string[]}, answer {map:int[]}
 *             where map[i] is the authored right index for left i. The
 *             client returns one displayed-right index per left item; the
 *             display order is a stable shuffle of the authored rights.
 */
final class Grader
{
    public static function isCorrect(ExerciseItem $item, mixed $response): bool
    {
        $answer = is_array($item->answer) ? $item->answer : [];

        return match ($item->type) {
            'choice' => is_numeric($response)
                && (int) $response === (int) ($answer['index'] ?? -1),
            'matching' => self::matchesPairs($item, $response, $answer),
            default => false,
        };
    }

    public static function displayAnswer(ExerciseItem $item): string
    {
        $answer = is_array($item->answer) ? $item->answer : [];

        return match ($item->type) {
            'choice' => self::optionLabel($item, $answer['index'] ?? null),
            'matching' => self::pairsText($item, $answer['map'] ?? []),
            default => '',
        };
    }

    public static function displayResponse(ExerciseItem $item, mixed $response): string
    {
        return match ($item->type) {
            'choice' => self::optionLabel($item, $response),
            'matching' => is_array($response)
                ? self::pairsText($item, self::authoredMap($item, $response))
                : '',
            default => '',
        };
    }

    /**
     * The displayed right labels, in their stable shuffled order.
     *
     * @return list<string>
     */
    public static function rights(ExerciseItem $item): array
    {
        $right = self::rightLabels($item);
        $order = self::rightOrder($item);

        return array_map(fn (int $index): string => $right[$index] ?? '', $order);
    }

    /**
     * The stable permutation from displayed position to authored index.
     *
     * @return list<int>
     */
    public static function rightOrder(ExerciseItem $item): array
    {
        $right = self::rightLabels($item);
        $count = count($right);

        if ($count < 2) {
            return array_keys($right);
        }

        $indexed = [];
        foreach (array_keys($right) as $index) {
            $indexed[] = ['index' => $index, 'key' => md5($item->id.'|right|'.$index)];
        }

        usort($indexed, fn (array $a, array $b): int => strcmp($a['key'], $b['key']));

        $order = array_map(fn (array $row): int => (int) $row['index'], $indexed);

        // A shuffle identical to the authored order would hand out the key.
        if ($order === array_keys($right)) {
            $first = array_shift($order);
            $order[] = $first;
        }

        return array_values($order);
    }

    /**
     * @param  array<string, mixed>  $answer
     */
    private static function matchesPairs(ExerciseItem $item, mixed $response, array $answer): bool
    {
        $map = is_array($answer['map'] ?? null) ? array_values($answer['map']) : [];
        $right = self::rightLabels($item);

        if ($response === null || ! is_array($response) || count($response) !== count($map)) {
            return false;
        }

        $order = self::rightOrder($item);
        $displayed = self::rights($item);

        foreach (array_values($response) as $left => $chosen) {
            if (! is_numeric($chosen)) {
                return false;
            }

            $chosen = (int) $chosen;
            if (! isset($displayed[$chosen])) {
                return false;
            }

            $authored = $order[$chosen];
            if (! isset($map[$left], $right[$authored]) || (int) $map[$left] !== (int) $authored) {
                return false;
            }
        }

        return true;
    }

    /** @param  mixed  $response  displayed right indexes per left item */
    private static function authoredMap(ExerciseItem $item, mixed $response): array
    {
        if (! is_array($response)) {
            return [];
        }

        $order = self::rightOrder($item);
        $rows = [];

        foreach (array_values($response) as $left => $chosen) {
            if (is_numeric($chosen) && isset($order[(int) $chosen])) {
                $rows[$left] = $order[(int) $chosen];
            }
        }

        return $rows;
    }

    /** @param  list<int>  $map */
    private static function pairsText(ExerciseItem $item, array $map): string
    {
        $left = self::leftLabels($item);
        $right = self::rightLabels($item);
        $rows = [];

        foreach ($left as $index => $label) {
            $target = $right[$map[$index] ?? -1] ?? '';
            $rows[] = $label.' → '.$target;
        }

        return implode("\n", $rows);
    }

    public static function normalize(string $value): string
    {
        $value = str_replace(['’', '‘'], "'", $value);
        $value = mb_strtolower(trim($value));
        $value = preg_replace('/\s+/u', ' ', $value) ?? $value;

        return rtrim($value, '.!?؟,;:');
    }

    /** @return list<string> */
    private static function leftLabels(ExerciseItem $item): array
    {
        $options = is_array($item->options) ? $item->options : [];
        $left = $options['left'] ?? [];

        return is_array($left) ? array_values(array_map('strval', $left)) : [];
    }

    /** @return list<string> */
    private static function rightLabels(ExerciseItem $item): array
    {
        $options = is_array($item->options) ? $item->options : [];
        $right = $options['right'] ?? [];

        return is_array($right) ? array_values(array_map('strval', $right)) : [];
    }

    private static function optionLabel(ExerciseItem $item, mixed $index): string
    {
        if (! is_numeric($index)) {
            return '';
        }

        $options = is_array($item->options) ? array_values($item->options) : [];

        return (string) ($options[(int) $index] ?? '');
    }
}
