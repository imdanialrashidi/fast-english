<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Repair vocabulary rows written before the one-year interval cap.
     * Repeated Easy grades could multiply the interval without bound and
     * store a due date the application could no longer parse. The cap in
     * App\Support\SpacedRepetition prevents new rows; this fixes old ones.
     *
     * Irreversible by design: the original huge intervals were invalid, not
     * user intent, so down() deliberately leaves the clamped values.
     */
    public function up(): void
    {
        DB::statement('update vocabulary_words set interval_days = 365 where interval_days > 365');
        DB::statement("update vocabulary_words set due_at = now() + interval '365 days' where due_at > now() + interval '365 days'");
    }

    public function down(): void
    {
        // No-op: restoring an unparseable due date would reintroduce the bug.
    }
};
