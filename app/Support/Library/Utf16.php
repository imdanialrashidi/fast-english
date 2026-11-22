<?php

namespace App\Support\Library;

/**
 * UTF-16 offsets are the contract between the content pipeline and the
 * browser (JavaScript strings are UTF-16). PHP keeps the text as UTF-8 and
 * only uses these helpers for validation, so a highlight can never drift by
 * counting bytes instead of code units.
 */
final class Utf16
{
    public static function length(string $text): int
    {
        return intdiv(strlen((string) mb_convert_encoding($text, 'UTF-16LE', 'UTF-8')), 2);
    }

    public static function slice(string $text, int $start, int $end): string
    {
        $utf16 = (string) mb_convert_encoding($text, 'UTF-16LE', 'UTF-8');
        $chunk = substr($utf16, $start * 2, max(0, $end - $start) * 2);

        return (string) mb_convert_encoding($chunk, 'UTF-8', 'UTF-16LE');
    }
}
