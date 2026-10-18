<?php

use App\Actions\PublishPlacementTest;
use App\Models\PlacementAnswer;
use App\Models\PlacementAttempt;
use App\Models\PlacementQuestion;
use App\Models\PlacementTest;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Tests\Support\ContentFixtures;

// S7 placement flow (scope §12, AC-09): pinned attempts, per-question
// saves, server marking, explicit accept. Every question/seed row is
// FIXTURE (never real exam content). Two users plus a negative path per
// protected route throughout. No mocking of the database, session, or
// answer scoring.

function s7BuildVersion(string $tag, ?callable $correctFor = null): PlacementTest
{
    $test = PublishPlacementTest::createDraft($tag);
    for ($position = 1; $position <= 20; $position++) {
        $pad = str_pad((string) $position, 2, '0', STR_PAD_LEFT);
        $correct = $correctFor !== null
            ? (int) $correctFor($position)
            : ($position - 1) % 4;
        PublishPlacementTest::addQuestion(
            $test->fresh(),
            $position,
            "FIXTURE question {$pad} {$tag} — choose the marked option (TEST)",
            [
                "FIXTURE option A-{$pad} {$tag} (TEST)",
                "FIXTURE option B-{$pad} {$tag} (TEST)",
                "FIXTURE option C-{$pad} {$tag} (TEST)",
                "FIXTURE option D-{$pad} {$tag} (TEST)",
            ],
            $correct,
        );
    }

    return PublishPlacementTest::publish($test->fresh());
}

/** @return array{questions: Collection, key: array<int, int>} */
function s7Key(PlacementTest $test): array
{
    $questions = PlacementQuestion::where('test_id', $test->id)->orderBy('position')->get();
    $key = $questions->pluck('correct_option', 'id')->map(fn ($v) => (int) $v)->all();

    return ['questions' => $questions, 'key' => $key];
}

function s7AnswerAll(object $test, User $user, PlacementAttempt $attempt, bool $correct = true): void
{
    ['questions' => $questions, 'key' => $key] = s7Key($attempt->test()->first() ?? PlacementTest::find($attempt->test_id));
    foreach ($questions as $question) {
        $selected = $correct
            ? (int) $key[$question->id]
            : ((int) $key[$question->id] + 1) % 4;
        $test->actingAs($user)->post(route('placement.answer', $attempt), [
            'question_id' => $question->id,
            'selected_option' => $selected,
        ])->assertRedirect();
    }
}

beforeEach(function () {
    // Paid-only slice: placement needs an active subscription.
    $this->studentA = ContentFixtures::subscribedStudent();
    $this->studentB = ContentFixtures::subscribedStudent();
});

// S7-1 (answer key absent): the question page HTML and every JSON payload
// carry no correct_option or scoring rule. Proven with two users.
test('question pages and JSON carry no answer key for either user', function () {
    $version = s7BuildVersion('s7-key-v1 (TEST)');

    $this->actingAs($this->studentA)->post(route('placement.start'))->assertRedirect();
    $this->actingAs($this->studentB)->post(route('placement.start'))->assertRedirect();
    $attemptA = PlacementAttempt::where('user_id', $this->studentA->id)->firstOrFail();
    $attemptB = PlacementAttempt::where('user_id', $this->studentB->id)->firstOrFail();

    foreach ([[$this->studentA, $attemptA], [$this->studentB, $attemptB]] as [$user, $attempt]) {
        $html = $this->actingAs($user)->get(route('placement.show', $attempt))->assertOk()->getContent() ?? '';
        expect($html)->not->toContain('correct_option')
            ->and($html)->not->toContain('scoring_rules')
            ->and($html)->not->toContain('scoring-rules')
            ->and($html)->toContain('FIXTURE question 01');

        // Every seeded prompt/option row is marked FIXTURE.
        expect($html)->toContain('FIXTURE option A-01');
    }

    // Answer endpoint JSON carries id + status only (no key, no score).
    ['questions' => $questions] = s7Key($version);
    $first = $questions->first();
    $answerJson = $this->actingAs($this->studentA)->postJson(route('placement.answer', $attemptA), [
        'question_id' => $first->id,
        'selected_option' => 0,
    ])->assertOk()->json();
    expect(array_keys($answerJson))->toBe(['id', 'status']);
    expect(json_encode($answerJson))->not->toContain('correct_option');

    // Model serialization hides the key even if ever dumped.
    expect($first->toArray())->not->toHaveKey('correct_option');
    expect($version->toArray())->not->toHaveKey('scoring_rules');

    // Negative paths: guests are redirected, the other student is refused.
    auth()->guard('web')->logout();
    $this->get(route('placement.show', $attemptA))->assertRedirect();
    $this->get(route('placement.index'))->assertRedirect();
    $this->actingAs($this->studentB)->get(route('placement.show', $attemptA))->assertForbidden();
    $this->actingAs($this->studentB)->get(route('placement.result', $attemptA))->assertForbidden();
});

// S7-2 (start and resume): a second start while one is open returns the
// same attempt; a start within 24 hours is refused; resume restores saves.
test('second start resumes the open attempt and 24-hour restart is refused', function () {
    s7BuildVersion('s7-resume-v1 (TEST)');

    $this->actingAs($this->studentA)->post(route('placement.start'))->assertRedirect();
    $first = PlacementAttempt::where('user_id', $this->studentA->id)->firstOrFail();

    $this->actingAs($this->studentA)->post(route('placement.start'))->assertRedirect();
    expect(PlacementAttempt::where('user_id', $this->studentA->id)->count())->toBe(1);
    $second = PlacementAttempt::where('user_id', $this->studentA->id)->firstOrFail();
    expect($second->id)->toBe($first->id);

    // Save two answers, leave, and resume: the selections are restored.
    ['questions' => $questions, 'key' => $key] = s7Key($first->test);
    $q1 = $questions[0];
    $q2 = $questions[1];
    $this->actingAs($this->studentA)->post(route('placement.answer', $first), [
        'question_id' => $q1->id, 'selected_option' => (int) $key[$q1->id],
    ])->assertRedirect();
    $this->actingAs($this->studentA)->post(route('placement.answer', $first), [
        'question_id' => $q2->id, 'selected_option' => ((int) $key[$q2->id] + 2) % 4,
    ])->assertRedirect();

    // Public-slice port (ADR-0002): resume state travels as the
    // `selected` prop (the radios render client-side); two saved answers
    // mean two selected entries.
    $resumed = $this->actingAs($this->studentA)->get(route('placement.show', $first))->assertOk();
    expect($resumed->inertiaProps()['selected'])->toHaveCount(2);

    // The second student is isolated: their attempt is empty and separate.
    $this->actingAs($this->studentB)->post(route('placement.start'))->assertRedirect();
    $other = PlacementAttempt::where('user_id', $this->studentB->id)->firstOrFail();
    expect($other->id)->not->toBe($first->id);
    expect(PlacementAnswer::where('attempt_id', $other->id)->count())->toBe(0);

    // Finish A's attempt, then an immediate restart is refused (24h rule).
    s7AnswerAll($this, $this->studentA, $first->fresh(), true);
    // Two answers above are overwritten by the full correct sweep; the
    // sweep itself proves resume-then-complete works.
    $this->actingAs($this->studentA)->post(route('placement.submit', $first))->assertRedirect();
    expect($first->fresh()->status)->toBe(PlacementAttempt::STATUS_COMPLETED);

    $this->actingAs($this->studentA)->postJson(route('placement.start'))->assertStatus(429);
    expect(PlacementAttempt::where('user_id', $this->studentA->id)->count())->toBe(1);
});

// S7-3 (submit validation): duplicate, foreign, or incomplete answers are
// refused, and no result is stored.
test('duplicate, foreign, and incomplete submits store no result', function () {
    $version = s7BuildVersion('s7-valid-v1 (TEST)');
    $otherVersion = PublishPlacementTest::createDraft('s7-valid-v2-draft (TEST)');
    PublishPlacementTest::addQuestion($otherVersion->fresh(), 1, 'FIXTURE foreign question (TEST)', ['FIXTURE A (TEST)', 'FIXTURE B (TEST)', 'FIXTURE C (TEST)', 'FIXTURE D (TEST)'], 0);
    $foreign = PlacementQuestion::where('test_id', $otherVersion->id)->firstOrFail();

    $this->actingAs($this->studentA)->post(route('placement.start'))->assertRedirect();
    $attempt = PlacementAttempt::where('user_id', $this->studentA->id)->firstOrFail();
    ['questions' => $questions, 'key' => $key] = s7Key($version);

    // Incomplete: 19 of 20 answered → 422, nothing stored.
    foreach ($questions->take(19) as $question) {
        $this->actingAs($this->studentA)->post(route('placement.answer', $attempt), [
            'question_id' => $question->id, 'selected_option' => (int) $key[$question->id],
        ])->assertRedirect();
    }
    $this->actingAs($this->studentA)->postJson(route('placement.submit', $attempt))->assertStatus(422);
    $fresh = $attempt->fresh();
    expect($fresh->status)->toBe(PlacementAttempt::STATUS_IN_PROGRESS)
        ->and($fresh->score)->toBeNull()
        ->and($fresh->recommended_level)->toBeNull()
        ->and($fresh->completed_at)->toBeNull();

    // Foreign: a question from another version is refused with no write.
    $before = PlacementAnswer::where('attempt_id', $attempt->id)->count();
    $this->actingAs($this->studentA)->postJson(route('placement.answer', $attempt), [
        'question_id' => $foreign->id, 'selected_option' => 0,
    ])->assertStatus(422);
    expect(PlacementAnswer::where('attempt_id', $attempt->id)->count())->toBe($before);
    expect($attempt->fresh()->status)->toBe(PlacementAttempt::STATUS_IN_PROGRESS);

    // Duplicate: re-answering the same question upserts exactly one row.
    $repeat = $questions->first();
    $this->actingAs($this->studentA)->post(route('placement.answer', $attempt), [
        'question_id' => $repeat->id, 'selected_option' => ((int) $key[$repeat->id] + 1) % 4,
    ])->assertRedirect();
    expect(PlacementAnswer::where('attempt_id', $attempt->id)->where('question_id', $repeat->id)->count())->toBe(1);

    // The unique index backs the no-duplicate rule (no raw violating
    // insert here: a failed statement would abort the test transaction
    // on PostgreSQL; the endpoint upsert above already proves one row).
    $indexes = DB::select("select indexname from pg_indexes where tablename = 'placement_answers'");
    $names = collect($indexes)->pluck('indexname')->all();
    expect($names)->toContain('placement_answers_attempt_id_question_id_unique');

    // The other student cannot touch this attempt (negative path).
    $this->actingAs($this->studentB)->postJson(route('placement.submit', $attempt))->assertForbidden();
    expect($attempt->fresh()->status)->toBe(PlacementAttempt::STATUS_IN_PROGRESS);
});
