<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Owner instruction 2026-11-25: the daily goals are ten-minute steps from
 * 10 to 60. The original check only allowed 5/10/15. Existing 5/15 values
 * are moved to the nearest valid step before the new constraint is added.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->where('daily_goal_minutes', 5)->update(['daily_goal_minutes' => 10]);
        DB::table('users')->where('daily_goal_minutes', 15)->update(['daily_goal_minutes' => 20]);

        DB::statement('alter table users drop constraint if exists users_daily_goal_allowed');
        DB::statement('alter table users add constraint users_daily_goal_allowed check (daily_goal_minutes in (10, 20, 30, 40, 50, 60))');
    }

    public function down(): void
    {
        DB::table('users')->whereNotIn('daily_goal_minutes', [5, 10, 15])->update(['daily_goal_minutes' => 10]);
        DB::statement('alter table users drop constraint if exists users_daily_goal_allowed');
        DB::statement('alter table users add constraint users_daily_goal_allowed check (daily_goal_minutes in (5, 10, 15))');
    }
};
