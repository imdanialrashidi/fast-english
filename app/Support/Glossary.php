<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

/**
 * S3 glossary owner (scope §9.2, READ-02): validated JSON with no entry
 * count limit (owner clarification 2026-11-15: an article may carry as
 * many key words as it needs). Each entry requires `word` (English) and
 * `meaning_fa`; `example_en` is optional. No dictionary API, no user word
 * lists.
 *
 * Every Lesson write normalizes through here (model hook), and the
 * Filament form validates with the same rules — one definition, no copies.
 */
final class Glossary
{
    public const MAX_WORD_LENGTH = 120;

    public const MAX_MEANING_LENGTH = 500;

    public const MAX_EXAMPLE_LENGTH = 500;

    /**
     * @param  mixed  $value  decoded JSON (array) or null
     * @return list<array{word: string, meaning_fa: string, example_en: ?string}>
     *
     * @throws ValidationException
     */
    public static function validate(mixed $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (! is_array($value) || array_is_list($value) === false) {
            throw ValidationException::withMessages([
                'glossary' => 'The glossary must be a list of entries.',
            ]);
        }

        $normalized = [];
        foreach (array_values($value) as $index => $entry) {
            $normalized[] = self::validateEntry($entry, $index);
        }

        return $normalized;
    }

    /**
     * @return array{word: string, meaning_fa: string, example_en: ?string}
     *
     * @throws ValidationException
     */
    private static function validateEntry(mixed $entry, int $index): array
    {
        $field = "glossary.{$index}";

        if (! is_array($entry)) {
            throw ValidationException::withMessages([
                $field => 'Each glossary entry must define a word and its Persian meaning.',
            ]);
        }

        $word = isset($entry['word']) ? trim((string) $entry['word']) : '';
        $meaning = isset($entry['meaning_fa']) ? trim((string) $entry['meaning_fa']) : '';
        $example = array_key_exists('example_en', $entry) && $entry['example_en'] !== null
            ? trim((string) $entry['example_en'])
            : null;
        if ($example === '') {
            $example = null;
        }

        $errors = [];
        if ($word === '') {
            $errors["{$field}.word"] = 'Each glossary entry requires a word.';
        } elseif (mb_strlen($word) > self::MAX_WORD_LENGTH) {
            $errors["{$field}.word"] = 'The glossary word must not exceed '.self::MAX_WORD_LENGTH.' characters.';
        }
        if ($meaning === '') {
            $errors["{$field}.meaning_fa"] = 'Each glossary entry requires a Persian meaning.';
        } elseif (mb_strlen($meaning) > self::MAX_MEANING_LENGTH) {
            $errors["{$field}.meaning_fa"] = 'The glossary meaning must not exceed '.self::MAX_MEANING_LENGTH.' characters.';
        }
        if ($example !== null && mb_strlen($example) > self::MAX_EXAMPLE_LENGTH) {
            $errors["{$field}.example_en"] = 'The glossary example must not exceed '.self::MAX_EXAMPLE_LENGTH.' characters.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return ['word' => $word, 'meaning_fa' => $meaning, 'example_en' => $example];
    }
}
