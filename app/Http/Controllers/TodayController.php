<?php

namespace App\Http\Controllers;

use App\Support\DailyPlan;
use App\Support\TopicCard;
use App\Support\TopicCover;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * R5 Today — «امروز» (PLAN-01): the principal signed-in student
 * destination. Greeting, Continue Learning, today's plan, goal progress,
 * due vocabulary, and recommendations — every row derived from persisted
 * state via DailyPlan (never stored, never a self-toggling button).
 */
class TodayController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        if ($user === null || $user->disabled_at !== null) {
            abort(403);
        }

        $plan = DailyPlan::build($user);
        $recommendations = DailyPlan::recommendations($user, 3, $plan['eligible'] ?? null);

        // Public-slice Inertia transport (ADR-0002): the same DailyPlan
        // derivation, the same continue/task shapes, the same
        // level/premium rules. Props are plain arrays — DailyPlan is
        // computed, never stored, and tasks stay links (never self-
        // toggling buttons). Persistence/goal-isolation proofs are
        // unchanged (R5DailyPlanTest ports, JSON endpoints untouched).
        return Inertia::render('Today/Index', [
            'userName' => (string) $user->name,
            'needsLevel' => $user->preferred_level === null,
            'plan' => [
                'goal_minutes' => (int) $plan['goal_minutes'],
                'learned_minutes' => (int) $plan['learned_minutes'],
                'progress_pct' => (int) $plan['progress_pct'],
                'due_words' => (int) $plan['due_words'],
                'tasks' => array_values(array_map(fn (array $task) => [
                    'key' => (string) $task['key'],
                    'title' => (string) $task['title'],
                    'detail' => isset($task['detail']) && $task['detail'] !== '' ? (string) $task['detail'] : null,
                    'url' => (string) $task['url'],
                    'done' => (bool) $task['done'],
                    'title_en' => $task['title_en'] ?? null,
                    'level' => $task['level'] ?? null,
                    'cover_url' => TopicCover::url(isset($task['cover_path']) && is_string($task['cover_path']) ? $task['cover_path'] : null),
                    'position_seconds' => isset($task['position_seconds']) ? (float) $task['position_seconds'] : null,
                    'estimated_minutes' => isset($task['estimated_minutes']) ? (int) $task['estimated_minutes'] : null,
                ], $plan['tasks'])),
            ],
            'recommendations' => array_values(array_map(fn ($topic) => TopicCard::for($topic), $recommendations)),
        ]);
    }
}
