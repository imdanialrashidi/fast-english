<?php

namespace App\Http\Controllers;

use App\Http\Responses\LockedResponse;
use App\Models\TedTalk;
use App\Models\Topic;
use App\Support\TopicCover;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * TED Talks are articles in the main library (owner instruction 2026-11-22,
 * revised): they live under the TED Talk category and open as a standalone
 * plain-text article. They are never a seventh tab inside a podcast topic.
 *
 * Audio still travels only through the policy-checked private route.
 */
class TedTalkController extends Controller
{
    public function index(): RedirectResponse
    {
        return redirect()->route('app.home', ['category' => 'ted-talk']);
    }

    public function show(Request $request, TedTalk $tedTalk): Response|HttpResponse
    {
        if (! $tedTalk->isPublished()) {
            abort(404);
        }

        if (Gate::denies('view', $tedTalk)) {
            return LockedResponse::forbidden($request, $request->user());
        }

        return Inertia::render('Reader/Ted', [
            'talk' => [
                'id' => (int) $tedTalk->id,
                'slug' => (string) $tedTalk->slug,
                'title_en' => (string) $tedTalk->title_en,
                'speaker' => (string) ($tedTalk->speaker ?? ''),
                'area' => (string) $tedTalk->area,
                'area_label' => $tedTalk->areaLabel(),
                'duration_seconds' => (int) $tedTalk->duration_seconds,
                'audio_revision' => (int) $tedTalk->audio_revision,
                'estimated_minutes' => $tedTalk->estimatedMinutes(),
                'audio_url' => route('media.ted.audio', $tedTalk),
                'cover_url' => TopicCover::url($tedTalk->cover_path),
                'segments' => $tedTalk->segments,
                'words' => $tedTalk->words,
                'source_url' => (string) $tedTalk->source_url,
                'source_license' => (string) $tedTalk->source_license,
            ],
        ]);
    }

    /**
     * Old links from the short-lived seventh-tab era keep working: the talk
     * simply moves to its own article page instead of 404ing in a bookmark.
     */
    public function legacyTopic(Topic $topic): HttpResponse
    {
        $talk = $topic->tedTalk()->published()->first();
        abort_if($talk === null, 404);

        return redirect()->route('ted.show', $talk, 301);
    }
}
