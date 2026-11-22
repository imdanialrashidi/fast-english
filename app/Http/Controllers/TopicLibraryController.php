<?php

namespace App\Http\Controllers;

use App\Actions\PublishLesson;
use App\Models\Category;
use App\Models\TedTalk;
use App\Models\Topic;
use App\Support\ClampsPagination;
use App\Support\Levels;
use App\Support\TopicCard;
use App\Support\TopicCover;
use Illuminate\Http\RedirectResponse;
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
    use ClampsPagination;

    public function index(Request $request): Response|RedirectResponse
    {
        $levelParam = $request->query('level');
        $level = is_string($levelParam) ? Levels::valid($levelParam) : null;
        $categoryParam = $request->query('category');
        $categorySlug = is_string($categoryParam) ? trim($categoryParam) : '';
        $categorySlug = $categorySlug !== '' ? $categorySlug : null;

        $queryParam = $request->query('q');
        $query = is_string($queryParam) ? trim($queryParam) : '';
        $query = $query !== '' ? mb_substr($query, 0, 120) : null;

        // TED Talks are articles, so they use the same Discover surface and
        // the TED Talk category. They have no CEFR level, so the level filter
        // is intentionally not applied to this category.
        if ($categorySlug === 'ted-talk') {
            return $this->tedCategory($request, $query);
        }

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

        if (($redirect = $this->redirectOutOfRangePage($request, $topics)) !== null) {
            return $redirect;
        }

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

    /**
     * The TED Talk category on Discover. Cards use the same editorial row as
     * topics and link to the standalone talk article; no lesson or CEFR
     * level is invented for the talk.
     */
    private function tedCategory(Request $request, ?string $query): Response|RedirectResponse
    {
        $search = $query === null ? null : str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $query);

        $talks = TedTalk::query()
            ->published()
            ->when($search !== null, fn ($talks) => $talks->where('title_en', 'ilike', '%'.$search.'%'))
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->paginate(12)
            ->withQueryString();

        if (($redirect = $this->redirectOutOfRangePage($request, $talks)) !== null) {
            return $redirect;
        }

        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('display_order')
            ->orderBy('name_fa')
            ->select(['id', 'name_fa', 'slug'])
            ->get();

        return Inertia::render('Library/Index', [
            'topics' => $talks->getCollection()->map(fn (TedTalk $talk): array => [
                'slug' => (string) $talk->slug,
                'title_en' => (string) $talk->title_en,
                'cover_url' => TopicCover::url($talk->cover_path),
                'category_name' => 'TED Talk',
                'levels' => [],
                'first_level' => null,
                'extra_levels' => 0,
                'minutes' => $talk->estimatedMinutes(),
                'reader_url' => route('ted.show', $talk),
            ])->all(),
            'pagination' => [
                'current_page' => $talks->currentPage(),
                'last_page' => $talks->lastPage(),
                'total' => $talks->total(),
                'per_page' => $talks->perPage(),
            ],
            'categories' => $categories->map(fn (Category $category) => [
                'slug' => $category->slug,
                'name_fa' => $category->name_fa,
            ])->all(),
            'levels' => PublishLesson::LEVELS,
            'activeLevel' => null,
            'activeCategory' => 'ted-talk',
            'activeQuery' => $query,
            'hasFilters' => true,
        ]);
    }
}
