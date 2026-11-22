<?php

namespace App\Http\Controllers;

use App\Models\LibraryNode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Private bytes for the reading tracks. The node's published document owns
 * the revision folder; only a file that exists in that folder is served.
 * Audio is `private, no-store`; page art may be cached privately because
 * its URL carries the immutable revision.
 */
class LibraryMediaController extends Controller
{
    public function audio(Request $request, LibraryNode $node, string $file): Response
    {
        return $this->serve($request, $node, $file, 'audio', 'audio/mpeg', false);
    }

    public function image(Request $request, LibraryNode $node, string $file): Response
    {
        $mime = match (strtolower(pathinfo($file, PATHINFO_EXTENSION))) {
            'webp' => 'image/webp',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            default => 'application/octet-stream',
        };

        return $this->serve($request, $node, $file, 'images', $mime, true);
    }

    private function serve(Request $request, LibraryNode $node, string $file, string $folder, string $mime, bool $cacheable): Response
    {
        abort_unless($node->isReadable(), 404);
        abort_unless(preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]*$/', $file) === 1, 404);

        $revision = (int) $node->document->revision;
        $path = "library/{$node->slug}/r{$revision}/{$folder}/{$file}";
        $fullPath = Storage::disk('local')->path($path);

        if (! is_file($fullPath)) {
            abort(404);
        }

        $size = filesize($fullPath);
        $range = (string) $request->header('Range', '');
        if ($range !== '' && ! $this->isRangeSatisfiable($range, $size)) {
            abort(response('', 416, ['Content-Range' => "bytes */{$size}"]));
        }

        $response = response()->file($fullPath, [
            'Content-Type' => $mime,
            'Accept-Ranges' => 'bytes',
        ]);
        $response->setPrivate();

        if ($cacheable) {
            $response->headers->addCacheControlDirective('max-age', '31536000');
            $response->headers->addCacheControlDirective('immutable');
        } else {
            $response->headers->addCacheControlDirective('no-store');
        }

        return $response;
    }

    private function isRangeSatisfiable(string $range, int $size): bool
    {
        if (! str_starts_with($range, 'bytes=')) {
            return true;
        }

        $spec = substr($range, strlen('bytes='));
        if (str_contains($spec, ',') || ! preg_match('/^(\d*)-(\d*)$/', $spec, $m)) {
            return true;
        }

        [$start, $end] = [$m[1], $m[2]];
        if ($start === '' && $end === '') {
            return true;
        }
        if ($start === '') {
            return (int) $end > 0 && $size > 0;
        }
        if ((int) $start >= $size) {
            return false;
        }

        return $end === '' || (int) $end >= (int) $start;
    }
}
