<?php

namespace Database\Seeders;

use App\Models\PaymentDestination;
use App\Models\Plan;
use Illuminate\Database\Seeder;

/**
 * Owner-provided production/staging catalog.
 *
 * Prices are integer toman:
 * - 30 days: 399,000
 * - 90 days: 641,000 (owner instruction 2026-11-22; the landing quotes
 *   this as 990,000 struck through, 641,000 payable for 90 days)
 * - 365 days: 30% off twelve months = 3,351,600
 *
 * Run explicitly after deploy:
 *   php artisan db:seed --class=PlanCatalogSeeder --force
 *
 * This is safe to re-run: plans are matched by slug and updated. It never
 * overwrites a real active destination; a fresh environment gets the
 * obvious placeholder card, and checkout stays disabled until staff
 * replace it in Business settings.
 */
class PlanCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            [
                'slug' => 'monthly',
                'name_fa' => 'یک‌ماهه',
                'price_toman' => 399000,
                'duration_days' => 30,
                'is_active' => true,
                'display_order' => 1,
            ],
            [
                'slug' => 'quarterly',
                'name_fa' => 'سه‌ماهه',
                'price_toman' => 641000,
                'duration_days' => 90,
                'is_active' => true,
                'display_order' => 2,
            ],
            [
                'slug' => 'annual',
                'name_fa' => 'یک‌ساله (۳۰٪ تخفیف)',
                'price_toman' => 3351600,
                'duration_days' => 365,
                'is_active' => true,
                'display_order' => 3,
            ],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(['slug' => $plan['slug']], $plan);
        }

        // Old labelled fixture plans must never compete with the real
        // catalog if this seeder is run on a database that has them.
        Plan::query()
            ->where('slug', 'like', 's5-test-%')
            ->update(['is_active' => false]);

        if (! PaymentDestination::query()->where('is_active', true)->exists()) {
            PaymentDestination::query()->create([
                'card_number' => PaymentDestination::PLACEHOLDER_CARD,
                'holder_name' => PaymentDestination::PLACEHOLDER_HOLDER,
                'bank_name' => PaymentDestination::PLACEHOLDER_BANK,
                'instructions' => 'شمارهٔ کارت هنوز توسط مدیر تنظیم نشده است.',
                'is_active' => true,
            ]);
        }
    }
}
