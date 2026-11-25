<?php

namespace App\Actions;

use App\Models\PlacementAnswer;
use App\Models\PlacementAttempt;
use App\Models\PlacementQuestion;
use App\Support\PlacementLevel;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * S7 shared submit owner (scope §12): server-side marking with
 * idempotent replay and row-locked race safety.
 *
 * Owner instruction 2026-11-25: the learner presses one final button and
 * every chosen option is saved at once. Blank questions are allowed; a
 * blank answer is simply not correct and never blocks the result. The
 * server still refuses foreign questions, duplicate rows, or out-of-range
 * options. The placement controller and the `placement:submit` CLI share
 * this action; the CLI passes no payload and submits whatever was saved.
 */
final class SubmitPlacement
{
    /**
     * @param  array<int, int>  $incomingAnswers  question_id => selected_option
     * @return array{attempt: PlacementAttempt, replayed: bool}
     *
     * @throws ValidationException
     */
    public static function submit(int $attemptId, array $incomingAnswers = []): array
    {
        return DB::transaction(function () use ($attemptId, $incomingAnswers) {
            $row = PlacementAttempt::where('id', $attemptId)->lockForUpdate()->firstOrFail();

            if ($row->status === PlacementAttempt::STATUS_COMPLETED) {
                return ['attempt' => $row, 'replayed' => true];
            }

            if ($row->status !== PlacementAttempt::STATUS_IN_PROGRESS) {
                throw ValidationException::withMessages(['attempt' => 'Only an open attempt can be submitted.']);
            }

            $questionIds = PlacementQuestion::where('test_id', $row->test_id)
                ->orderBy('position')
                ->pluck('id')
                ->all();
            $questionLookup = array_fill_keys(array_map('intval', $questionIds), true);

            foreach ($incomingAnswers as $questionId => $selectedOption) {
                $questionId = (int) $questionId;
                $selectedOption = (int) $selectedOption;

                if (! isset($questionLookup[$questionId])) {
                    throw ValidationException::withMessages(['answers' => 'پاسخ‌ها باید متعلق به همین آزمون باشند.']);
                }
                if ($selectedOption < 0 || $selectedOption > 3) {
                    throw ValidationException::withMessages(['answers' => 'گزینهٔ انتخاب‌شده معتبر نیست.']);
                }

                $answer = PlacementAnswer::query()
                    ->where('attempt_id', $row->id)
                    ->where('question_id', $questionId)
                    ->first();

                if ($answer === null) {
                    $answer = new PlacementAnswer;
                    $answer->forceFill([
                        'attempt_id' => $row->id,
                        'question_id' => $questionId,
                    ]);
                }

                $answer->forceFill([
                    'selected_option' => $selectedOption,
                    'is_correct' => null,
                ])->save();
            }

            $answers = PlacementAnswer::where('attempt_id', $row->id)->lockForUpdate()->get();

            if ($answers->count() > count($questionIds)) {
                throw ValidationException::withMessages(['answers' => 'پاسخ‌ها باید متعلق به همین آزمون باشند.']);
            }

            foreach ($answers as $answer) {
                if (! isset($questionLookup[(int) $answer->question_id])) {
                    throw ValidationException::withMessages(['answers' => 'پاسخ‌ها باید متعلق به همین آزمون باشند.']);
                }
            }

            $key = PlacementQuestion::where('test_id', $row->test_id)
                ->pluck('correct_option', 'id')
                ->all();

            $score = 0;
            foreach ($answers as $answer) {
                $correct = (int) ($key[$answer->question_id] ?? -1) === (int) $answer->selected_option;
                $answer->forceFill(['is_correct' => $correct])->save();
                if ($correct) {
                    $score++;
                }
            }

            $row->forceFill([
                'status' => PlacementAttempt::STATUS_COMPLETED,
                'completed_at' => now(),
                'score' => $score,
                'recommended_level' => PlacementLevel::forScore($score),
            ]);
            $row->save();

            return ['attempt' => $row->fresh(), 'replayed' => false];
        });
    }
}
