<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * A fresh database gets only owner-supplied catalogs (plans + the real
 * public placement test). Demo lessons, test accounts, tone-file audio,
 * and fixture payments are gone (owner request 2026-10-28): they were
 * test content and must never appear in a deployed app again.
 *
 * Tests seed the fixture classes they need explicitly (S1SampleSeeder and
 * friends still exist for that purpose). Local demo content is opt-in:
 * `php artisan db:seed --class=S1SampleSeeder`.
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call(PlanCatalogSeeder::class);
        $this->call(PlacementCatalogSeeder::class);
    }
}
