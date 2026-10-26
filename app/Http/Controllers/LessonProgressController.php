<?php

namespace App\Http\Controllers;

use App\Http\Responses\NoStore;
use App\Models\Lesson;
use App\Models\LessonProgress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * S4 progress (scope §13.2, PROG-01): resume position + completion,
 * isolated per user, lesson, and audio revision.
 *
 * - Saves at most every 15 s while playing, plus pause/end (client rule).
 * - The server validates lesson ID, revision, and position: finite and
 *   within the server's duration. The client's duration is never trusted.
 * - A stale revision is rejected (409) with the stored position for the
 *   current revision; old progress is never applied to the new audio.
 * - Completion comes only from the ended event or an explicit action;
 *   seeking to the end never completes. Completion survives pause and
 *   resets only on explicit reset. A new revision never inherits completion.
 * - Concurrent saves upsert on the unique (user_id, lesson_id) key: no
 *   duplicate rows. Failures never claim success (4xx/5xx + retry UI).
 */
class LessonProgressController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $data = $request->validate([
            'lesson_id' => ['required', 'integer', 'exists:lessons,id'],
            'audio_revision' => ['required', 'integer', 'min:1'],
            'position_seconds' => ['required', 'numeric'],
        ]);

        $lesson = Lesson::with('topic')->findOrFail($data['lesson_id']);

        if ($lesson->status !== 'published' || $lesson->topic->status !== 'published') {
            abort(404);
        }

        if (Gate::allows('view', $lesson) !== true) {
            abort(403);
        }

        $position = (float) $data['position_seconds'];
        // Encoders sometimes report a few tenths more than the stored
        // integer duration; allow one second of rounding but store the
        // clamped value so the resume position never exceeds the lesson.
        $maxPosition = (float) $lesson->duration_seconds + 1.0;
        if (! is_finite($position) || $position < 0 || $position > $maxPosition) {
            return response()->json([
                'message' => 'موقعیت پخش خارج از مدت این درس است.',
            ], 422)->withHeaders(NoStore::headers());
        }
        $position = min($position, (float) $lesson->duration_seconds);

        $revision = (int) $data['audio_revision'];
        if ($revision !== (int) $lesson->audio_revision) {
            $stored = LessonProgress::where('user_id', $user->id)
                ->where('lesson_id', $lesson->id)
                ->first();

            $currentPosition = ($stored !== null && (int) $stored->audio_revision === (int) $lesson->audio_revision)
                ? (float) $stored->position_seconds
                : 0.0;

            return response()->json([
                'message' => 'نسخهٔ صوت این درس تغییر کرده است؛ موقعیت ذخیره‌شده به‌روز شد.',
                'current_revision' => (int) $lesson->audio_revision,
                'position_seconds' => $currentPosition,
            ], 409)->withHeaders(NoStore::headers());
        }

        $progress = LessonProgress::updateOrCreate(
            ['user_id' => $user->id, 'lesson_id' => $lesson->id],
            [
                'audio_revision' => (int) $lesson->audio_revision,
                'position_seconds' => $position,
                'started_at' => LessonProgress::where('user_id', $user->id)
                    ->where('lesson_id', $lesson->id)
                    ->value('started_at') ?? now(),
            ]
        );

        return response()->json([
            'position_seconds' => (float) $progress->position_seconds,
            'audio_revision' => (int) $progress->audio_revision,
            'completed_at' => $progress->completed_at?->toIso8601String(),
        ])->withHeaders(NoStore::headers());
    }

    public function complete(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $data = $request->validate([
            'lesson_id' => ['required', 'integer', 'exists:lessons,id'],
            'audio_revision' => ['required', 'integer', 'min:1'],
        ]);

        $lesson = Lesson::with('topic')->findOrFail($data['lesson_id']);

        if ($lesson->status !== 'published' || $lesson->topic->status !== 'published') {
            abort(404);
        }

        if (Gate::allows('view', $lesson) !== true) {
            abort(403);
        }

        if ((int) $data['audio_revision'] !== (int) $lesson->audio_revision) {
            return response()->json(['message' => 'نسخهٔ صوت این درس تغییر کرده است؛ موقعیت ذخیره‌شده به‌روز شد.'], 409)
                ->withHeaders(NoStore::headers());
        }

        $existing = LessonProgress::where('user_id', $user->id)
            ->where('lesson_id', $lesson->id)
            ->first();

        $progress = LessonProgress::updateOrCreate(
            ['user_id' => $user->id, 'lesson_id' => $lesson->id],
            [
                'audio_revision' => (int) $lesson->audio_revision,
                'position_seconds' => $existing !== null ? (float) $existing->position_seconds : 0.0,
                'started_at' => $existing?->started_at ?? now(),
                'completed_at' => $existing?->completed_at ?? now(),
            ]
        );

        return response()->json([
            'completed_at' => $progress->completed_at?->toIso8601String(),
            'audio_revision' => (int) $progress->audio_revision,
        ])->withHeaders(NoStore::headers());
    }

    public function reset(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $data = $request->validate([
            'lesson_id' => ['required', 'integer', 'exists:lessons,id'],
        ]);

        $lesson = Lesson::with('topic')->findOrFail($data['lesson_id']);

        if ($lesson->status !== 'published' || $lesson->topic->status !== 'published') {
            abort(404);
        }

        if (Gate::allows('view', $lesson) !== true) {
            abort(403);
        }

        LessonProgress::where('user_id', $user->id)
            ->where('lesson_id', $lesson->id)
            ->update(['completed_at' => null, 'updated_at' => now()]);

        return response()->json(['completed_at' => null])
            ->withHeaders(NoStore::headers());
    }
}
