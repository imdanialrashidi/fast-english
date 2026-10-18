<?php

namespace App\Http\Controllers;

use App\Http\Responses\LockedResponse;
use App\Models\Bookmark;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Topic;
use App\Support\Entitlement;
use App\Support\Sentences;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * S1 reader: /app/topics/{slug}?level=XX + M1 Inertia transport (ADR-0002).
 *
 * The level comes from the URL only (plain link/GET). S4 keeps the rule:
 * browsing a level never writes users.preferred_level (only the explicit
 * settings form does). A missing level is never silently substituted —
 * the NotReady page names the exact message plus the available levels.
 *
 * Props are an allowlist for the authorized reader only: the controller
 * authorizes the lesson BEFORE rendering, so premium bodies, glossaries,
 * and the private audio URL never reach ineligible clients (403 via the
 * shared ErrorPage handler). Draft/archived content is 404 to everyone.
 *
 * S4 resume travels as data: owner-only, revision-isolated, no autoplay.
 * Guests receive zero and their listening is never saved server-side.
 *
 * R3 sentence cues: only cues timed against the current audio revision
 * are exposed, and only when their count matches the reader sentence
 * split. Otherwise the plain-reader fallback props stay and the lesson
 * remains completable.
 */
class TopicReaderController extends Controller
{
    /**
     * Returns the learner reader, the missing-level page, the locked
     * state (403), or a redirect to the public sample experience.
     *
     * @return Response|\Symfony\Component\HttpFoundation\Response
     */
    public function show(Request $request, Topic $topic)
    {
        if ($topic->status !== 'published') {
            abort(404);
        }

        $publishedLessons = $topic->lessons()
            ->where('status', 'published')
            ->orderByRaw(\App\Support\Levels::orderExpression())
            ->get();

        if ($publishedLessons->isEmpty()) {
            abort(404);
        }

        $availableLevels = $publishedLessons->pluck('level')->all();

        $rawLevel = $request->query('level', '');
        $requested = is_string($rawLevel) ? strtoupper($rawLevel) : '';
        if ($requested === '') {
            // S4: an explicit preferred level is honored as the default
            // when it exists for this topic; otherwise the first available
            // level. Browsing never writes preferred_level.
            $userLevel = $request->user()?->preferred_level;
            if (is_string($userLevel) && in_array($userLevel, $availableLevels, true)) {
                $requested = $userLevel;
            } else {
                $requested = $availableLevels[0];
            }
        }

        $lesson = $publishedLessons->firstWhere('level', $requested);

        if ($lesson === null) {
            return Inertia::render('Reader/NotReady', [
                'topic' => [
                    'slug' => $topic->slug,
                    'title_en' => $topic->title_en,
                ],
                'requestedLevel' => $requested,
                'availableLevels' => $availableLevels,
            ]);
        }

        // Paid-only gate (owner requirement): the designated public sample
        // resolves to the public sample experience, never the learner
        // shell. Every other lesson needs an eligible subscriber or staff;
        // ineligible page requests get the locked state (403, no premium
        // props) with one subscription CTA.
        if ($lesson->is_public_sample && ! Entitlement::eligible($request->user())) {
            return redirect()->to(route('sample', ['topic' => $topic->slug, 'level' => $lesson->level]));
        }

        $locked = $this->authorizeLesson($request, $lesson);
        if ($locked !== null) {
            return $locked;
        }

        $prepared = \App\Support\Reading::prepared($lesson);
        $sentences = $prepared['sentences'];
        $cues = $prepared['cues'];
        $cuesUsable = $prepared['cuesUsable'];

        // S4 resume: owner-only, revision-isolated. No user write happens
        // here — the level in the URL never touches preferred_level.
        $initialPosition = 0.0;
        $completed = false;
        $bookmarked = false;
        $user = $request->user();
        if ($user !== null && $user->disabled_at === null) {
            $stored = LessonProgress::where('user_id', $user->id)
                ->where('lesson_id', $lesson->id)
                ->first();
            if ($stored !== null && (int) $stored->audio_revision === (int) $lesson->audio_revision) {
                $initialPosition = max(0.0, (float) $stored->position_seconds);
                $completed = $stored->completed_at !== null;
            }
            $bookmarked = Bookmark::where('user_id', $user->id)
                ->where('topic_id', $topic->id)
                ->exists();
        }

        // Plain-reader paragraphs for the no-cue fallback (the split
        // sentences stay the synced-reader source of truth). Shape owned
        // by Reading::prepared() above.
        $paragraphs = $prepared['paragraphs'];

        return Inertia::render('Reader/Show', [
            'topic' => [
                'id' => $topic->id,
                'slug' => $topic->slug,
                'title_en' => $topic->title_en,
                'summary_public' => $topic->summary_public,
                'cover_url' => $topic->cover_path ? '/storage/'.$topic->cover_path : null,
            ],
            'lesson' => [
                'id' => $lesson->id,
                'title_en' => $lesson->title_en,
                'level' => $lesson->level,
                'estimated_minutes' => (int) $lesson->estimated_minutes,
                'duration_seconds' => (int) $lesson->duration_seconds,
                'audio_revision' => (int) $lesson->audio_revision,
                'audio_url' => route('media.lesson.audio', $lesson),
            ],
            'availableLevels' => $availableLevels,
            'initialPosition' => (float) $initialPosition,
            'completed' => $completed,
            'bookmarked' => $bookmarked,
            'isGuest' => $user === null,
            'sentences' => $sentences,
            'paragraphs' => $paragraphs,
            'cues' => $cues,
            'cuesUsable' => $cuesUsable,
            'glossary' => $prepared['glossary'],
        ]);
    }

    /**
     * @return \Symfony\Component\HttpFoundation\Response|null the locked page (403) or null when allowed.
     */
    private function authorizeLesson(Request $request, Lesson $lesson): ?\Symfony\Component\HttpFoundation\Response
    {
        if ($lesson->status !== 'published' || $lesson->topic->status !== 'published') {
            abort(404);
        }

        if (Gate::allows('view', $lesson) !== true) {
            return LockedResponse::forbidden($request, $request->user());
        }

        return null;
    }

    private function levelOrder(): string
    {
        return \App\Support\Levels::orderExpression();
    }
}
