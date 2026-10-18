<?php

namespace App\Support;

use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Topic;
use App\Models\User;
use App\Models\VocabularyWord;

/**
 * R5 daily learning path (PLAN-01): a computed plan, never stored.
 *
 * Tasks derive from persisted state only: the latest lesson progress
 * (continue + listen), due vocabulary (review), and the newest suitable
 * lesson (next). Completion is read from lesson_progress.completed_at and
 * vocabulary review timestamps — never from a button that only changes
 * its own appearance. Premium lessons are only recommended to eligible
 * subscribers; everyone else gets the public sample or a subscribe task.
 */
final class DailyPlan
{
    public const GOALS = [5, 10, 15];

    /**
     * @return array{
     *   goal_minutes: int,
     *   learned_minutes: int,
     *   progress_pct: int,
     *   due_words: int,
     *   eligible: bool,
     *   tasks: list<array{key: string, title: string, detail: string|null, url: string, done: bool}>
     * }
     */
    public static function build(User $user): array
    {
        $goal = in_array((int) $user->daily_goal_minutes, self::GOALS, true)
            ? (int) $user->daily_goal_minutes
            : 10;

        $eligible = Entitlement::eligible($user);
        $today = now()->startOfDay();

        $continueProgress = LessonProgress::where('user_id', $user->id)
            ->with(['lesson.topic'])
            ->orderByDesc('updated_at')
            ->first();

        $continueLesson = ($continueProgress?->lesson !== null
            && $continueProgress->lesson->status === 'published'
            && $continueProgress->lesson->topic !== null
            && $continueProgress->lesson->topic->status === 'published'
            && ($eligible || $continueProgress->lesson->is_public_sample))
            ? $continueProgress->lesson
            : null;

        $dueWords = VocabularyWord::where('user_id', $user->id)
            ->where('status', 'learning')
            ->where('due_at', '<=', now())
            ->count();

        $reviewedToday = VocabularyWord::where('user_id', $user->id)
            ->where('last_reviewed_at', '>=', $today)
            ->count();

        // One joined sum instead of hydrating every completed row: the PHP
        // sum over full lesson rows grew one query per lesson plus the
        // lesson payload itself.
        $completedMinutes = (int) LessonProgress::query()
            ->where('lesson_progress.user_id', $user->id)
            ->where('lesson_progress.completed_at', '>=', $today)
            ->join('lessons', 'lessons.id', '=', 'lesson_progress.lesson_id')
            ->sum('lessons.estimated_minutes');

        $learnedMinutes = $completedMinutes + min($reviewedToday, 5);

        $tasks = [];

        if ($continueLesson !== null) {
            $done = $continueProgress->completed_at !== null;
            $continueMeta = [
                'title_en' => (string) $continueLesson->title_en,
                'level' => (string) $continueLesson->level,
                'cover_path' => $continueLesson->topic->cover_path,
                'position_seconds' => (float) ($continueProgress->position_seconds ?? 0),
                'duration_seconds' => (int) ($continueLesson->duration_seconds ?? 0),
                'estimated_minutes' => (int) ($continueLesson->estimated_minutes ?? 0),
            ];
            $tasks[] = array_merge([
                'key' => 'continue',
                'title' => 'ادامه مطالعه',
                'detail' => $continueLesson->title_en.' ('.$continueLesson->level.')',
                'url' => route('reader.show', ['topic' => $continueLesson->topic->slug, 'level' => $continueLesson->level]),
                'done' => $done,
            ], $continueMeta);
            $tasks[] = [
                'key' => 'listen',
                'title' => 'گوش دادن به صوت درس',
                'detail' => $continueLesson->title_en.' ('.$continueLesson->level.')',
                'url' => route('reader.show', ['topic' => $continueLesson->topic->slug, 'level' => $continueLesson->level]),
                'done' => $done,
            ];
        }

        if ($dueWords > 0) {
            $tasks[] = [
                'key' => 'review',
                'title' => 'مرور واژه‌ها',
                'detail' => $dueWords.' واژه برای مرور',
                'url' => route('words.review'),
                'done' => false,
            ];
        } elseif ($reviewedToday > 0) {
            $tasks[] = [
                'key' => 'review',
                'title' => 'مرور واژه‌ها',
                'detail' => 'امروز مرور شد',
                'url' => route('words.review'),
                'done' => true,
            ];
        }

        $next = self::nextLesson($user, $continueLesson?->id, $eligible);
        if ($next !== null) {
            $tasks[] = [
                'key' => 'next',
                'title' => 'درس بعدی',
                'detail' => $next->title_en.' ('.$next->level.')',
                'url' => route('reader.show', ['topic' => $next->topic->slug, 'level' => $next->level]),
                'done' => false,
            ];
        } elseif (! $eligible) {
            $tasks[] = [
                'key' => 'subscribe',
                'title' => 'فعال‌سازی اشتراک',
                'detail' => 'برای دسترسی به همه مطالب',
                'url' => route('subscribe.index'),
                'done' => false,
            ];
        }

        return [
            'goal_minutes' => $goal,
            'learned_minutes' => (int) $learnedMinutes,
            'progress_pct' => $goal > 0 ? (int) min(100, round($learnedMinutes / $goal * 100)) : 0,
            'due_words' => (int) $dueWords,
            // Internal only: lets TodayController reuse this request's
            // eligibility for recommendations() instead of recomputing
            // the fresh-user + subscription lookup. Never rendered.
            'eligible' => $eligible,
            'tasks' => $tasks,
        ];
    }

    private static function nextLesson(User $user, ?int $excludeLessonId, bool $eligible): ?Lesson
    {
        $query = Lesson::query()
            ->where('status', 'published')
            ->whereHas('topic', fn ($topics) => $topics->where('status', 'published'))
            ->with('topic')
            ->when($excludeLessonId !== null, fn ($q) => $q->where('id', '!=', $excludeLessonId))
            ->when(! $eligible, fn ($q) => $q->where('is_public_sample', true))
            ->when(
                is_string($user->preferred_level) && $user->preferred_level !== '' && $eligible,
                fn ($q) => $q->where('level', $user->preferred_level)
            )
            ->orderByDesc('id');

        $byLevel = (clone $query)->first();
        if ($byLevel !== null) {
            return $byLevel;
        }

        // Preferred level with no available lesson: fall back to the newest
        // lesson instead of an empty plan.
        return Lesson::query()
            ->where('status', 'published')
            ->whereHas('topic', fn ($topics) => $topics->where('status', 'published'))
            ->with('topic')
            ->when($excludeLessonId !== null, fn ($q) => $q->where('id', '!=', $excludeLessonId))
            ->when(! $eligible, fn ($q) => $q->where('is_public_sample', true))
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Eligibility is computed once in build() and passed in, so the Today
     * page pays the fresh-user + subscription lookup exactly once.
     * The Today controller is the only caller (verified 2026-10-18).
     *
     * @return list<Topic>
     */
    public static function recommendations(User $user, int $limit, bool $eligible): array
    {

        return Topic::query()
            ->where('status', 'published')
            ->whereHas('lessons', function ($lessons) use ($user, $eligible) {
                $lessons->where('status', 'published')
                    ->when(! $eligible, fn ($q) => $q->where('is_public_sample', true))
                    ->when(
                        is_string($user->preferred_level) && $user->preferred_level !== '' && $eligible,
                        fn ($q) => $q->where('level', $user->preferred_level)
                    );
            })
            // TodayController reads only level + estimated_minutes off
            // these; the FK stays so the eager matches back to topics.
            ->with(['lessons' => fn ($lessons) => $lessons
                ->where('status', 'published')
                ->when(! $eligible, fn ($q) => $q->where('is_public_sample', true))
                ->orderBy('id')
                ->select(['id', 'topic_id', 'level', 'estimated_minutes']),
            ])
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->all();
    }
}
