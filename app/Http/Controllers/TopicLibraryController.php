<?php

namespace App\Http\Controllers;

use App\Actions\PublishLesson;
use App\Models\Category;
use App\Models\Topic;
use App\Support\Levels;
use App\Support\TopicCard;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * S3 topic library (scope §17.2) + M1 Inertia transport (ADR-0002).
 *
 * One result per topic, 12 per page, browse state (level, category,
 * query, page) in the URL query string so reload, back/forward, and
 * sharing preserve the filter state. Only published topics with at
 * least one published lesson ever appear; drafts, archived lessons,
 * and lesson-less topics are excluded at the query level.
 *
 * Props are an allowlist — metadata only, never bodies, glossaries,
 * audio URLs, amounts, or private paths (the S1 reader policy still
 * guards the full content; see S5PrivacyTest).
 */
class TopicLibraryController extends Controller
{
    public function index(Request $request): Response
    {
        $level = Levels::valid((string) $request->query('level', ''));
        $categorySlug = trim((string) $request->query('category', ''));
        $categorySlug = $categorySlug !== '' ? $categorySlug : null;

        $query = trim((string) $request->query('q', ''));
        $query = $query !== '' ? mb_substr($query, 0, 120) : null;

        $topics = Topic::query()
            ->where('topics.status', 'published')
            ->whereHas('lessons', fn ($lessons) => $lessons->where('status', 'published'))
            ->when($level !== null, fn ($q) => $q->whereHas(
                'lessons',
                fn ($lessons) => $lessons->where('status', 'published')->where('level', $level)
            ))
            ->when($categorySlug !== null, fn ($q) => $q->whereHas(
                'category',
                fn ($categories) => $categories->where('slug', $categorySlug)
            ))
            ->when($query !== null, fn ($q) => $q->where(
                'topics.title_en', 'ilike', '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $query).'%'
            ))
            ->with([
                'category',
                'lessons' => fn ($lessons) => $lessons
                    ->where('status', 'published')
                    ->orderByRaw(Levels::orderExpression())
                    ->select(['id', 'topic_id', 'level', 'estimated_minutes']),
            ])
            ->orderByDesc('topics.published_at')
            ->orderByDesc('topics.id')
            ->paginate(12)
            ->withQueryString();

        // One small query for the category dropdown; constant regardless of
        // the topic count, so the page stays at a fixed query budget.
        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('display_order')
            ->orderBy('name_fa')
            ->select(['id', 'name_fa', 'slug'])
            ->get();

        return Inertia::render('Library/Index', [
            'topics' => $topics->getCollection()->map(fn (Topic $topic) => TopicCard::for($topic))->all(),
            'pagination' => [
                'current_page' => $topics->currentPage(),
                'last_page' => $topics->lastPage(),
                'total' => $topics->total(),
                'per_page' => $topics->perPage(),
            ],
            'categories' => $categories->map(fn (Category $category) => [
                'slug' => $category->slug,
                'name_fa' => $category->name_fa,
            ])->all(),
            'levels' => PublishLesson::LEVELS,
            'activeLevel' => $level,
            'activeCategory' => $categorySlug,
            'activeQuery' => $query,
            'hasFilters' => $level !== null || $categorySlug !== null || $query !== null,
        ]);
    }
}
