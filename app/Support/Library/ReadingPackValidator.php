<?php

namespace App\Support\Library;

/**
 * Structural gate for one content pack. The validator is intentionally
 * stricter than the reader: a bad offset, a missing audio file or a
 * question without a key stops the import instead of publishing content
 * that would highlight the wrong sentence.
 */
final class ReadingPackValidator
{
    private const TRACKS = ['story', 'ielts', 'inside_reading'];

    private const QUESTION_TYPES = ['choice', 'multi_choice', 'tfng', 'ynng', 'completion', 'short_answer'];

    /**
     * @param  array<string, mixed>  $pack
     * @return list<string>
     */
    public static function validate(array $pack, string $directory): array
    {
        $errors = [];

        if (($pack['schema_version'] ?? null) !== '1.0') {
            $errors[] = 'schema_version must be 1.0';
        }

        $track = $pack['track'] ?? null;
        if (! is_string($track) || ! in_array($track, self::TRACKS, true)) {
            $errors[] = 'track must be one of: '.implode(', ', self::TRACKS);
        }

        $node = $pack['node'] ?? null;
        if (! is_array($node) || ! is_string($node['slug'] ?? null)) {
            $errors[] = 'node.slug is required';

            return $errors;
        }

        $slug = (string) $node['slug'];
        if (! preg_match('#^[a-z0-9][a-z0-9-]*(/[a-z0-9-]+)+$#', $slug)) {
            $errors[] = 'node.slug must be a lowercase path such as story/police-tv';
        }
        if (is_string($track) && ! str_starts_with($slug, str_replace('_', '-', $track).'/')) {
            $errors[] = 'node.slug must start with the track';
        }

        $document = $pack['document'] ?? null;
        if (! is_array($document)) {
            $errors[] = 'document is required';

            return $errors;
        }

        $meta = is_array($document['meta'] ?? null) ? $document['meta'] : [];
        if (($meta['kind'] ?? null) !== $track) {
            $errors[] = 'document.meta.kind must equal track';
        }

        $audioFiles = self::files($directory, 'audio');
        $imageFiles = self::files($directory, 'images');

        if ($track === 'ielts') {
            $errors = [...$errors, ...self::validateIelts($document, $audioFiles, $imageFiles)];
        } else {
            $errors = [...$errors, ...self::validateStory($document, $audioFiles, $imageFiles)];
        }

        return array_values(array_unique($errors));
    }

    /**
     * @param  array<string, mixed>  $document
     * @param  list<string>  $audio
     * @param  list<string>  $images
     * @return list<string>
     */
    private static function validateStory(array $document, array $audio, array $images): array
    {
        $errors = [];
        $chapters = $document['chapters'] ?? null;
        if (! is_array($chapters) || $chapters === []) {
            return ['document.chapters must be a non-empty array'];
        }

        $track = (string) ($document['meta']['kind'] ?? 'story');
        // A maximum, never a quota: a page with no teachable word has zero.
        $maxWords = $track === 'inside_reading' ? 10 : 5;
        $sheet = $document['meta']['sheet'] ?? null;
        $columns = is_array($sheet) ? (int) ($sheet['columns'] ?? 2) : 2;
        $rows = is_array($sheet) ? (int) ($sheet['rows'] ?? 3) : 3;
        $panelCount = max(1, $columns * $rows);
        $pageIds = [];
        foreach ($chapters as $chapterIndex => $chapter) {
            if (! is_array($chapter) || ! is_string($chapter['id'] ?? null)) {
                $errors[] = "chapters[$chapterIndex].id is required";

                continue;
            }

            if (isset($chapter['audio']['file'])) {
                $errors = [...$errors, ...self::audioRef((string) $chapter['audio']['file'], $audio, "chapters[$chapterIndex].audio.file")];
            }

            $pages = $chapter['pages'] ?? null;
            if (! is_array($pages) || $pages === []) {
                $errors[] = "chapters[$chapterIndex].pages must be a non-empty array";

                continue;
            }

            foreach ($pages as $pageIndex => $page) {
                $at = "chapters[$chapterIndex].pages[$pageIndex]";
                if (! is_array($page) || ! is_string($page['id'] ?? null)) {
                    $errors[] = "$at.id is required";

                    continue;
                }
                if (isset($pageIds[$page['id']])) {
                    $errors[] = "$at.id is duplicated";
                }
                $pageIds[$page['id']] = true;

                $text = (string) ($page['text_en'] ?? '');
                if (trim($text) === '') {
                    $errors[] = "$at.text_en is empty";
                }
                $length = Utf16::length($text);

                foreach (['words', 'sentences'] as $list) {
                    if (isset($page[$list]) && ! is_array($page[$list])) {
                        $errors[] = "$at.$list must be an array";
                    }
                }

                if (count((array) ($page['words'] ?? [])) > $maxWords) {
                    $errors[] = "$at has more than $maxWords words";
                }

                foreach ((array) ($page['words'] ?? []) as $wordIndex => $word) {
                    if (! is_array($word) || trim((string) ($word['word'] ?? '')) === '') {
                        $errors[] = "$at.words[$wordIndex].word is empty";

                        continue;
                    }
                    if (trim((string) ($word['meaning_fa'] ?? '')) === '' && trim((string) ($word['definition_en'] ?? '')) === '') {
                        $errors[] = "$at.words[$wordIndex] needs meaning_fa or definition_en";
                    }
                    if (isset($word['audio']['file'])) {
                        $errors = [...$errors, ...self::audioRef((string) $word['audio']['file'], $audio, "$at.words[$wordIndex].audio.file")];
                    }
                    if (isset($word['start_utf16'], $word['end_utf16'])) {
                        $errors = [...$errors, ...self::span($text, (int) $word['start_utf16'], (int) $word['end_utf16'], "$at.words[$wordIndex]")];
                    }
                }

                $lastEnd = 0;
                foreach ((array) ($page['sentences'] ?? []) as $sentenceIndex => $sentence) {
                    if (! is_array($sentence)) {
                        $errors[] = "$at.sentences[$sentenceIndex] must be an object";

                        continue;
                    }
                    $start = (int) ($sentence['start_utf16'] ?? -1);
                    $end = (int) ($sentence['end_utf16'] ?? -1);
                    if ($start < 0 || $end <= $start || $end > $length) {
                        $errors[] = "$at.sentences[$sentenceIndex] span is outside the text";
                    }
                    if ($start < $lastEnd) {
                        $errors[] = "$at.sentences[$sentenceIndex] overlaps the previous sentence";
                    }
                    $lastEnd = max($lastEnd, $end);
                    if (isset($sentence['start_ms'], $sentence['end_ms']) && (int) $sentence['end_ms'] <= (int) $sentence['start_ms']) {
                        $errors[] = "$at.sentences[$sentenceIndex] audio range is not increasing";
                    }
                }

                if (isset($page['image']['file'])) {
                    $errors = [...$errors, ...self::imageRef((string) $page['image']['file'], $images, "$at.image.file")];
                }

                if (isset($page['panel_index'])) {
                    $panel = (int) $page['panel_index'];
                    if (! is_array($sheet)) {
                        $errors[] = "$at.panel_index needs meta.sheet";
                    } elseif ($panel < 1 || $panel > $panelCount) {
                        $errors[] = "$at.panel_index is outside the sheet grid";
                    }
                }
            }
        }

        if (is_array($sheet) && isset($sheet['file'])) {
            $errors = [...$errors, ...self::imageRef((string) $sheet['file'], $images, 'meta.sheet.file')];
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $document
     * @param  list<string>  $audio
     * @param  list<string>  $images
     * @return list<string>
     */
    private static function validateIelts(array $document, array $audio, array $images): array
    {
        $errors = [];
        $passage = $document['passage'] ?? null;
        if (! is_array($passage)) {
            return ['document.passage is required'];
        }

        $paragraphs = $passage['paragraphs'] ?? null;
        if (! is_array($paragraphs) || $paragraphs === []) {
            return ['document.passage.paragraphs must be a non-empty array'];
        }

        $pageKeys = [];
        foreach ($paragraphs as $index => $paragraph) {
            $at = "passage.paragraphs[$index]";
            if (! is_array($paragraph) || ! is_string($paragraph['id'] ?? null)) {
                $errors[] = "$at.id is required";

                continue;
            }
            $pageKeys[$paragraph['id']] = true;
            $text = (string) ($paragraph['text_en'] ?? '');
            if (trim($text) === '') {
                $errors[] = "$at.text_en is empty";
            }
            $length = Utf16::length($text);
            if (isset($paragraph['audio']['file'])) {
                $errors = [...$errors, ...self::audioRef((string) $paragraph['audio']['file'], $audio, "$at.audio.file")];
            }
            foreach ((array) ($paragraph['words'] ?? []) as $wordIndex => $word) {
                if (! is_array($word) || trim((string) ($word['word'] ?? '')) === '') {
                    $errors[] = "$at.words[$wordIndex].word is empty";

                    continue;
                }
                if (trim((string) ($word['definition_en'] ?? '')) === '' && trim((string) ($word['meaning_fa'] ?? '')) === '') {
                    $errors[] = "$at.words[$wordIndex] needs definition_en or meaning_fa";
                }
                if (isset($word['audio']['file'])) {
                    $errors = [...$errors, ...self::audioRef((string) $word['audio']['file'], $audio, "$at.words[$wordIndex].audio.file")];
                }
                if (isset($word['start_utf16'], $word['end_utf16'])) {
                    $errors = [...$errors, ...self::span($text, (int) $word['start_utf16'], (int) $word['end_utf16'], "$at.words[$wordIndex]")];
                }
            }
            $lastEnd = 0;
            foreach ((array) ($paragraph['sentences'] ?? []) as $sentenceIndex => $sentence) {
                $start = (int) ($sentence['start_utf16'] ?? -1);
                $end = (int) ($sentence['end_utf16'] ?? -1);
                if ($start < 0 || $end <= $start || $end > $length) {
                    $errors[] = "$at.sentences[$sentenceIndex] span is outside the text";
                }
                if ($start < $lastEnd) {
                    $errors[] = "$at.sentences[$sentenceIndex] overlaps the previous sentence";
                }
                $lastEnd = max($lastEnd, $end);
            }
        }

        $questions = $document['questions'] ?? null;
        if (! is_array($questions) || $questions === []) {
            $errors[] = 'document.questions must be a non-empty array';

            return $errors;
        }

        $numbers = [];
        $ids = [];
        foreach ($questions as $index => $question) {
            $at = "questions[$index]";
            if (! is_array($question) || ! is_string($question['id'] ?? null)) {
                $errors[] = "$at.id is required";

                continue;
            }
            if (isset($ids[$question['id']])) {
                $errors[] = "$at.id is duplicated";
            }
            $ids[$question['id']] = true;

            $number = (int) ($question['number'] ?? 0);
            if ($number <= 0) {
                $errors[] = "$at.number is required";
            } elseif (isset($numbers[$number])) {
                $errors[] = "$at.number is duplicated";
            }
            $numbers[$number] = true;

            $type = (string) ($question['type'] ?? '');
            if (! in_array($type, self::QUESTION_TYPES, true)) {
                $errors[] = "$at.type is not supported";
            }
            if (trim((string) ($question['prompt'] ?? '')) === '') {
                $errors[] = "$at.prompt is empty";
            }
            $hasAnswer = isset($question['answer']) || (is_array($question['accepted'] ?? null) && $question['accepted'] !== []);
            if (! $hasAnswer) {
                $errors[] = "$at needs answer or accepted";
            }

            $evidence = $question['evidence'] ?? null;
            if (is_array($evidence)) {
                $pageKey = (string) ($evidence['page_key'] ?? $evidence['paragraph_id'] ?? '');
                if ($pageKey === '' || ! isset($pageKeys[$pageKey])) {
                    $errors[] = "$at.evidence.page_key does not match a paragraph";
                }
                $paragraph = null;
                foreach ($paragraphs as $candidate) {
                    if ((string) ($candidate['id'] ?? '') === $pageKey) {
                        $paragraph = $candidate;
                        break;
                    }
                }
                if ($paragraph !== null) {
                    $errors = [...$errors, ...self::span(
                        (string) ($paragraph['text_en'] ?? ''),
                        (int) ($evidence['start_utf16'] ?? 0),
                        (int) ($evidence['end_utf16'] ?? 0),
                        "$at.evidence",
                    )];
                }
            }
        }

        return $errors;
    }

    /** @return list<string> */
    private static function audioRef(string $file, array $files, string $at): array
    {
        return self::fileRef($file, $files, $at, 'audio');
    }

    /** @return list<string> */
    private static function imageRef(string $file, array $files, string $at): array
    {
        return self::fileRef($file, $files, $at, 'images');
    }

    /** @return list<string> */
    private static function fileRef(string $file, array $files, string $at, string $kind): array
    {
        if (! preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]*$/', $file)) {
            return ["$at has an unsafe filename"];
        }
        if (! in_array($file, $files, true)) {
            return ["$at references a missing file in $kind/"];
        }

        return [];
    }

    /** @return list<string> */
    private static function span(string $text, int $start, int $end, string $at): array
    {
        $length = Utf16::length($text);
        if ($start < 0 || $end <= $start || $end > $length) {
            return ["$at span is outside the text"];
        }

        return [];
    }

    /** @return list<string> */
    private static function files(string $directory, string $folder): array
    {
        $path = $directory.'/'.$folder;
        if (! is_dir($path)) {
            return [];
        }

        $files = [];
        foreach (scandir($path) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            if (is_file($path.'/'.$entry)) {
                $files[] = $entry;
            }
        }

        return $files;
    }
}
