<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Private audio delivery shared by lesson and TED-talk routes.
 *
 * The caller authorizes first; this trait only moves bytes from the private
 * disk. In production nginx owns the file response through the internal
 * /_private/ location, after the PHP range pre-check. In dev/testing Laravel's
 * BinaryFileResponse streams the file and keeps the same Range/206/416/HEAD
 * contract.
 *
 * Both callers must keep Cache-Control private, no-store: private course
 * audio never enters a shared cache.
 */
trait ServesPrivateAudio
{
    private function servePrivateAudio(Request $request, string $relativePath): Response
    {
        $path = Storage::disk('local')->path($relativePath);
        if (! is_file($path)) {
            abort(404);
        }

        $size = filesize($path);
        $range = (string) $request->header('Range', '');
        if ($range !== '' && ! $this->isRangeSatisfiable($range, $size)) {
            abort(response('', 416, ['Content-Range' => "bytes */{$size}"]));
        }

        if (app()->environment('production')) {
            return response('', 200, [
                'X-Accel-Redirect' => '/_private/'.$relativePath,
                'Content-Type' => 'audio/mpeg',
                'Accept-Ranges' => 'bytes',
                'Cache-Control' => 'private, no-store',
            ]);
        }

        $response = response()->file($path, [
            'Content-Type' => 'audio/mpeg',
            'Accept-Ranges' => 'bytes',
        ]);
        $response->setPrivate();
        $response->headers->addCacheControlDirective('no-store');

        return $response;
    }

    /**
     * Symfony's file response ignores unsatisfiable ranges (200). Scope §16
     * requires 416 with Content-Range for out-of-range requests, so that case
     * is rejected here; valid ranges still stream via the file response.
     * Malformed headers are ignored per RFC 9110 (200).
     */
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
