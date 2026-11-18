<?php

namespace App\Support\Flashcards;

/**
 * One MPEG-audio sniff shared by the dataset importer and the word-audio
 * importer. Extension and browser MIME are never trusted; bytes are.
 */
final class Mp3
{
    public static function looksLike(string $bytes): bool
    {
        if (strlen($bytes) < 128) {
            return false;
        }

        if (str_starts_with($bytes, 'ID3')) {
            return true;
        }

        $first = ord($bytes[0]);

        return $first === 0xFF && (ord($bytes[1]) & 0xE0) === 0xE0;
    }
}
