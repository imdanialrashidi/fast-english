<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// S9a ops (scope sections 19.2-19.3): retention runs on the scheduler so
// `schedule:list` shows it and `schedule:work` keeps it alive in the
// production image. Runs daily; the command itself is idempotent.
Schedule::command('receipts:retain-reviewed')->daily();
Schedule::command('receipts:cleanup')->daily();
// Panel backup retention (scope §19.3: 30-day rotation).
Schedule::command('backup:prune')->daily();
