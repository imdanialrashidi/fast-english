<?php

namespace App\Http\Controllers;

use App\Models\LibraryNode;
use App\Models\ReadingProgress;
use Illuminate\Http\Request;

/**
 * One learner's place in one reading. The client posts the page key and the
 * real audio position; the server never derives a place from a timer.
 */
class ReadingProgressController extends Controller
{
    public function store(Request $request, LibraryNode $node)
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);
        abort_unless($node->isReadable(), 404);

        $validated = $request->validate([
            'page_key' => ['required', 'string', 'max:64'],
            'position_ms' => ['required', 'integer', 'min:0'],
            'completed' => ['sometimes', 'boolean'],
        ]);

        ReadingProgress::query()->updateOrCreate(
            ['user_id' => $user->id, 'node_id' => $node->id],
            [
                'page_key' => $validated['page_key'],
                'position_ms' => $validated['position_ms'],
                'revision' => (int) $node->document->revision,
                'completed_at' => ($validated['completed'] ?? false) ? now() : null,
            ],
        );

        return response()->noContent();
    }
}
