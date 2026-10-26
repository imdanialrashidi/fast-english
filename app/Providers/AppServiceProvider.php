<?php

namespace App\Providers;

use App\Models\Lesson;
use App\Models\PaymentRequest;
use App\Models\PlacementAttempt;
use App\Models\VocabularyWord;
use App\Policies\LessonPolicy;
use App\Policies\PaymentRequestPolicy;
use App\Policies\PlacementAttemptPolicy;
use App\Policies\VocabularyWordPolicy;
use App\Support\BrowserDatabaseGuard;
use Filament\Support\Facades\FilamentTimezone;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Inertia\ExceptionResponse;
use Inertia\Inertia;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Scope §8 / PRODUCT: timestamps are stored UTC and displayed in
        // Asia/Tehran. Filament's default is the app timezone (UTC), so
        // without this the staff panel showed payment/review times 3.5h
        // earlier than the learner surface.
        FilamentTimezone::set('Asia/Tehran');

        Gate::policy(Lesson::class, LessonPolicy::class);
        Gate::policy(PaymentRequest::class, PaymentRequestPolicy::class);
        Gate::policy(PlacementAttempt::class, PlacementAttemptPolicy::class);
        Gate::policy(VocabularyWord::class, VocabularyWordPolicy::class);

        // M0 Inertia foundation (ADR-0002): production error handling per
        // https://inertiajs.com/error-handling. Initial-visit and XHR
        // failures with these statuses render the React ErrorPage with the
        // shared props instead of the dev modal; anything else falls
        // through to Laravel's default rendering. Existing Blade error
        // views keep serving non-Inertia responses.
        Inertia::handleExceptionsUsing(function (ExceptionResponse $response) {
            $request = $response->request;

            // JSON consumers (fetch from lib/http.ts) must keep the JSON
            // contract: the Inertia finalizer rewrites every exception
            // response, so guard here before rendering a full HTML page.
            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                return null;
            }

            if (in_array($response->statusCode(), [403, 404, 405, 419, 429, 500, 503], true)) {
                return $response->render('ErrorPage', [
                    'status' => $response->statusCode(),
                ])->withSharedData();
            }

            return null;
        });

        // S2: destructive console commands must never wipe the browser-lane
        // database. Seeding uses plain `migrate --seeder=...`, which is
        // unaffected. Carried scope note: X-Accel-Redirect delivery stays
        // deferred to S8/S9 with production hosting (see LessonAudioController).
        if ($this->app->runningInConsole()) {
            $this->app['events']->listen(CommandStarting::class, function (CommandStarting $event): void {
                if (in_array($event->command, ['migrate:fresh', 'migrate:refresh', 'migrate:reset', 'db:wipe'], true)) {
                    $connection = config('database.default');
                    BrowserDatabaseGuard::ensureNotBrowserDatabase(
                        config("database.connections.{$connection}.database")
                    );
                }
            });
        }
    }
}
