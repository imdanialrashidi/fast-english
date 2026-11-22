<?php

namespace App\Http\Controllers;

use App\Models\LibraryNode;
use App\Models\ReadingAttempt;
use App\Support\Library\ReadingGrader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Grade one IELTS passage submission on the server. The key and the
 * evidence spans stay out of the page payload until this endpoint returns
 * them, so the explanation cannot be read before the learner answers.
 */
class ReadingAttemptController extends Controller
{
    public function store(Request $request, LibraryNode $node): JsonResponse
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);
        abort_unless($node->track === 'ielts' && $node->isReadable(), 404);

        $validated = $request->validate([
            'answers' => ['required', 'array'],
            'answers.*' => ['nullable'],
        ]);

        /** @var array<string, mixed> $document */
        $document = $node->document->document;
        $result = ReadingGrader::publicResult($document, $validated['answers']);

        ReadingAttempt::query()->create([
            'user_id' => $user->id,
            'node_id' => $node->id,
            'answers' => $validated['answers'],
            'score' => $result['score'],
            'total' => $result['total'],
            'completed_at' => now(),
        ]);

        return response()->json($result);
    }
}
