<?php

namespace App\Mcp;

use App\Actions\PublishLesson;
use App\Models\Category;
use App\Models\Lesson;
use App\Models\Topic;
use App\Support\AudioFile;
use App\Support\TopicCover;

/**
 * One owner for the JSON shapes the content MCP server returns.
 *
 * Only staff-authorized agents ever see these payloads, but the private
 * audio path still never leaves the server: summaries expose readiness and
 * the revision, not a filesystem path. Detail shapes add the body,
 * glossary, private license note, and publish preconditions so an agent
 * can correct a draft without guessing.
 */
final class ContentPayload
{
    /** @return array<string, mixed> */
    public static function category(Category $category): array
    {
        return [
            'id' => (int) $category->id,
            'slug' => (string) $category->slug,
            'name_fa' => (string) $category->name_fa,
            'display_order' => (int) $category->display_order,
            'is_active' => (bool) $category->is_active,
        ];
    }

    /** @return array<string, mixed> */
    public static function topic(Topic $topic, bool $detail = false): array
    {
        $lessons = $topic->relationLoaded('lessons')
            ? $topic->lessons
            : $topic->lessons()->get();

        $payload = [
            'id' => (int) $topic->id,
            'slug' => (string) $topic->slug,
            'title_en' => (string) $topic->title_en,
            'summary_public' => $topic->summary_public,
            'status' => (string) $topic->status,
            'category' => $topic->category !== null ? self::category($topic->category) : null,
            'cover_url' => TopicCover::url($topic->cover_path),
            'published_at' => $topic->published_at?->toIso8601String(),
            'lessons' => $lessons
                ->sortBy('level')
                ->map(fn (Lesson $lesson): array => self::lesson($lesson, $detail))
                ->values()
                ->all(),
        ];

        if ($detail) {
            $payload['source_note'] = $topic->source_note;
            $payload['publish_problems'] = PublishLesson::topicProblems($topic);
        }

        return $payload;
    }

    /** @return array<string, mixed> */
    public static function lesson(Lesson $lesson, bool $detail = false): array
    {
        $payload = [
            'id' => (int) $lesson->id,
            'topic_id' => (int) $lesson->topic_id,
            'level' => (string) $lesson->level,
            'title_en' => (string) $lesson->title_en,
            'status' => (string) $lesson->status,
            'audio_revision' => (int) $lesson->audio_revision,
            'audio_ready' => AudioFile::problem($lesson->audio_path) === null,
            'duration_seconds' => (int) $lesson->duration_seconds,
            'estimated_minutes' => (int) $lesson->estimated_minutes,
            'is_public_sample' => (bool) $lesson->is_public_sample,
            'reviewed' => $lesson->reviewed_by !== null && $lesson->reviewed_at !== null,
            'published_at' => $lesson->published_at?->toIso8601String(),
        ];

        if ($detail) {
            $payload['body_en'] = (string) $lesson->body_en;
            $payload['glossary'] = $lesson->glossary ?? [];
            $payload['review'] = [
                'reviewed_by' => $lesson->reviewed_by !== null ? (int) $lesson->reviewed_by : null,
                'reviewed_at' => $lesson->reviewed_at?->toIso8601String(),
            ];
            $payload['publish_problems'] = PublishLesson::lessonProblems($lesson);
        }

        return $payload;
    }
}
