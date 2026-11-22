<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ServesPrivateAudio;
use App\Models\TedTalk;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * Private TED audio: /media/ted-talks/{talk}/audio.
 *
 * Same contract as lesson audio — publication + policy first, then the
 * shared range-aware file response. The path never appears in HTML or
 * Inertia props; only this route (after authorization) hands out bytes.
 */
class TedTalkAudioController extends Controller
{
    use ServesPrivateAudio;

    public function show(Request $request, TedTalk $tedTalk): Response
    {
        if (! $tedTalk->isPublished()) {
            abort(404);
        }

        if (Gate::denies('view', $tedTalk)) {
            abort(403);
        }

        return $this->servePrivateAudio($request, (string) $tedTalk->audio_path);
    }
}
