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
            if (in_array($response->statusCode(), [403, 404, 500, 503], true)) {
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
