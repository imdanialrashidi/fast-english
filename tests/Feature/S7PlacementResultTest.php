<?php

use App\Actions\PublishPlacementTest;
use App\Models\PlacementAnswer;
use App\Models\PlacementAttempt;
use App\Models\PlacementQuestion;
use App\Models\PlacementTest;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;
use Tests\Support\ContentFixtures;

// S7 result, preference, versioning, and disabled state (scope §12,
// AC-09). Two users plus a negative path per protected route. No mocking
// of the database, session, or answer scoring.

function s7ResultVersion(string $tag, ?callable $correctFor = null): PlacementTest
{
    $test = PublishPlacementTest::createDraft($tag);
    for ($position = 1; $position <= 20; $position++) {
        $pad = str_pad((string) $position, 2, '0', STR_PAD_LEFT);
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
            $correctFor !== null ? (int) $correctFor($position) : ($position - 1) % 4,
        );
    }

    return PublishPlacementTest::publish($test->fresh());
}

function s7Fill(object $test, User $user, PlacementAttempt $attempt, callable $pick): void
{
    $questions = PlacementQuestion::where('test_id', $attempt->test_id)->orderBy('position')->get();
    $key = PlacementQuestion::where('test_id', $attempt->test_id)->pluck('correct_option', 'id')->all();
    foreach ($questions as $question) {
        $test->actingAs($user)->post(route('placement.answer', $attempt), [
            'question_id' => $question->id,
            'selected_option' => (int) $pick($question, $key),
        ])->assertRedirect();
    }
}

beforeEach(function () {
    // Paid-only slice: placement needs an active subscription.
    $this->studentA = ContentFixtures::subscribedStudent();
    $this->studentB = ContentFixtures::subscribedStudent();
});

// S7-4 (submit idempotency): a double submit yields one stored result and
// one completed row. The concurrent-race leg lives in S7SubmitRaceTest
// with two real OS processes.
test('double submit returns the stored result with one completed row', function () {
    s7ResultVersion('s7-idem-v1 (TEST)');

    $this->actingAs($this->studentA)->post(route('placement.start'))->assertRedirect();
    $attempt = PlacementAttempt::where('user_id', $this->studentA->id)->firstOrFail();
    s7Fill($this, $this->studentA, $attempt, fn ($q, $key) => (int) $key[$q->id]);

    $this->actingAs($this->studentA)->post(route('placement.submit', $attempt))->assertRedirect();
    $first = $attempt->fresh();
    expect($first->status)->toBe(PlacementAttempt::STATUS_COMPLETED)
        ->and((int) $first->score)->toBe(20)
        ->and($first->recommended_level)->toBe('C1');

    // Replay: same result, no new row, no re-scoring.
    $this->actingAs($this->studentA)->post(route('placement.submit', $attempt))->assertRedirect();
    expect(PlacementAttempt::where('user_id', $this->studentA->id)->count())->toBe(1);
    $replay = $attempt->fresh();
    expect($replay->status)->toBe(PlacementAttempt::STATUS_COMPLETED)
        ->and((int) $replay->score)->toBe(20)
        ->and($replay->recommended_level)->toBe('C1');
    expect(PlacementAnswer::where('attempt_id', $attempt->id)->count())->toBe(20);

    // JSON replay carries score + level but never the answer key.
    $json = $this->actingAs($this->studentA)->postJson(route('placement.submit', $attempt))->assertOk()->json();
    expect($json['score'])->toBe(20);
    expect($json['recommended_level'])->toBe('C1');
    expect(json_encode($json))->not->toContain('correct_option');

    // Isolation: the second student still has no result.
    expect(PlacementAttempt::where('user_id', $this->studentB->id)->count())->toBe(0);
});

// S7-5 (preferred level): only the accept action changes preferred_level.
// Browsing does not, and recommended_level is written only at completion.
test('only accept changes preferred level; browsing never does', function () {
    s7ResultVersion('s7-pref-v1 (TEST)');

    $this->actingAs($this->studentA)->post(route('placement.start'))->assertRedirect();
    $attempt = PlacementAttempt::where('user_id', $this->studentA->id)->firstOrFail();

    // Browsing: index + questions leave both levels untouched.
    $this->actingAs($this->studentA)->get(route('placement.index'))->assertOk();
    $this->actingAs($this->studentA)->get(route('placement.show', $attempt))->assertOk();
    expect($this->studentA->fresh()->preferred_level)->toBeNull();
    expect($attempt->fresh()->recommended_level)->toBeNull();

    // A wrong sweep scores 0 → A1 (fixture map, not a CEFR claim).
    s7Fill($this, $this->studentA, $attempt, fn ($q, $key) => ((int) $key[$q->id] + 1) % 4);
    $this->actingAs($this->studentA)->post(route('placement.submit', $attempt))->assertRedirect();
    $done = $attempt->fresh();
    expect((int) $done->score)->toBe(0);
    expect($done->recommended_level)->toBe('A1');
    // Submit writes recommended_level but never preferred_level.
    expect($this->studentA->fresh()->preferred_level)->toBeNull();

    // Result browsing still changes nothing.
    // Public-slice port (ADR-0002): the disclaimer renders client-side
    // (proven in the browser); HTTP asserts the component and the
    // server-marked score props.
    $this->actingAs($this->studentA)->get(route('placement.result', $done))->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Placement/Result')
            ->where('attempt.score', 0)
            ->where('attempt.recommended_level', 'A1'));
    expect($this->studentA->fresh()->preferred_level)->toBeNull();

    // Accept writes preferred_level explicitly.
    $this->actingAs($this->studentA)->post(route('placement.accept', $done))->assertRedirect();
    expect($this->studentA->fresh()->preferred_level)->toBe('A1');

    // The other student is unaffected and cannot accept this attempt.
    expect($this->studentB->fresh()->preferred_level)->toBeNull();
    $this->actingAs($this->studentB)->post(route('placement.accept', $done))->assertForbidden();
    $this->actingAs($this->studentB)->post(route('placement.submit', $done))->assertForbidden();
});

// S7-6 (versioning): publishing version 2 stops new starts on version 1.
// An open version-1 attempt still scores against version 1.
test('new starts pin to version 2 while open version-1 attempts score v1', function () {
    $v1 = s7ResultVersion('s7-ver-v1 (TEST)');
    $this->actingAs($this->studentA)->post(route('placement.start'))->assertRedirect();
    $openV1 = PlacementAttempt::where('user_id', $this->studentA->id)->firstOrFail();
    expect((int) $openV1->test_id)->toBe((int) $v1->id);

    // Version 2 uses a shifted key so v1-vs-v2 scoring is distinguishable.
    $v2 = s7ResultVersion('s7-ver-v2 (TEST)', fn ($position) => $position % 4);
    expect((int) $v2->id)->not->toBe((int) $v1->id);

    // A fresh learner starts on version 2, never version 1.
    $this->actingAs($this->studentB)->post(route('placement.start'))->assertRedirect();
    $onV2 = PlacementAttempt::where('user_id', $this->studentB->id)->firstOrFail();
    expect((int) $onV2->test_id)->toBe((int) $v2->id);

    // The open v1 attempt still answers and scores against v1's key.
    s7Fill($this, $this->studentA, $openV1->fresh(), function ($question, $key) {
        return (int) $key[$question->id];
    });
    $this->actingAs($this->studentA)->post(route('placement.submit', $openV1))->assertRedirect();
    $scored = $openV1->fresh();
    expect((int) $scored->test_id)->toBe((int) $v1->id);
    expect((int) $scored->score)->toBe(20);
    expect($scored->recommended_level)->toBe('C1');

    // Published versions are immutable: editing v1 is refused.
    try {
        $v1->forceFill(['version' => 'mutated'])->save();
        $mutated = true;
    } catch (RuntimeException) {
        $mutated = false;
    }
    expect($mutated)->toBeFalse();
});

// S7-7 (disabled state): with no approved version, the neutral state
// appears and the manual level path works. Everything else stays up.
test('with no current version the neutral state and manual path work', function () {
    // Fresh Pest database: no placement versions exist here.
    expect(PlacementTest::where('status', PlacementTest::STATUS_PUBLISHED)->where('is_current', true)->count())->toBe(0);

    // Public-slice port (ADR-0002): the neutral state travels as a null
    // current version; the manual level path renders client-side.
    $this->actingAs($this->studentA)->get(route('placement.index'))->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Placement/Index')
            ->where('current', null)
            ->where('openAttempt', null));

    // Starting with no current version is refused and stores nothing.
    $this->actingAs($this->studentA)->postJson(route('placement.start'))->assertStatus(422);
    expect(PlacementAttempt::where('user_id', $this->studentA->id)->count())->toBe(0);

    // The manual level path works from the neutral state.
    $this->actingAs($this->studentA)->get(route('account.settings'))->assertOk();
    $this->actingAs($this->studentA)->patch(route('account.settings.update'), ['preferred_level' => 'B1'])->assertRedirect();
    expect($this->studentA->fresh()->preferred_level)->toBe('B1');

    // Everything else stays available (library + account).
    $this->actingAs($this->studentA)->get(route('app.home'))->assertOk();
    $this->actingAs($this->studentA)->get(route('app.account'))->assertOk();

    // Guests are redirected (negative path); the scheme table exists.
    auth()->guard('web')->logout();
    $this->get(route('placement.index'))->assertRedirect();
    expect(Schema::hasTable('placement_answers'))->toBeTrue();
});
