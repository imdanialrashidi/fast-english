<?php

namespace App\Support;

use App\Models\Topic;

/**
 * One owner for the topic-card payload (library, saved, Today, landing).
 *
 * The card carries metadata only: never bodies, glossaries, audio URLs, or
 * private paths. `category_name` is present only when the caller loaded the
 * category relation; callers that do not render it pay no query and get
 * null (the type is nullable by design).
 *
 * The interface is the test surface (S3LibraryTest, S4BookmarkTest,
 * R5DailyPlanTest, S8LandingTest): four controllers cross this seam instead
 * of re-spelling the field list and the `/storage/` and reader-URL rules.
 */
final class TopicCard
{
    /**
     * Landing shelf card: the same metadata without a reader URL. The
     * marketing surface never links into the authenticated app, so the
     * guest page must not receive a bounce URL it never renders.
     *
     * @return array{
     *   slug: string,
     *   title_en: string,
     *   cover_url: string|null,
     *   category_name: string|null,
     *   levels: list<string>,
     *   first_level: string|null,
     *   extra_levels: int,
     *   minutes: int
     * }
     */
    public static function preview(Topic $topic): array
    {
        $card = self::for($topic);
        unset($card['reader_url']);

        return $card;
    }

    /**
     * @return array{
     *   slug: string,
     *   title_en: string,
     *   cover_url: string|null,
     *   category_name: string|null,
     *   levels: list<string>,
     *   first_level: string|null,
     *   extra_levels: int,
     *   minutes: int,
     *   reader_url: string
     * }
     */
    public static function for(Topic $topic): array
    {
        $levels = $topic->lessons
            ->pluck('level')
            ->filter()
            ->values()
            ->all();

        return [
            'slug' => (string) $topic->slug,
            'title_en' => (string) $topic->title_en,
            'cover_url' => TopicCover::url($topic->cover_path),
            'category_name' => $topic->relationLoaded('category')
                ? $topic->category?->name_fa
                : null,
            'levels' => $levels,
            'first_level' => $levels[0] ?? null,
            'extra_levels' => max(0, count($levels) - 1),
            'minutes' => (int) $topic->lessons->sum('estimated_minutes'),
            'reader_url' => route('reader.show', $topic),
        ];
    }
}
