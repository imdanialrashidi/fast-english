<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * One validator for TED reading content.
 *
 * `segments` is the sentence stream: paragraphs of {t: milliseconds, text}.
 * Times must be integers and never move backwards, because the reader uses
 * them as the single sync source. `words` is the small pre-teaching gloss
 * (at most ten entries) with an English gloss and an optional Persian
 * equivalent for technical vocabulary.
 */
final class TedContent
{
    public const MAX_WORDS = 10;

    /**
     * @return list<list<array{t: int, text: string}>>
     */
    public static function segments(mixed $value): array
    {
        if (! is_array($value) || $value === []) {
            throw new InvalidArgumentException('TED segments must be a non-empty array.');
        }

        $lastTime = -1;
        $paragraphs = [];

        foreach ($value as $paragraph) {
            if (! is_array($paragraph) || $paragraph === []) {
                throw new InvalidArgumentException('TED segments contain an empty paragraph.');
            }

            $clean = [];
            foreach ($paragraph as $sentence) {
                if (! is_array($sentence)) {
                    throw new InvalidArgumentException('TED segment must be an object.');
                }

                $time = filter_var($sentence['t'] ?? null, FILTER_VALIDATE_INT);
                $text = trim((string) ($sentence['text'] ?? ''));

                if ($time === false || $time < 0) {
                    throw new InvalidArgumentException('TED segment time must be a non-negative integer.');
                }
                if ($text === '' || mb_strlen($text) > 600) {
                    throw new InvalidArgumentException('TED segment text must be 1-600 characters.');
                }
                if ($time < $lastTime) {
                    throw new InvalidArgumentException('TED segment times must not move backwards.');
                }

                $lastTime = $time;
                $clean[] = ['t' => $time, 'text' => $text];
            }

            $paragraphs[] = $clean;
        }

        return $paragraphs;
    }

    /**
     * @return list<array{word: string, en: string, fa: string|null}>
     */
    public static function words(mixed $value): array
    {
        if (! is_array($value) || count($value) > self::MAX_WORDS) {
            throw new InvalidArgumentException('TED words must be an array of at most '.self::MAX_WORDS.' entries.');
        }

        $seen = [];
        $clean = [];

        foreach ($value as $entry) {
            if (! is_array($entry)) {
                throw new InvalidArgumentException('TED word entry must be an object.');
            }

            $word = trim((string) ($entry['word'] ?? ''));
            $en = trim((string) ($entry['en'] ?? ''));
            $fa = trim((string) ($entry['fa'] ?? ''));

            if ($word === '' || $en === '') {
                throw new InvalidArgumentException('TED word needs both `word` and `en`.');
            }
            if (mb_strlen($word) > 80 || mb_strlen($en) > 120 || mb_strlen($fa) > 120) {
                throw new InvalidArgumentException('TED word entry is too long.');
            }

            $key = mb_strtolower($word);
            if (isset($seen[$key])) {
                throw new InvalidArgumentException("Duplicate TED word: {$word}");
            }
            $seen[$key] = true;

            $clean[] = [
                'word' => $word,
                'en' => $en,
                'fa' => $fa === '' ? null : $fa,
            ];
        }

        return $clean;
    }
}
