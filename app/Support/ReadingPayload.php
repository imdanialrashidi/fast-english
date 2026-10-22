<?php

namespace App\Support;

use App\Models\Lesson;

/**
 * One owner for the reading payload shared by the learner reader and the
 * public sample (READ-01/02).
 *
 * The topic/lesson allowlist, the audio URL, and the Reading::prepared
 * content travel together so the two pages cannot drift field by field.
 * Page-specific state (resume position, bookmark, guest flag, available
 * levels) is added by the controller at the edge.
 *
 * `preview()` is the landing hero slice: the same prepared paragraphs and
 * the public sample's own stream URL. Audio plays normally; there is no
 * sentence-level synchronisation (owner direction, 2026-10-21).
 */
final class ReadingPayload
{
    /**
     * @return array{
     *   topic: array{id: int, slug: string, title_en: string, summary_public: string|null, cover_url: string|null},
     *   lesson: array{id: int, title_en: string, level: string, estimated_minutes: int, duration_seconds: int, audio_revision: int, audio_url: string},
     *   paragraphs: list<string>,
     *   glossary: list<array{word: string, meaning_fa: string, example_en: string|null}>
     * }
     */
    public static function for(Lesson $lesson): array
    {
        $prepared = Reading::prepared($lesson);
        $topic = $lesson->topic;

        return [
            'topic' => [
                'id' => (int) $topic->id,
                'slug' => (string) $topic->slug,
                'title_en' => (string) $topic->title_en,
                'summary_public' => $topic->summary_public,
                'cover_url' => TopicCover::url($topic->cover_path),
            ],
            'lesson' => [
                'id' => (int) $lesson->id,
                'title_en' => (string) $lesson->title_en,
                'level' => (string) $lesson->level,
                'estimated_minutes' => (int) $lesson->estimated_minutes,
                'duration_seconds' => (int) $lesson->duration_seconds,
                'audio_revision' => (int) $lesson->audio_revision,
                'audio_url' => route('media.lesson.audio', $lesson),
            ],
            'paragraphs' => $prepared['paragraphs'],
            'glossary' => $prepared['glossary'],
        ];
    }

    /**
     * Landing hero preview: the sample's real opening paragraphs.
     *
     * @return array{
     *   sample: array{title_en: string, level: string, cover_url: string|null, reader_url: string}|null,
     *   sampleParagraphs: list<string>,
     *   sampleAudioUrl: string|null
     * }
     */
    public static function preview(?Lesson $lesson, int $limit = 2): array
    {
        if ($lesson === null) {
            return [
                'sample' => null,
                'sampleParagraphs' => [],
                'sampleAudioUrl' => null,
            ];
        }

        $prepared = Reading::prepared($lesson);
        $paragraphs = array_slice($prepared['paragraphs'], 0, $limit);

        return [
            'sample' => [
                'title_en' => (string) $lesson->title_en,
                'level' => (string) $lesson->level,
                'cover_url' => TopicCover::url($lesson->topic->cover_path),
                'reader_url' => route('sample', [
                    'topic' => $lesson->topic->slug,
                    'level' => $lesson->level,
                ]),
            ],
            'sampleParagraphs' => $paragraphs,
            'sampleAudioUrl' => route('media.lesson.audio', $lesson),
        ];
    }
}
