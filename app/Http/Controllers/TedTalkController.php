<?php

namespace App\Http\Controllers;

use App\Http\Responses\LockedResponse;
use App\Models\TedTalk;
use App\Models\Topic;
use App\Support\Entitlement;
use App\Support\Library\LibraryPresenter;
use App\Support\TopicCover;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * TED Talks are their own reading section (owner instruction 2026-11-22).
 *
 * A talk is a standalone article with its own shelf entry, index and URL.
 * It is never rendered as a seventh tab inside a podcast topic, and its
 * transcript is plain text: no sentence highlight, no cue-follow scroll.
 * Audio still travels only through the policy-checked private route.
 */
class TedTalkController extends Controller
{
    private const AREA_LABELS = [
        'politics' => 'سیاست',
        'cinema' => 'سینما',
        'sports' => 'ورزش',
        'health' => 'سلامت',
        'tech' => 'فناوری',
        'celebrity' => 'سلبریتی',
        'literature' => 'ادبیات',
    ];

    private const AREA_ORDER = ['politics', 'cinema', 'sports', 'health', 'tech', 'celebrity', 'literature'];

    public function index(Request $request): Response|HttpResponse
    {
        if (! Entitlement::eligible($request->user())) {
            return LockedResponse::forbidden($request, $request->user());
        }

        $talks = TedTalk::query()->published()->orderBy('title_en')->get();
        $activeArea = (string) $request->query('area', '');
        if ($activeArea !== '' && ! array_key_exists($activeArea, self::AREA_LABELS)) {
            $activeArea = '';
        }

        $visible = $activeArea === ''
            ? $talks
            : $talks->where('area', $activeArea)->values();

        $areas = [];
        foreach (self::AREA_ORDER as $key) {
            $count = $talks->where('area', $key)->count();
            if ($count > 0) {
                $areas[] = ['key' => $key, 'label' => self::AREA_LABELS[$key], 'count' => $count];
            }
        }

        return Inertia::render('Ted/Index', [
            'talks' => $visible->map(fn (TedTalk $talk): array => [
                'slug' => (string) $talk->slug,
                'title_en' => (string) $talk->title_en,
                'speaker' => (string) ($talk->speaker ?? ''),
                'area' => (string) $talk->area,
                'area_label' => self::AREA_LABELS[$talk->area] ?? (string) $talk->area,
                'minutes' => $talk->estimatedMinutes(),
                'cover_url' => TopicCover::url($talk->cover_path),
                'url' => route('ted.show', $talk),
            ])->values()->all(),
            'areas' => $areas,
            'active_area' => $activeArea,
            'total' => $talks->count(),
            'tabs' => LibraryPresenter::tabs('ted'),
        ]);
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
                'area_label' => self::AREA_LABELS[$tedTalk->area] ?? (string) $tedTalk->area,
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
     * simply moves to its own section instead of 404ing in a bookmark.
     */
    public function legacyTopic(Topic $topic): HttpResponse
    {
        $talk = $topic->tedTalk()->published()->first();
        abort_if($talk === null, 404);

        return redirect()->route('ted.show', $talk, 301);
    }
}
