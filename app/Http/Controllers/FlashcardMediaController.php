<?php

namespace App\Http\Controllers;

use App\Models\WordAudio;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Private flashcard word audio. The clips are paid content: every request
 * sits behind the learner subscription gate, and the bytes are served from
 * the private disk with `private, no-store`.
 */
class FlashcardMediaController extends Controller
{
    public function word(Request $request, WordAudio $wordAudio): Response
    {
        abort_unless($wordAudio->status === 'approved', 404);

        return $this->privateFile((string) $wordAudio->path, 'audio/mpeg');
    }

    private function privateFile(string $path, string $mime): Response
    {
        $fullPath = Storage::disk('local')->path($path);
        if (! is_file($fullPath)) {
            abort(404);
        }

        $response = response()->file($fullPath, [
            'Content-Type' => $mime,
            'Accept-Ranges' => 'bytes',
        ]);
        $response->setPrivate();
        $response->headers->addCacheControlDirective('no-store');

        return $response;
    }
}
