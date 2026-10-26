<?php

namespace App\Support;

use App\Models\Lesson;

/**
 * Reading preparation (READ-01/02): one deep module behind the question
 * "what does the reader render for this lesson?".
 *
 * Returns the plain paragraph split and the glossary allowlist shared by
 * the learner reader and the public sample. Sentence-level audio cueing
 * was removed by owner direction (2026-10-21); audio and text no longer
 * synchronise, highlight, or seek line by line.
 *
 * The interface is the test surface (see D5ReaderPreparationTest):
 * prepared() returns the exact prop shape both pages render.
 */
final class Reading
{
    /**
     * @return array{
     *   paragraphs: list<string>,
     *   glossary: list<array{word: string, meaning_fa: string, example_en: ?string}>
     * }
     */
    public static function prepared(Lesson $lesson): array
    {
        $paragraphs = [];
        foreach (preg_split('/\R{2,}/', (string) $lesson->body_en) ?: [] as $paragraph) {
            $line = trim((string) preg_replace('/\s+/', ' ', $paragraph));
            if ($line !== '') {
                $paragraphs[] = $line;
            }
        }

        return [
            'paragraphs' => $paragraphs,
            'glossary' => array_values(array_map(fn ($entry) => [
                'word' => (string) ($entry['word'] ?? ''),
                'meaning_fa' => (string) ($entry['meaning_fa'] ?? ''),
                'example_en' => isset($entry['example_en']) && $entry['example_en'] !== ''
                    ? (string) $entry['example_en']
                    : null,
            ], is_array($lesson->glossary) ? $lesson->glossary : [])),
        ];
    }

    /**
     * Glossary reuse for the vocabulary notebook: the first lesson entry
     * matching the word (case-insensitive), or null. Previously
     * controller-local in VocabularyController::store.
     *
     * @return array{meaning_fa: string, example_en: string}|null
     */
    public static function glossaryMatch(Lesson $lesson, string $word): ?array
    {
        if (! is_array($lesson->glossary)) {
            return null;
        }

        foreach ($lesson->glossary as $entry) {
            if (mb_strtolower(trim((string) ($entry['word'] ?? ''))) === mb_strtolower(trim($word))) {
                return [
                    'meaning_fa' => trim((string) ($entry['meaning_fa'] ?? '')),
                    'example_en' => trim((string) ($entry['example_en'] ?? '')),
                ];
            }
        }

        return null;
    }
}
