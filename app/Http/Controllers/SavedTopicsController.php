<?php

namespace App\Http\Controllers;

use App\Models\Topic;
use App\Support\ClampsPagination;
use App\Support\Levels;
use App\Support\TopicCard;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * S4 saved page (SAVE-01): the user's bookmarked topics, rendered with the
 * same card component as the library. Only published topics with at least
 * one published lesson appear — archived topics vanish from the list while
 * the bookmark row persists (see BookmarkController proposal).
 *
 * A bookmark never grants access: opening a premium topic still goes
 * through the S1 reader policy (403 for ineligible readers).
 */
class SavedTopicsController extends Controller
{
    use ClampsPagination;

    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $topics = Topic::query()
            ->where('topics.status', 'published')
            ->whereHas('lessons', fn ($lessons) => $lessons->where('status', 'published'))
            ->whereHas('bookmarks', fn ($bookmarks) => $bookmarks->where('user_id', $user->id))
            ->with([
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

        // Public-slice Inertia transport (ADR-0002): the same bookmark-
        // scoped query and the same library row shape (metadata only —
        // never bodies, glossaries, or audio). A bookmark never grants
        // access; the reader policy still guards premium opens.
        return Inertia::render('Saved/Index', [
            'topics' => $topics->getCollection()->map(fn (Topic $topic) => TopicCard::for($topic))->all(),
            'pagination' => [
                'current_page' => $topics->currentPage(),
                'last_page' => $topics->lastPage(),
                'total' => $topics->total(),
                'per_page' => $topics->perPage(),
            ],
        ]);
    }
}
