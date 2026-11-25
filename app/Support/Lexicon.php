<?php

namespace App\Support;

use App\Support\Library\Utf16;

/**
 * One read-only lexicon for the reading surfaces.
 *
 * `resources/data/lexicon.json` maps a base word to its CEFR band, a short
 * Persian gloss, a short English definition, a part of speech, and an
 * optional simple synonym. The file is content data, not learner state; the
 * enrichment pipeline regenerates it and the runtime only reads it.
 *
 * The class is the single seam for "is this word B2 or above?" so TED,
 * IELTS, Inside Reading, and the content pipeline agree. Inflections are
 * resolved with a small suffix/lemma fallback instead of storing a row for
 * every surface form.
 */
final class Lexicon
{
    /** @var array<string, array{level: string, fa: string, en: string|null, pos: string|null, syn: string|null}>|null */
    private static ?array $entries = null;

    /** @var array<string, true>|null */
    private static ?array $audioKeys = null;

    /** @return array<string, array{level: string, fa: string, en: string|null, pos: string|null, syn: string|null}> */
    public static function entries(): array
    {
        if (self::$entries !== null) {
            return self::$entries;
        }

        $path = resource_path('data/lexicon.json');
        if (! is_file($path)) {
            return self::$entries = [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        if (! is_array($decoded)) {
            return self::$entries = [];
        }

        $clean = [];
        foreach ($decoded as $word => $entry) {
            if (! is_string($word) || ! is_array($entry)) {
                continue;
            }

            $level = strtoupper((string) ($entry['level'] ?? ''));
            if (! in_array($level, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], true)) {
                continue;
            }

            $fa = trim((string) ($entry['fa'] ?? ''));
            if ($fa === '') {
                continue;
            }

            $clean[mb_strtolower(trim($word))] = [
                'level' => $level,
                'fa' => $fa,
                'en' => self::nullable($entry['en'] ?? null),
                'pos' => self::nullable($entry['pos'] ?? null),
                'syn' => self::nullable($entry['syn'] ?? null),
            ];
        }

        return self::$entries = $clean;
    }

    /**
     * @return array{level: string, fa: string, en: string|null, pos: string|null, syn: string|null}|null
     */
    public static function entry(string $word): ?array
    {
        $entries = self::entries();
        foreach (self::candidates($word) as $candidate) {
            if (isset($entries[$candidate])) {
                return $entries[$candidate];
            }
        }

        return null;
    }

    public static function isB2OrAbove(string $word): bool
    {
        $entry = self::entry($word);

        return $entry !== null && in_array($entry['level'], ['B2', 'C1', 'C2'], true);
    }

    /**
     * Annotate one paragraph. Offsets are UTF-16 code units (the browser's
     * string indexing contract); order is the order of appearance.
     *
     * @param  list<array{start_utf16?: int|null}>  $existing
     * @return list<array{word: string, base: string, level: string, meaning_fa: string, definition_en: string|null, part_of_speech: string|null, synonym: string|null, start_utf16: int, end_utf16: int}>
     */
    public static function annotate(string $text, ?int $limit = null, array $existing = []): array
    {
        $taken = [];
        foreach ($existing as $row) {
            if (isset($row['start_utf16']) && is_int($row['start_utf16'])) {
                $taken[$row['start_utf16']] = true;
            }
        }

        $matches = [];
        if (preg_match_all("/[A-Za-z][A-Za-z'’\\-]*/u", $text, $all, PREG_OFFSET_CAPTURE) === false) {
            return [];
        }

        $byteCursor = 0;
        $utf16Cursor = 0;
        $seenOffsets = [];

        foreach ($all[0] as [$surface, $byteOffset]) {
            $utf16Cursor += Utf16::length(substr($text, $byteCursor, $byteOffset - $byteCursor));
            $byteCursor = $byteOffset;
            $start = $utf16Cursor;
            $end = $start + Utf16::length($surface);
            $utf16Cursor = $end;

            if (isset($taken[$start]) || isset($seenOffsets[$start])) {
                continue;
            }

            $entry = self::entry($surface);
            if ($entry === null || ! in_array($entry['level'], ['B2', 'C1', 'C2'], true)) {
                continue;
            }

            $seenOffsets[$start] = true;
            $matches[] = [
                'word' => $surface,
                'base' => self::baseFor($surface) ?? mb_strtolower($surface),
                'level' => $entry['level'],
                'meaning_fa' => $entry['fa'],
                'definition_en' => $entry['en'],
                'part_of_speech' => $entry['pos'],
                'synonym' => $entry['syn'],
                'start_utf16' => $start,
                'end_utf16' => $end,
            ];
        }

        usort($matches, fn (array $a, array $b): int => $a['start_utf16'] <=> $b['start_utf16']);

        if ($limit !== null && $limit > 0) {
            $matches = array_slice($matches, 0, $limit);
        }

        return array_values($matches);
    }

    /**
     * Surface form => entry map for the TED reader. The client tokenises
     * the paragraph and looks up the exact lowercase surface, so this map
     * is the only vocabulary data that travels with a talk.
     *
     * @return array<string, array{level: string, fa: string, en: string|null, pos: string|null, syn: string|null, audio_url: string|null}>
     */
    public static function mapFor(string $text): array
    {
        $map = [];
        if (preg_match_all("/[A-Za-z][A-Za-z'’\\-]*/u", $text, $all) === false) {
            return [];
        }

        foreach ($all[0] as $surface) {
            $key = mb_strtolower($surface);
            if (isset($map[$key])) {
                continue;
            }

            $entry = self::entry($surface);
            if ($entry === null || ! in_array($entry['level'], ['B2', 'C1', 'C2'], true)) {
                continue;
            }

            $map[$key] = $entry + [
                'audio_url' => self::hasAudio($surface)
                    ? route('media.word.audio.key', ['word' => $surface])
                    : null,
            ];
        }

        return $map;
    }

    /**
     * A word has a shareable pronunciation clip when the generated manifest
     * lists its key. The manifest is content data produced by the Woof
     * batch; a missing clip is never advertised as playable.
     */
    public static function hasAudio(string $word): bool
    {
        if (self::$audioKeys === null) {
            $path = resource_path('data/word-audio-keys.json');
            if (! is_file($path)) {
                self::$audioKeys = [];

                return false;
            }

            $decoded = json_decode((string) file_get_contents($path), true);
            $keys = [];
            if (is_array($decoded)) {
                foreach ($decoded as $key) {
                    if (is_string($key) && $key !== '') {
                        $keys[mb_strtolower($key)] = true;
                    }
                }
            }
            self::$audioKeys = $keys;
        }

        foreach (self::candidates($word) as $candidate) {
            if (isset(self::$audioKeys[$candidate])) {
                return true;
            }
        }

        return false;
    }

    /** @return list<string> */
    public static function candidates(string $word): array
    {
        $word = mb_strtolower(trim($word));
        $word = (string) preg_replace("/['’]s$/u", '', $word);
        if ($word === '') {
            return [];
        }

        $candidates = [$word];
        $add = function (string $candidate) use (&$candidates): void {
            $candidate = trim($candidate);
            if ($candidate !== '' && ! in_array($candidate, $candidates, true)) {
                $candidates[] = $candidate;
            }
        };

        if (str_ends_with($word, 'ies') && strlen($word) > 3) {
            $add(substr($word, 0, -3).'y');
        }
        if (str_ends_with($word, 'ied') && strlen($word) > 3) {
            $add(substr($word, 0, -3).'y');
        }
        foreach (['es', 's', 'ed', 'ing', 'er', 'est', 'ly'] as $suffix) {
            if (str_ends_with($word, $suffix) && strlen($word) > strlen($suffix) + 1) {
                $stem = substr($word, 0, -strlen($suffix));
                $add($stem);
                $add($stem.'e');
                if (strlen($stem) > 1 && $stem[-1] === $stem[-2]) {
                    $add(substr($stem, 0, -1));
                }
            }
        }

        return $candidates;
    }

    private static function baseFor(string $surface): ?string
    {
        $entries = self::entries();
        foreach (self::candidates($surface) as $candidate) {
            if (isset($entries[$candidate])) {
                return $candidate;
            }
        }

        return null;
    }

    private static function nullable(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : $text;
    }
}
