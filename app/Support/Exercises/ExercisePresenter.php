<?php

namespace App\Support\Exercises;

use App\Models\ExerciseItem;
use App\Models\ExerciseTopic;

/**
 * Allowlist payloads for the grammar-first unit page. Before a question is
 * answered the payload carries no answer key and no explanation; after the
 * first answer it carries that stored result, the key and the Persian
 * feedback for the option the learner chose.
 */
final class ExercisePresenter
{
    /** @return array<string, mixed> */
    public static function topic(ExerciseTopic $topic): array
    {
        return [
            'id' => (int) $topic->id,
            'key' => (string) $topic->key,
            'title_en' => (string) $topic->title_en,
            'title_fa' => (string) $topic->title_fa,
            'use_fa' => (string) $topic->use_fa,
            'formulas' => is_array($topic->formulas) ? $topic->formulas : [],
            'examples' => is_array($topic->examples) ? $topic->examples : [],
            'notes_fa' => $topic->notes_fa,
        ];
    }

    /**
     * @param  array{response: mixed, is_correct: bool, answered_at: ?string}|null  $answered
     * @return array<string, mixed>
     */
    public static function item(ExerciseItem $item, ?array $answered = null): array
    {
        $options = is_array($item->options) ? $item->options : [];
        $isMatching = $item->type === 'matching';

        $row = [
            'id' => (int) $item->id,
            'topic_key' => $item->topic?->key,
            'type' => (string) $item->type,
            'prompt' => (string) $item->prompt,
            'position' => (int) $item->position,
            'answered' => $answered !== null,
        ];

        if ($isMatching) {
            $row['left'] = array_values(array_map('strval', $options['left'] ?? []));
            $row['rights'] = Grader::rights($item);
        } else {
            $row['options'] = array_values(array_map('strval', $options));
        }

        if ($answered !== null) {
            $response = $answered['response'];
            $feedback = is_array($item->feedback) ? $item->feedback : [];

            $row['result'] = [
                'is_correct' => $answered['is_correct'],
                'response' => $response,
                'correct' => Grader::displayAnswer($item),
                'explanation_fa' => $item->explanation_fa,
                'feedback_fa' => self::feedbackFor($item, $response, $feedback),
                'answered_at' => $answered['answered_at'],
            ];
        }

        return $row;
    }

    /**
     * @param  array<string, mixed>  $feedback
     */
    private static function feedbackFor(ExerciseItem $item, mixed $response, array $feedback): ?string
    {
        if ($item->type !== 'choice' || ! is_numeric($response)) {
            return null;
        }

        $text = $feedback[(string) (int) $response] ?? null;

        return is_string($text) && $text !== '' ? $text : null;
    }
}
