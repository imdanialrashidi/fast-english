<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Owner instruction 2026-11-25: the public offer is a monthly
 * subscription at 641,000 toman (990,000 struck through). The old catalog
 * sold a 90-day plan at the same 641,000 and a yearly plan; both would
 * contradict the single offer, so they are retired from checkout.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('plans')->where('slug', 'monthly')->update([
            'name_fa' => 'اشتراک ماهیانه',
            'price_toman' => 641000,
            'duration_days' => 30,
            'is_active' => true,
            'display_order' => 1,
            'updated_at' => now(),
        ]);

        DB::table('plans')->whereIn('slug', ['quarterly', 'annual'])->update([
            'is_active' => false,
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('plans')->where('slug', 'monthly')->update([
            'name_fa' => 'یک‌ماهه',
            'price_toman' => 399000,
            'duration_days' => 30,
            'is_active' => true,
            'display_order' => 1,
            'updated_at' => now(),
        ]);

        DB::table('plans')->whereIn('slug', ['quarterly', 'annual'])->update([
            'is_active' => true,
            'updated_at' => now(),
        ]);
    }
};
