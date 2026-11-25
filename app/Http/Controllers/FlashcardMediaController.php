<?php

namespace App\Http\Controllers;

use App\Models\WordAudio;
use App\Support\Lexicon;
use App\Support\Vocabulary;
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

    /**
     * Reading-surface pronunciation by word key. The readers know the word,
     * not the word_audio row id; this lookup keeps the same private,
     * no-store delivery contract.
     */
    public function wordByKey(Request $request, string $word): Response
    {
        $surface = urldecode($word);
        $row = null;
        foreach (Lexicon::candidates($surface) as $candidate) {
            $row = WordAudio::query()
                ->where('word_key', Vocabulary::key($candidate))
                ->where('status', 'approved')
                ->first();
            if ($row !== null) {
                break;
            }
        }

        abort_if($row === null, 404);

        return $this->privateFile((string) $row->path, 'audio/mpeg');
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
