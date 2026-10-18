<?php

namespace App\Support;

use App\Models\Lesson;

/**
 * Reading preparation (READ-01/02/03): one deep module behind the
 * question "what does the reader render for this lesson?".
 *
 * Absorbs the sentence split, the plain-reader paragraph fallback, the
 * cue-usability triple-check (revision pin + count match), and the
 * glossary allowlist mapping — previously pasted across the learner
 * reader and the public sample controllers.
 *
 * The interface is the test surface (see D5ReaderPreparationTest):
 * prepared() returns the exact prop shape both pages render.
 */
final class Reading
{
    /**
     * @return array{
     *   sentences: list<string>,
     *   paragraphs: list<string>,
     *   cues: list<array{start_seconds: float, end_seconds: float}>,
     *   cuesUsable: bool,
     *   glossary: list<array{word: string, meaning_fa: string, example_en: ?string}>
     * }
     */
    public static function prepared(Lesson $lesson): array
    {
        $sentences = Sentences::split((string) $lesson->body_en);

        $cues = is_array($lesson->audio_cues) ? $lesson->audio_cues : [];
        $cuesUsable = $cues !== []
            && (int) ($lesson->audio_cues_revision ?? 0) === (int) $lesson->audio_revision
            && count($cues) === count($sentences);
        if (! $cuesUsable) {
            $cues = [];
        }

        $paragraphs = [];
        foreach (preg_split('/\R{2,}/', (string) $lesson->body_en) ?: [] as $paragraph) {
            $line = trim((string) preg_replace('/\s+/', ' ', $paragraph));
            if ($line !== '') {
                $paragraphs[] = $line;
            }
        }

        return [
            'sentences' => $sentences,
            'paragraphs' => $paragraphs,
            'cues' => array_values(array_map(fn ($cue) => [
                'start_seconds' => (float) ($cue['start_seconds'] ?? 0),
                'end_seconds' => (float) ($cue['end_seconds'] ?? 0),
            ], $cues)),
            'cuesUsable' => $cuesUsable,
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
