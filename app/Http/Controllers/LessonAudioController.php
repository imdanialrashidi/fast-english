<?php

namespace App\Http\Controllers;

use App\Models\Lesson;
use App\Support\Entitlement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * S1 audio delivery: /media/lessons/{lesson}/audio.
 *
 * The server-side policy runs before any byte is sent. Bytes stream from
 * the private disk through Laravel's file response (Symfony
 * BinaryFileResponse, which owns Range/206/416 and HEAD); the file is
 * never loaded into PHP memory.
 *
 * S9a production (scope section 16): when APP_ENV=production, policy and
 * the 416 pre-check run first, then nginx serves the bytes via
 * X-Accel-Redirect from the internal /_private/ location backed by
 * storage/app/private. External requests to /_private/ return 404
 * (nginx `internal`). Dev/testing keep the PHP file response so the
 * S1 suite keeps its meaning.
 */
class LessonAudioController extends Controller
{
    public function show(Request $request, Lesson $lesson): Response
    {
        if ($lesson->status !== 'published' || $lesson->topic->status !== 'published') {
            abort(404);
        }

        if (Gate::allows('view', $lesson) !== true) {
            abort(403);
        }

        return $this->serve($request, $lesson);
    }

    /**
     * Staff panel preview: same private bytes and Range contract as the
     * learner route, but draft/archived lessons are allowed because the
     * editor must be able to check the audio before publishing. The route
     * itself carries `auth + staff + staff.2fa`; the staff check is kept
     * here as defence in depth so the controller cannot be reused as a
     * public draft-audio path.
     */
    public function preview(Request $request, Lesson $lesson): Response
    {
        if (! Entitlement::staff($request->user())) {
            abort(403);
        }

        return $this->serve($request, $lesson);
    }

    private function serve(Request $request, Lesson $lesson): Response
    {
        $path = Storage::disk('local')->path((string) $lesson->audio_path);
        if (! is_file($path)) {
            abort(404);
        }

        $size = filesize($path);
        $range = (string) $request->header('Range', '');
        if ($range !== '' && ! $this->isRangeSatisfiable($range, $size)) {
            abort(response('', 416, ['Content-Range' => "bytes */{$size}"]));
        }

        // S9a: production hands bytes to nginx after the policy check.
        // Nginx owns Range/206/416/HEAD for the redirected file; the
        // PHP pre-check above keeps the 416 contract identical in both
        // modes. Cache-Control stays private, no-store in both modes.
        if (app()->environment('production')) {
            return response('', 200, [
                'X-Accel-Redirect' => '/_private/'.$lesson->audio_path,
                'Content-Type' => 'audio/mpeg',
                'Accept-Ranges' => 'bytes',
                'Cache-Control' => 'private, no-store',
            ]);
        }

        // BinaryFileResponse defaults to `public`; that directive would let
        // a shared cache store private audio. setPrivate() after
        // construction removes it deterministically (scope §16).
        $response = response()->file($path, [
            'Content-Type' => 'audio/mpeg',
            'Accept-Ranges' => 'bytes',
        ]);
        $response->setPrivate();
        $response->headers->addCacheControlDirective('no-store');

        return $response;
    }

    /**
     * Symfony's file response ignores unsatisfiable ranges (200). Scope
     * §16 requires 416 with Content-Range for out-of-range requests, so
     * that case is rejected here; valid ranges still stream via the file
     * response. Malformed headers are ignored per RFC 9110 (200).
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
