<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Lesson;
use App\Models\PlacementQuestion;
use App\Models\PlacementTest;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Remove the labelled demo/fixture content that earlier slices seeded
 * (owner request 2026-10-28). Only an exact allowlist is touched: real
 * staff content and owner catalogs are never matched by a LIKE pattern.
 *
 *   php artisan content:purge-fixtures           # dry run (default)
 *   php artisan content:purge-fixtures --force   # delete
 *
 * Fixture topics, their lessons/audio/covers, the S7 fixture placement
 * version (only when no attempt is pinned to it), inactive S5 fixture
 * plans, and the two test accounts are handled. DatabaseSeeder no longer
 * creates any of it; this command cleans an environment that already ran
 * the old seeders.
 */
class PurgeFixtureContent extends Command
{
    /** @var list<string> */
    private const FIXTURE_TOPIC_SLUGS = [
        'city-park',
        'night-trains',
        'morning-market',
        'rainy-day',
        'draft-notebook',
        'empty-shelf',
        'archived-whisper',
    ];

    /** @var list<string> */
    private const FIXTURE_CATEGORY_SLUGS = ['story', 'everyday'];

    /** @var list<string> */
    private const FIXTURE_USER_EMAILS = ['test@example.com', 's3-reviewer-fixture@example.com'];

    protected $signature = 'content:purge-fixtures
        {--force : Actually delete; without it the command only reports}';

    protected $description = 'Delete labelled demo/fixture topics, audio, covers, and fixture catalogs.';

    public function handle(): int
    {
        $topics = Topic::query()
            ->whereIn('slug', self::FIXTURE_TOPIC_SLUGS)
            ->get(['id', 'slug', 'cover_path']);

        $lessons = $topics->isEmpty()
            ? collect()
            : Lesson::query()->whereIn('topic_id', $topics->pluck('id'))->get(['id', 'topic_id', 'audio_path']);

        $users = User::query()->whereIn('email', self::FIXTURE_USER_EMAILS)->get(['id', 'email']);
        $placement = PlacementTest::query()->where('version', 's7-fixture-v1')->first();

        $this->table(
            ['item', 'found'],
            [
                ['fixture topics', (string) $topics->count()],
                ['fixture lessons', (string) $lessons->count()],
                ['fixture accounts', (string) $users->count()],
                ['S7 fixture placement version', $placement === null ? '0' : '1'],
            ],
        );

        if ($topics->isEmpty() && $placement === null && $users->isEmpty()) {
            $this->info('No fixture content found; nothing to purge.');

            return self::SUCCESS;
        }

        if (! $this->option('force')) {
            $this->warn('Dry run only. Re-run with --force to delete the rows and files listed above.');

            return self::SUCCESS;
        }

        $audioPaths = $lessons->pluck('audio_path')->filter(fn ($path) => is_string($path) && $path !== '')->unique()->values();
        $coverPaths = $topics->pluck('cover_path')->filter(fn ($path) => is_string($path) && $path !== '')->unique()->values();

        DB::transaction(function () use ($topics, $lessons, $placement): void {
            if ($lessons->isNotEmpty()) {
                // Bypass the archive-instead-of-delete guard: these rows are
                // labelled fixtures, not published staff content.
                DB::table('lessons')->whereIn('id', $lessons->pluck('id'))->delete();
            }

            if ($topics->isNotEmpty()) {
                DB::table('topics')->whereIn('id', $topics->pluck('id'))->delete();
            }

            Category::query()
                ->whereIn('slug', self::FIXTURE_CATEGORY_SLUGS)
                ->whereDoesntHave('topics')
                ->delete();

            if ($placement !== null && ! $placement->attempts()->exists()) {
                PlacementQuestion::query()->where('test_id', $placement->id)->delete();
                PlacementTest::query()->whereKey($placement->id)->delete();
            }

            User::query()
                ->whereIn('email', self::FIXTURE_USER_EMAILS)
                ->whereDoesntHave('paymentRequests')
                ->whereDoesntHave('subscription')
                ->whereDoesntHave('subscriptionEvents')
                ->whereDoesntHave('lessonProgress')
                ->whereDoesntHave('bookmarks')
                ->whereDoesntHave('vocabularyWords')
                ->delete();
        });

        foreach ($audioPaths as $path) {
            Storage::disk('local')->delete($path);
        }
        foreach ($coverPaths as $path) {
            Storage::disk('public')->delete($path);
        }

        $this->info(sprintf(
            'Purged %d fixture topics, %d lessons, %d media files, and %d fixture accounts.',
            $topics->count(),
            $lessons->count(),
            $audioPaths->count() + $coverPaths->count(),
            $users->count(),
        ));

        return self::SUCCESS;
    }
}
