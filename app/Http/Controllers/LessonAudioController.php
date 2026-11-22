<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ServesPrivateAudio;
use App\Models\Lesson;
use App\Support\Entitlement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
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
    use ServesPrivateAudio;

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
        return $this->servePrivateAudio($request, (string) $lesson->audio_path);
    }
}
