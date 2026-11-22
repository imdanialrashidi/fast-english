<?php

namespace App\Support\Library;

/**
 * Deterministic IELTS answer checking. The app never sends the key to the
 * browser before submission; this grader runs on the stored document and
 * returns the explanation plus the evidence span the reader highlights.
 */
final class ReadingGrader
{
    /**
     * @param  array<string, mixed>  $document
     * @param  array<string, mixed>  $answers
     * @return array<string, mixed>
     */
    public static function publicResult(array $document, array $answers): array
    {
        $questions = self::questions($document);
        $items = [];
        $score = 0;
        $total = 0;

        foreach ($questions as $question) {
            $id = (string) ($question['id'] ?? '');
            $weight = max(1, (int) ($question['weight'] ?? 1));
            $total += $weight;
            $given = $answers[$id] ?? null;
            $correct = self::isCorrect($question, $given);
            if ($correct) {
                $score += $weight;
            }

            $items[] = [
                'id' => $id,
                'number' => isset($question['number']) ? (int) $question['number'] : null,
                'number_end' => isset($question['number_end']) ? (int) $question['number_end'] : null,
                'weight' => $weight,
                'is_correct' => $correct,
                'given' => $given,
                'correct' => self::correctLabel($question),
                'explanation_fa' => $question['explanation_fa'] ?? null,
                'why_wrong_fa' => $question['why_wrong_fa'] ?? null,
                'evidence' => self::evidence($question),
            ];
        }

        return [
            'score' => $score,
            'total' => $total,
            'items' => $items,
        ];
    }

    /**
     * @param  array<string, mixed>  $document
     * @return list<array<string, mixed>>
     */
    private static function questions(array $document): array
    {
        if (is_array($document['questions'] ?? null)) {
            return array_values($document['questions']);
        }

        if (is_array($document['passage']['questions'] ?? null)) {
            return array_values($document['passage']['questions']);
        }

        return [];
    }

    /** @param  array<string, mixed>  $question */
    private static function isCorrect(array $question, mixed $given): bool
    {
        if ($given === null || $given === '') {
            return false;
        }

        $type = (string) ($question['type'] ?? 'choice');

        if ($type === 'multi_choice') {
            $expected = is_array($question['answer'] ?? null) ? $question['answer'] : [];
            $actual = is_array($given) ? $given : [$given];
            $expected = array_map([self::class, 'normalise'], $expected);
            $actual = array_map([self::class, 'normalise'], $actual);
            sort($expected);
            sort($actual);

            return $expected === $actual;
        }

        $actual = self::normalise(is_array($given) ? (string) reset($given) : (string) $given);

        $accepted = [];
        if (isset($question['answer'])) {
            $accepted[] = $question['answer'];
        }
        if (is_array($question['accepted'] ?? null)) {
            $accepted = [...$accepted, ...$question['accepted']];
        }

        foreach ($accepted as $candidate) {
            if (! is_string($candidate)) {
                continue;
            }
            if (self::normalise($candidate) === $actual) {
                return true;
            }
        }

        return false;
    }

    /** @param  array<string, mixed>  $question */
    private static function correctLabel(array $question): string
    {
        $answer = $question['answer'] ?? null;

        if (is_array($answer)) {
            return implode(', ', array_map(static fn ($value): string => (string) $value, $answer));
        }

        $value = (string) $answer;
        $options = is_array($question['options'] ?? null) ? $question['options'] : [];
        foreach ($options as $option) {
            if (is_array($option) && (string) ($option['key'] ?? '') === $value) {
                return (string) ($option['label'] ?? $value);
            }
        }

        return $value;
    }

    /** @param  array<string, mixed>  $question */
    private static function evidence(array $question): ?array
    {
        $evidence = $question['evidence'] ?? null;
        if (! is_array($evidence)) {
            return null;
        }

        return [
            'page_key' => (string) ($evidence['page_key'] ?? $evidence['paragraph_id'] ?? $evidence['page_id'] ?? ''),
            'start_utf16' => (int) ($evidence['start_utf16'] ?? 0),
            'end_utf16' => (int) ($evidence['end_utf16'] ?? 0),
        ];
    }

    private static function normalise(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $value = str_replace(["\u{2019}", "\u{2018}", '`'], "'", $value);
        $value = (string) preg_replace('/\s+/u', ' ', $value);
        $value = (string) preg_replace('/[.!?,;:]+$/u', '', $value);

        return match ($value) {
            't' => 'true',
            'f' => 'false',
            'ng' => 'not given',
            'y' => 'yes',
            'n' => 'no',
            default => $value,
        };
    }
}
