<?php

namespace App\Http\Controllers;

use App\Models\Flashcard;
use App\Models\FlashcardBook;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Private flashcard media. Card images, word audio and book covers are paid
 * content: every request is behind the learner subscription gate, and the
 * bytes are served from the private disk with `private, no-store`. The
 * player preloads the next card so a session does not wait on the network.
 */
class FlashcardMediaController extends Controller
{
    public function image(Request $request, Flashcard $flashcard): Response
    {
        $this->ensurePublished($flashcard);

        return $this->privateFile((string) $flashcard->image_path, 'image/webp');
    }

    public function audio(Request $request, Flashcard $flashcard): Response
    {
        $this->ensurePublished($flashcard);

        return $this->privateFile((string) $flashcard->audio_path, 'audio/mpeg', true);
    }

    public function cover(Request $request, FlashcardBook $book): Response
    {
        abort_unless($book->status === 'published', 404);
        abort_if($book->cover_path === null || $book->cover_path === '', 404);

        return $this->privateFile((string) $book->cover_path, 'image/webp');
    }

    private function ensurePublished(Flashcard $flashcard): void
    {
        $flashcard->loadMissing('unit.book');

        if ($flashcard->unit === null
            || $flashcard->unit->book === null
            || $flashcard->unit->book->status !== 'published') {
            abort(404);
        }
    }

    private function privateFile(string $path, string $mime, bool $range = false): Response
    {
        $fullPath = Storage::disk('local')->path($path);
        if (! is_file($fullPath)) {
            abort(404);
        }

        $headers = ['Content-Type' => $mime];
        if ($range) {
            $headers['Accept-Ranges'] = 'bytes';
        }

        $response = response()->file($fullPath, $headers);
        $response->setPrivate();
        $response->headers->addCacheControlDirective('no-store');

        return $response;
    }
}
