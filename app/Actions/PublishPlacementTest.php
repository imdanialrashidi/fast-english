<?php

namespace App\Actions;

use App\Models\PlacementQuestion;
use App\Models\PlacementTest;
use App\Support\PlacementLevel;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * S7 placement versioning (scope §12): exactly 20 four-option questions
 * per version, one published current at a time, published versions and
 * their questions immutable.
 *
 * - createDraft(version): new draft row with the indicative scoring map.
 * - addQuestion(test, position, prompt, options, correct): validates the
 *   four-option shape; refused on published versions (model guard).
 * - publish(test): requires exactly 20 questions at positions 1–20, each
 *   with 4 options and correct_option 0–3; marks published + current and
 *   retires the previous current. New starts pin to the new current;
 *   open attempts stay pinned to their original version and still score
 *   against it (submit reads attempt.test_id, never the current).
 */
final class PublishPlacementTest
{
    public static function createDraft(string $version): PlacementTest
    {
        $version = trim($version);
        if ($version === '') {
            throw ValidationException::withMessages(['version' => 'نسخه آزمون الزامی است.']);
        }

        $test = new PlacementTest;
        $test->forceFill([
            'version' => $version,
            'status' => PlacementTest::STATUS_DRAFT,
            'is_current' => false,
            'scoring_rules' => [
                'map' => PlacementLevel::map(),
                'note' => 'indicative placement, A1–C1; not a certified CEFR exam',
            ],
        ]);
        $test->save();

        return $test->fresh();
    }

    /**
     * @param  list<string>  $options
     */
    public static function addQuestion(
        PlacementTest $test,
        int $position,
        string $prompt,
        array $options,
        int $correctOption
    ): PlacementQuestion {
        if ($test->status === PlacementTest::STATUS_PUBLISHED) {
            throw ValidationException::withMessages(['test' => 'نسخه منتشرشده تغییرناپذیر است؛ نسخه جدید بسازید.']);
        }
        if ($position < 1 || $position > 20) {
            throw ValidationException::withMessages(['position' => 'شماره سؤال باید بین ۱ تا ۲۰ باشد.']);
        }
        if (trim($prompt) === '') {
            throw ValidationException::withMessages(['prompt' => 'متن سؤال الزامی است.']);
        }
        if (count($options) !== 4 || count(array_filter($options, fn ($o) => trim((string) $o) !== '')) !== 4) {
            throw ValidationException::withMessages(['options' => 'هر سؤال دقیقاً ۴ گزینه غیرخالی دارد.']);
        }
        if ($correctOption < 0 || $correctOption > 3) {
            throw ValidationException::withMessages(['correct_option' => 'گزینه صحیح باید بین ۰ تا ۳ باشد.']);
        }

        $question = new PlacementQuestion;
        $question->forceFill([
            'test_id' => $test->id,
            'position' => $position,
            'prompt' => $prompt,
            'options' => array_values($options),
            'correct_option' => $correctOption,
        ]);
        $question->save();

        return $question->fresh();
    }

    public static function publish(PlacementTest $test): PlacementTest
    {
        if ($test->status === PlacementTest::STATUS_PUBLISHED && $test->is_current) {
            return $test->fresh();
        }
        if ($test->status === PlacementTest::STATUS_ARCHIVED) {
            throw ValidationException::withMessages(['test' => 'نسخه بایگانی‌شده قابل انتشار نیست.']);
        }

        $questions = PlacementQuestion::where('test_id', $test->id)->orderBy('position')->get();
        if ($questions->count() !== 20) {
            throw ValidationException::withMessages(['test' => 'انتشار نیازمند دقیقاً ۲۰ سؤال است.']);
        }
        $positions = $questions->pluck('position')->all();
        if ($positions !== range(1, 20)) {
            throw ValidationException::withMessages(['test' => 'شماره سؤال‌ها باید ۱ تا ۲۰ بدون تکرار باشد.']);
        }
        foreach ($questions as $question) {
            $options = $question->options ?? [];
            if (! is_array($options) || count($options) !== 4) {
                throw ValidationException::withMessages(['test' => 'هر سؤال دقیقاً ۴ گزینه دارد.']);
            }
            if ($question->correct_option < 0 || $question->correct_option > 3) {
                throw ValidationException::withMessages(['test' => 'گزینه صحیح نامعتبر است.']);
            }
        }

        return DB::transaction(function () use ($test) {
            $locked = PlacementTest::where('id', $test->id)->lockForUpdate()->firstOrFail();

            PlacementTest::where('is_current', true)
                ->where('id', '!=', $locked->id)
                ->lockForUpdate()
                ->update(['is_current' => false]);

            $locked->forceFill([
                'status' => PlacementTest::STATUS_PUBLISHED,
                'is_current' => true,
                'published_at' => now(),
            ]);
            // Bypass the published-immutability guard for this
            // draft→published transition: the guard blocks edits to
            // already-published rows, and this row is still a draft here.
            $locked->save();

            return $locked->fresh();
        });
    }
}
