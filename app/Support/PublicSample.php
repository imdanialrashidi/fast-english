<?php

namespace App\Support;

use App\Models\Lesson;

/**
 * One eligibility check for the public sample: published lesson, published
 * topic, and the `is_public_sample` flag. Shared props, trust copy, and
 * the sitemap must agree on whether the free sample exists.
 */
final class PublicSample
{
    public static function exists(): bool
    {
        return Lesson::query()
            ->where('is_public_sample', true)
            ->where('status', 'published')
            ->whereHas('topic', fn ($topic) => $topic->where('status', 'published'))
            ->exists();
    }
}
