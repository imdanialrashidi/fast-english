<?php

use App\Models\PlacementAnswer;
use App\Models\PlacementAttempt;
use App\Models\PlacementQuestion;
use App\Models\PlacementTest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

// S7-4 race leg (scope §11-style proof applied to §12, AC-09): two REAL
// database connections — two separate `php artisan placement:submit` OS
// processes, each booting its own Laravel with an independent PostgreSQL
// connection — submit the same fully-answered attempt concurrently.
// Exactly one completed row with one stored score must survive; the loser
// replays idempotently (exit 0, "already completed").
//
// Isolation: Pest wraps the default connection in a transaction invisible
// to other connections. Every fixture here is created through a committed
// `pgsql_race` connection (same credentials, autocommit) and deleted
// afterwards, so the suite stays hermetic.

function s7RaceConnection(): string
{
    config(['database.connections.pgsql_race' => config('database.connections.pgsql')]);
    DB::purge('pgsql_race');

    return 'pgsql_race';
}

function s7RaceEnv(): array
{
    $pgsql = config('database.connections.pgsql');

    return [
        'APP_ENV' => 'testing',
        'APP_KEY' => config('app.key'),
        'APP_DEBUG' => 'false',
        'DB_CONNECTION' => 'pgsql',
        'DB_HOST' => $pgsql['host'],
        'DB_PORT' => (string) ($pgsql['port'] ?? '5432'),
        'DB_DATABASE' => $pgsql['database'],
        'DB_USERNAME' => $pgsql['username'],
        'DB_PASSWORD' => $pgsql['password'],
        'CACHE_STORE' => 'array',
        'SESSION_DRIVER' => 'array',
        'QUEUE_CONNECTION' => 'sync',
    ];
}

/** @return array{user: User, attempt: PlacementAttempt, score: int} */
function s7RaceFixture(string $tag): array
{
    $conn = s7RaceConnection();
    $uniq = $tag.'-'.uniqid();

    $user = User::on($conn)->forceCreate([
        'name' => 'Race Learner '.$uniq,
        'email' => "race-learner-{$uniq}@example.com",
        'password' => 'password',
        'is_staff' => false,
        'email_verified_at' => now(),
    ]);

    $test = PlacementTest::on($conn)->forceCreate([
        'version' => "s7-race-{$uniq} (TEST)",
        'status' => PlacementTest::STATUS_DRAFT,
        'is_current' => false,
        'scoring_rules' => ['note' => 'FIXTURE — not a validated CEFR scale'],
    ]);

    // FIXTURE rows only (never real exam content); key rotates 0–3.
    $key = [];
    for ($position = 1; $position <= 20; $position++) {
        $pad = str_pad((string) $position, 2, '0', STR_PAD_LEFT);
        $correct = ($position - 1) % 4;
        $question = PlacementQuestion::on($conn)->forceCreate([
            'test_id' => $test->id,
            'position' => $position,
            'prompt' => "FIXTURE question {$pad} race {$uniq} (TEST)",
            'options' => [
                "FIXTURE option A-{$pad} (TEST)",
                "FIXTURE option B-{$pad} (TEST)",
                "FIXTURE option C-{$pad} (TEST)",
                "FIXTURE option D-{$pad} (TEST)",
            ],
            'correct_option' => $correct,
        ]);
        $key[$question->id] = $correct;
    }

    $attempt = PlacementAttempt::on($conn)->forceCreate([
        'user_id' => $user->id,
        'test_id' => $test->id,
        'status' => PlacementAttempt::STATUS_IN_PROGRESS,
        'started_at' => now(),
    ]);

    // Publish after the questions exist (the immutability guard refuses
    // question writes on published versions, so the draft→published flip
    // happens last).
    $test->forceFill(['status' => PlacementTest::STATUS_PUBLISHED, 'published_at' => now()])->save();

    // Fully answered, all correct → score 20 → C1 (the test ceiling).
    foreach ($key as $questionId => $correct) {
        PlacementAnswer::on($conn)->forceCreate([
            'attempt_id' => $attempt->id,
            'question_id' => $questionId,
            'selected_option' => $correct,
            'is_correct' => null,
        ]);
    }

    return ['user' => $user, 'attempt' => $attempt, 'score' => 20];
}

function s7RaceCleanup(array $fixture): void
{
    $conn = s7RaceConnection();
    PlacementAnswer::on($conn)->where('attempt_id', $fixture['attempt']->id)->delete();
    PlacementAttempt::on($conn)->where('id', $fixture['attempt']->id)->delete();
    $testId = (int) $fixture['attempt']->test_id;
    PlacementQuestion::on($conn)->where('test_id', $testId)->delete();
    PlacementTest::on($conn)->where('id', $testId)->delete();
    User::on($conn)->where('id', $fixture['user']->id)->delete();
}

test('parallel submits yield one stored result and one completed row', function () {
    $fixture = s7RaceFixture('submit');
    try {
        $env = s7RaceEnv();
        $make = fn () => new Process(
            [PHP_BINARY, base_path('artisan'), 'placement:submit', (string) $fixture['attempt']->id],
            base_path(),
            $env
        );

        $first = $make();
        $second = $make();
        $first->start();
        $second->start();
        $first->wait();
        $second->wait();

        // Both report success: the winner completes, the loser replays
        // idempotently (exit 0 with "already completed"). Exactly one
        // stored effect.
        expect($first->isSuccessful())->toBeTrue($first->getErrorOutput().' '.$first->getOutput());
        expect($second->isSuccessful())->toBeTrue($second->getErrorOutput().' '.$second->getOutput());

        $conn = s7RaceConnection();
        $rows = PlacementAttempt::on($conn)->where('id', $fixture['attempt']->id)->get();
        expect($rows)->toHaveCount(1);

        $attempt = $rows->first();
        expect($attempt->status)->toBe(PlacementAttempt::STATUS_COMPLETED);
        expect((int) $attempt->score)->toBe(20);
        expect($attempt->recommended_level)->toBe('C1');
        expect($attempt->completed_at)->not->toBeNull();

        expect(PlacementAnswer::on($conn)->where('attempt_id', $attempt->id)->count())->toBe(20);
    } finally {
        s7RaceCleanup($fixture);
    }
});
