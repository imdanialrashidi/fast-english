<?php

namespace App\Http\Controllers;

use App\Models\ExerciseAnswer;
use App\Models\ExerciseAttempt;
use App\Models\ExerciseItem;
use App\Models\ExerciseSet;
use App\Models\FlashcardBook;
use App\Models\User;
use App\Support\Exercises\ExerciseProgress;
use App\Support\Exercises\Grader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * One-question marking for the grammar-first unit page. The first answer to
 * a question is stored and counted; answering the same question again
 * returns that stored result and never increases progress. The answer key,
 * the explanation and the option feedback are only ever returned here,
 * after the learner has committed to an answer.
 */
class ExerciseController extends Controller
{
    public function answer(Request $request, FlashcardBook $book, int $unit): JsonResponse
    {
        abort_unless($book->status === 'published', 404);

        $user = $this->learner($request);
        $unitModel = $book->units()->where('number', $unit)->firstOrFail();

        $set = ExerciseSet::query()
            ->published()
            ->where('unit_id', $unitModel->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->first();

        abort_if($set === null, 404);

        $data = $request->validate([
            'item_id' => ['required', 'integer'],
            'response' => ['required'],
        ]);

        $item = ExerciseItem::query()
            ->where('set_id', $set->id)
            ->whereKey((int) $data['item_id'])
            ->firstOrFail();

        $this->validateResponse($item, $data['response']);

        $first = ExerciseProgress::firstAnswers($user, [(int) $item->id]);

        if (isset($first[$item->id])) {
            return response()->json($this->result($item, $first[$item->id], true));
        }

        $correct = Grader::isCorrect($item, $data['response']);

        $stored = DB::transaction(function () use ($user, $set, $item, $data, $correct): array {
            $attempt = ExerciseAttempt::create([
                'user_id' => $user->id,
                'set_id' => $set->id,
                'score' => $correct ? 1 : 0,
                'total' => 1,
                'submitted_at' => now(),
            ]);

            $answer = ExerciseAnswer::create([
                'attempt_id' => $attempt->id,
                'item_id' => $item->id,
                'response' => $data['response'],
                'is_correct' => $correct,
            ]);

            return [
                'response' => $answer->response,
                'is_correct' => $correct,
                'answered_at' => $answer->created_at?->toIso8601String(),
            ];
        });

        return response()->json($this->result($item, $stored, false));
    }

    /**
     * @param  array{response: mixed, is_correct: bool, answered_at: ?string}  $answer
     * @return array<string, mixed>
     */
    private function result(ExerciseItem $item, array $answer, bool $already): array
    {
        $feedback = is_array($item->feedback) ? $item->feedback : [];
        $chosen = $answer['response'];
        $feedbackFa = null;

        if ($item->type === 'choice' && is_numeric($chosen)) {
            $text = $feedback[(string) (int) $chosen] ?? null;
            $feedbackFa = is_string($text) && $text !== '' ? $text : null;
        }

        return [
            'item_id' => (int) $item->id,
            'is_correct' => $answer['is_correct'],
            'already' => $already,
            'correct' => Grader::displayAnswer($item),
            'explanation_fa' => $item->explanation_fa,
            'feedback_fa' => $feedbackFa,
        ];
    }

    private function validateResponse(ExerciseItem $item, mixed $response): void
    {
        if ($item->type === 'choice') {
            $options = is_array($item->options) ? array_values($item->options) : [];

            if (! is_int($response) || $response < 0 || $response >= count($options)) {
                throw ValidationException::withMessages(['response' => 'یکی از گزینه‌ها را انتخاب کنید.']);
            }

            return;
        }

        if ($item->type === 'matching') {
            $left = is_array($item->options) && is_array($item->options['left'] ?? null)
                ? array_values($item->options['left'])
                : [];

            if (! is_array($response) || count($response) !== count($left)) {
                throw ValidationException::withMessages(['response' => 'هر مورد را به یک جفت وصل کنید.']);
            }

            foreach ($response as $chosen) {
                if (! is_int($chosen) || $chosen < 0 || $chosen >= count($left)) {
                    throw ValidationException::withMessages(['response' => 'اتصال‌ها معتبر نیستند.']);
                }
            }

            return;
        }

        throw ValidationException::withMessages(['response' => 'نوع سؤال پشتیبانی نمی‌شود.']);
    }

    private function learner(Request $request): User
    {
        $user = $request->user();
        abort_if($user === null || $user->disabled_at !== null, 403);

        return $user;
    }
}
