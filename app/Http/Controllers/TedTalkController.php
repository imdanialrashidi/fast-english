<?php

namespace App\Http\Controllers;

use App\Http\Responses\LockedResponse;
use App\Models\Topic;
use App\Support\Levels;
use App\Support\TopicCover;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * The seventh reader tab: one TED talk attached to a podcast topic.
 *
 * Access mirrors the lesson reader: the talk and its topic must be
 * published, then the Gate decides. Ineligible readers get the locked page
 * before any transcript, word list or media URL travels in the payload.
 * The talk is not a CEFR level; the A1–C2 tabs stay in the same header so
 * the reader can step back into the podcast.
 */
class TedTalkController extends Controller
{
    /**
     * @return Response|InertiaResponse
     */
    public function show(Request $request, Topic $topic)
    {
        if ($topic->status !== 'published') {
            abort(404);
        }

        $talk = $topic->tedTalk()
            ->where('status', 'published')
            ->first();

        if ($talk === null) {
            abort(404);
        }

        if (Gate::denies('view', $talk)) {
            return LockedResponse::forbidden($request, $request->user());
        }

        $levels = $topic->lessons()
            ->where('status', 'published')
            ->orderByRaw(Levels::orderExpression())
            ->pluck('level')
            ->all();

        return Inertia::render('Reader/Ted', [
            'topic' => [
                'id' => (int) $topic->id,
                'slug' => (string) $topic->slug,
                'title_en' => (string) $topic->title_en,
                'cover_url' => TopicCover::url($topic->cover_path),
            ],
            'availableLevels' => $levels,
            'talk' => [
                'id' => (int) $talk->id,
                'title_en' => (string) $talk->title_en,
                'speaker' => (string) ($talk->speaker ?? ''),
                'area' => (string) $talk->area,
                'duration_seconds' => (int) $talk->duration_seconds,
                'audio_revision' => (int) $talk->audio_revision,
                'estimated_minutes' => $talk->estimatedMinutes(),
                'audio_url' => route('media.ted.audio', $talk),
                'cover_url' => TopicCover::url($talk->cover_path),
                'segments' => $talk->segments,
                'words' => $talk->words,
                'source_url' => (string) $talk->source_url,
                'source_license' => (string) $talk->source_license,
            ],
        ]);
    }
}
