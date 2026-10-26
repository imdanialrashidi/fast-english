<?php

namespace App\Http\Controllers;

use App\Actions\SubmitPlacement;
use App\Http\Responses\NoStore;
use App\Models\PlacementAnswer;
use App\Models\PlacementAttempt;
use App\Models\PlacementQuestion;
use App\Models\PlacementTest;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * S7 optional placement (scope §6, §12): pinned attempts, per-question
 * server saves, server-side marking, explicit preference accept.
 *
 * - Start pins the attempt to the current published version. One open
 *   attempt per user (partial unique index); a new start within 24 hours
 *   of the last start is refused; resuming the open attempt is allowed.
 * - Answers save per question (selected option only). The answer key
 *   (correct_option) and scoring rules never reach the client: not in
 *   HTML, not in JSON, not in Inertia props (these are plain Inertia
 *   routes with no Livewire component).
 * - Submit validates that every answer belongs to this attempt and
 *   version with no duplicates or foreign questions; a partial submit
 *   produces no result. Score is one point per correct answer; a repeated
 *   submit returns the stored result (row-locked, race-safe).
 * - recommended_level is written only at completion; accepting the result
 *   sets users.preferred_level explicitly. Browsing never writes either.
 * - With no current published version, the index shows the neutral
 *   «در دست آماده‌سازی» state with a manual level link.
 */
class PlacementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $current = $this->currentVersion();
        $open = PlacementAttempt::where('user_id', $user->id)
            ->where('status', PlacementAttempt::STATUS_IN_PROGRESS)
            ->orderByDesc('id')
            ->first();

        // Public-slice Inertia transport (ADR-0002): the same optional
        // placement entry with the same neutral «در دست آماده‌سازی»
        // state when no version is current. Start/submit/accept keep
        // their redirect-or-JSON dual behavior below.
        return Inertia::render('Placement/Index', [
            'current' => $current ? [
                'version' => (string) $current->version,
            ] : null,
            'openAttempt' => $open ? [
                'id' => $open->id,
                'url' => route('placement.show', $open),
            ] : null,
        ]);
    }

    public function start(Request $request)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $current = $this->currentVersion();
        if ($current === null) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'آزمون در حال حاضر در دست آماده‌سازی است.'], 422)
                    ->withHeaders(NoStore::headers());
            }

            return redirect()->route('placement.index')->with('status', 'آزمون در حال حاضر در دست آماده‌سازی است.');
        }

        // Resume: a second start while one is open returns the same attempt.
        $open = PlacementAttempt::where('user_id', $user->id)
            ->where('status', PlacementAttempt::STATUS_IN_PROGRESS)
            ->orderByDesc('id')
            ->first();
        if ($open !== null) {
            return $this->attemptRedirect($request, $open);
        }

        // 24-hour rule: a new start within 24 hours of the last start is
        // refused (applies to completed/abandoned history, not to resume).
        $last = PlacementAttempt::where('user_id', $user->id)->orderByDesc('started_at')->first();
        if ($last !== null && $last->started_at !== null && $last->started_at->greaterThan(now()->subDay())) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'شروع تازه تا ۲۴ ساعت پس از آخرین شروع مجاز نیست.'], 429)
                    ->withHeaders(NoStore::headers());
            }

            return redirect()->route('placement.index')->with('status', 'شروع تازه تا ۲۴ ساعت پس از آخرین شروع مجاز نیست.');
        }

        try {
            $attempt = DB::transaction(function () use ($user, $current) {
                $existing = PlacementAttempt::where('user_id', $user->id)
                    ->where('status', PlacementAttempt::STATUS_IN_PROGRESS)
                    ->lockForUpdate()
                    ->first();
                if ($existing !== null) {
                    return $existing;
                }

                // Re-check the 24-hour rule inside the transaction so two
                // concurrent starts cannot both slip past the fast path.
                $lastLocked = PlacementAttempt::where('user_id', $user->id)
                    ->orderByDesc('started_at')
                    ->lockForUpdate()
                    ->first();
                if ($lastLocked !== null && $lastLocked->started_at !== null
                    && $lastLocked->started_at->greaterThan(now()->subDay())
                    && $lastLocked->status !== PlacementAttempt::STATUS_IN_PROGRESS) {
                    abort(429, 'شروع تازه تا ۲۴ ساعت پس از آخرین شروع مجاز نیست.');
                }

                $row = new PlacementAttempt;
                $row->forceFill([
                    'user_id' => $user->id,
                    'test_id' => $current->id,
                    'status' => PlacementAttempt::STATUS_IN_PROGRESS,
                    'started_at' => now(),
                ]);
                $row->save();

                return $row;
            });
        } catch (QueryException $e) {
            // Lost the start race on the partial unique index: resume the
            // surviving open attempt instead of creating a second one.
            if ($this->isUniqueViolation($e)) {
                $winner = PlacementAttempt::where('user_id', $user->id)
                    ->where('status', PlacementAttempt::STATUS_IN_PROGRESS)
                    ->orderByDesc('id')
                    ->firstOrFail();

                return $this->attemptRedirect($request, $winner);
            }

            throw $e;
        }

        return $this->attemptRedirect($request, $attempt->fresh());
    }

    public function show(Request $request, PlacementAttempt $attempt)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }
        if (Gate::allows('view', $attempt) !== true) {
            abort(403);
        }

        if ($attempt->status === PlacementAttempt::STATUS_COMPLETED) {
            return redirect()->route('placement.result', $attempt);
        }
        if ($attempt->status !== PlacementAttempt::STATUS_IN_PROGRESS) {
            return redirect()->route('placement.index');
        }

        // Questions of the pinned version only — never the current
        // version's questions, so an open v1 attempt never mixes with v2.
        // Only id/prompt/options/position travel to the view; the answer
        // key stays on the server.
        $questions = PlacementQuestion::where('test_id', $attempt->test_id)
            ->orderBy('position')
            ->get(['id', 'position', 'prompt', 'options']);

        $selected = PlacementAnswer::where('attempt_id', $attempt->id)
            ->pluck('selected_option', 'question_id')
            ->all();

        // Public-slice Inertia transport (ADR-0002): only
        // id/position/prompt/options travel — the answer key
        // (correct_option) and scoring rules never reach the client,
        // not in props, not in JSON. Per-question saves stay on the
        // JSON answer endpoint; the page posts saves without reload.
        return Inertia::render('Placement/Show', [
            'attempt' => [
                'id' => $attempt->id,
                'status' => (string) $attempt->status,
            ],
            'questions' => $questions->map(fn ($question) => [
                'id' => $question->id,
                'position' => (int) $question->position,
                'prompt' => (string) $question->prompt,
                'options' => array_values((array) ($question->options ?? [])),
            ])->all(),
            'selected' => collect($selected)->mapWithKeys(fn ($option, $questionId) => [
                (string) $questionId => (int) $option,
            ])->all(),
            'totalCount' => $questions->count(),
        ]);
    }

    public function answer(Request $request, PlacementAttempt $attempt)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }
        if (Gate::allows('update', $attempt) !== true) {
            abort(403);
        }
        if ($attempt->status !== PlacementAttempt::STATUS_IN_PROGRESS) {
            abort(403);
        }

        $data = $request->validate([
            'question_id' => ['required', 'integer', 'exists:placement_questions,id'],
            'selected_option' => ['required', 'integer', 'min:0', 'max:3'],
        ], [
            'question_id.required' => 'انتخاب سؤال الزامی است.',
            'question_id.exists' => 'سؤال انتخاب‌شده معتبر نیست.',
            'selected_option.required' => 'انتخاب گزینه الزامی است.',
            'selected_option.min' => 'گزینه انتخاب‌شده معتبر نیست.',
            'selected_option.max' => 'گزینه انتخاب‌شده معتبر نیست.',
        ]);

        $question = PlacementQuestion::find($data['question_id']);
        if ($question === null || (int) $question->test_id !== (int) $attempt->test_id) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'سؤال متعلق به این آزمون نیست.'], 422)
                    ->withHeaders(NoStore::headers());
            }

            return redirect()->route('placement.show', $attempt)->with('status', 'سؤال متعلق به این آزمون نیست.');
        }

        $existing = PlacementAnswer::where('attempt_id', $attempt->id)
            ->where('question_id', $question->id)
            ->first();
        if ($existing !== null) {
            $existing->forceFill(['selected_option' => (int) $data['selected_option'], 'is_correct' => null])->save();
        } else {
            try {
                $row = new PlacementAnswer;
                $row->forceFill([
                    'attempt_id' => $attempt->id,
                    'question_id' => $question->id,
                    'selected_option' => (int) $data['selected_option'],
                    'is_correct' => null,
                ])->save();
            } catch (QueryException $e) {
                // Concurrent double-submit: the loser hits the (attempt_id,
                // question_id) unique index between the find and the insert.
                // Converge onto the surviving row with the posted value so
                // exactly one row remains; anything else rethrows.
                $surviving = PlacementAnswer::where('attempt_id', $attempt->id)
                    ->where('question_id', $question->id)
                    ->first();
                if ($surviving === null) {
                    throw $e;
                }
                $surviving->forceFill(['selected_option' => (int) $data['selected_option'], 'is_correct' => null])->save();
            }
        }

        if ($request->expectsJson()) {
            return response()->json(['id' => $attempt->id, 'status' => $attempt->status])
                ->withHeaders(NoStore::headers());
        }

        return redirect()->route('placement.show', $attempt)->with('status', 'پاسخ ذخیره شد.');
    }

    public function submit(Request $request, PlacementAttempt $attempt)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }
        if (Gate::allows('update', $attempt) !== true) {
            abort(403);
        }
        if ((int) $attempt->user_id !== (int) $user->id) {
            abort(403);
        }

        try {
            $outcome = SubmitPlacement::submit((int) $attempt->id);
        } catch (ValidationException $e) {
            if ($request->expectsJson()) {
                return response()->json(['message' => collect($e->errors())->flatten()->implode(' ')], 422)
                    ->withHeaders(NoStore::headers());
            }

            return redirect()
                ->route('placement.show', $attempt)
                ->withErrors($e->errors());
        }

        /** @var PlacementAttempt $fresh */
        $fresh = $outcome['attempt'];

        if ($request->expectsJson()) {
            return response()->json([
                'id' => $fresh->id,
                'status' => $fresh->status,
                'score' => $fresh->score,
                'recommended_level' => $fresh->recommended_level,
            ])->withHeaders(NoStore::headers());
        }

        return redirect()->route('placement.result', $fresh);
    }

    public function result(Request $request, PlacementAttempt $attempt)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }
        if (Gate::allows('view', $attempt) !== true) {
            abort(403);
        }

        if ($attempt->status !== PlacementAttempt::STATUS_COMPLETED) {
            return redirect()->route('placement.show', $attempt);
        }

        $fresh = $attempt->fresh();

        // Public-slice Inertia transport (ADR-0002): score + suggested
        // level + disclaimer only. Accepting the result writes
        // preferred_level explicitly; browsing never does.
        return Inertia::render('Placement/Result', [
            'attempt' => [
                'id' => $fresh->id,
                'score' => (int) $fresh->score,
                'recommended_level' => $fresh->recommended_level,
            ],
        ]);
    }

    public function accept(Request $request, PlacementAttempt $attempt)
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }
        if (Gate::allows('update', $attempt) !== true) {
            abort(403);
        }
        if ($attempt->status !== PlacementAttempt::STATUS_COMPLETED || $attempt->recommended_level === null) {
            abort(403);
        }

        // The only placement writer of users.preferred_level: explicit
        // accept. Browsing never touches it; submit never touches it.
        $user->forceFill(['preferred_level' => $attempt->recommended_level])->save();

        if ($request->expectsJson()) {
            return response()->json(['preferred_level' => $user->preferred_level])
                ->withHeaders(NoStore::headers());
        }

        return redirect()->route('placement.result', $attempt)->with('status', 'سطح ترجیحی ذخیره شد.');
    }

    private function currentVersion(): ?PlacementTest
    {
        return PlacementTest::where('status', PlacementTest::STATUS_PUBLISHED)
            ->where('is_current', true)
            ->orderByDesc('id')
            ->first();
    }

    private function attemptRedirect(Request $request, PlacementAttempt $attempt)
    {
        if ($request->expectsJson()) {
            return response()->json(['id' => $attempt->id, 'status' => $attempt->status])
                ->withHeaders(NoStore::headers());
        }

        return redirect()->route('placement.show', $attempt);
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $code = (string) $e->getCode();

        return $code === '23505'
            || str_contains(strtolower((string) $e->getMessage()), 'duplicate key')
            || str_contains(strtolower((string) $e->getMessage()), 'unique');
    }
}
