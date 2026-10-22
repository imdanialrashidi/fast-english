<?php

namespace App\Http\Controllers;

use App\Http\Responses\NoStore;
use App\Models\Bookmark;
use App\Models\Topic;
use Illuminate\Http\Request;

/**
 * S4 bookmarks (scope §13.3, SAVE-01): one unique pair per user and topic.
 * Store and destroy are both idempotent: concurrent stores leave one row
 * (constraint-backed upsert), repeat destroys stay gone.
 *
 * PROPOSAL (recorded in the exec plan, tested): a bookmark never grants
 * access, and an archived topic disappears from /app/saved while the row
 * persists — republishing makes it reappear. This matches the library,
 * which hides archived content everywhere.
 */
class BookmarkController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $data = $request->validate([
            'topic_id' => ['required', 'integer', 'exists:topics,id'],
        ]);

        $topic = Topic::findOrFail($data['topic_id']);
        if ($topic->status !== 'published') {
            abort(404);
        }

        Bookmark::updateOrCreate(
            ['user_id' => $user->id, 'topic_id' => $topic->id],
            ['created_at' => now()]
        );

        return response()->json(['bookmarked' => true])
            ->withHeaders(NoStore::headers());
    }

    public function destroy(Request $request, Topic $topic)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        Bookmark::where('user_id', $user->id)
            ->where('topic_id', $topic->id)
            ->delete();

        return response()->json(['bookmarked' => false])
            ->withHeaders(NoStore::headers());
    }
}
