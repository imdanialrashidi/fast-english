<?php

namespace Database\Seeders;

use App\Actions\ApprovePayment;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * S2 browser-lane seeder: seeds the dedicated `fe_browser` database only.
 *
 * Contents: the S1 sample fixtures plus two deterministic browser users
 * (TEST-ONLY credentials for local Chromium journeys; never production).
 * The documented seed command is:
 *
 *   docker run --rm -v "$PWD:/repo" -w /repo --network s0-net \
 *     -e DB_HOST=s0-pg -e DB_DATABASE=fe_browser -e DB_USERNAME=fe_browser \
 *     fe-php:8.4.26 php artisan migrate --seeder=S2BrowserSeeder
 *
 * Plain `migrate` (never `migrate:fresh`) is used so the guard in
 * App\Support\BrowserDatabaseGuard is never in conflict with seeding.
 * Refuses to run when APP_ENV=production.
 */
class S2BrowserSeeder extends Seeder
{
    public const BROWSER_A_EMAIL = 'browser-a@example.com';

    public const BROWSER_B_EMAIL = 'browser-b@example.com';

    /**
     * One account per login-heavy browser test (C/D/E + A/B below): the
     * scope §16 login throttle (5/min per account+IP) is real product
     * behavior, so tests never hammer a single account in a tight loop.
     */
    public const BROWSER_C_EMAIL = 'browser-c@example.com';

    public const BROWSER_D_EMAIL = 'browser-d@example.com';

    public const BROWSER_E_EMAIL = 'browser-e@example.com';

    public const BROWSER_F_EMAIL = 'browser-f@example.com';

    public const BROWSER_G_EMAIL = 'browser-g@example.com';

    public const BROWSER_H_EMAIL = 'browser-h@example.com';

    public const BROWSER_I_EMAIL = 'browser-i@example.com';

    public const BROWSER_J_EMAIL = 'browser-j@example.com';

    /**
     * S6: one staff account for the browser payment-queue journey (TEST-ONLY
     * credentials for the local Chromium lane; never production). Learners
     * for the queue flow register fresh per spec (single-open rule).
     */
    public const BROWSER_STAFF_EMAIL = 'browser-staff@example.com';

    /** Test-only password for the two local browser accounts. */
    public const BROWSER_PASSWORD = 'password';

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new \RuntimeException('S2BrowserSeeder refuses to run in production.');
        }

        $this->call(S1SampleSeeder::class);
        $this->call(S3SampleSeeder::class);
        // S4 pre-slice: labelled pagination fixtures so /app holds >=13
        // visible topics and the pagination controls render in Chromium.
        $this->call(S4PaginationSeeder::class);
        // S5 payment fixtures (labelled TEST values, never real prices).
        $this->call(S5PaymentFixtureSeeder::class);
        // S7 placement fixture (labelled FIXTURE rows, never real exam).
        $this->call(S7PlacementFixtureSeeder::class);

        User::updateOrCreate(
            ['email' => self::BROWSER_A_EMAIL],
            ['name' => 'Browser A', 'password' => self::BROWSER_PASSWORD]
        );

        User::updateOrCreate(
            ['email' => self::BROWSER_B_EMAIL],
            ['name' => 'Browser B', 'password' => self::BROWSER_PASSWORD]
        );

        foreach ([self::BROWSER_C_EMAIL, self::BROWSER_D_EMAIL, self::BROWSER_E_EMAIL, self::BROWSER_F_EMAIL, self::BROWSER_G_EMAIL, self::BROWSER_H_EMAIL, self::BROWSER_I_EMAIL, self::BROWSER_J_EMAIL] as $index => $email) {
            User::updateOrCreate(
                ['email' => $email],
                ['name' => 'Browser '.chr(67 + $index), 'password' => self::BROWSER_PASSWORD]
            );
        }

        User::updateOrCreate(
            ['email' => self::BROWSER_STAFF_EMAIL],
            ['name' => 'Browser Staff', 'password' => self::BROWSER_PASSWORD, 'is_staff' => true]
        );

        // Paid-only lane: one subscribed learner (TEST-ONLY, 365-day
        // window granted through the shared action) so Chromium journeys
        // that need an active subscription log in instead of minting
        // production-shaped money rows from the browser.
        $this->seedSubscribedLearner();
    }

    public const BROWSER_SUB_EMAIL = 'browser-sub@example.com';

    private function seedSubscribedLearner(): void
    {
        $learner = User::updateOrCreate(
            ['email' => self::BROWSER_SUB_EMAIL],
            ['name' => 'Browser Sub', 'password' => self::BROWSER_PASSWORD]
        );

        $active = $learner->subscription !== null
            && $learner->subscription->revoked_at === null
            && $learner->subscription->starts_at <= now()
            && now() < $learner->subscription->expires_at;

        if (! $active) {
            $staff = User::where('email', self::BROWSER_STAFF_EMAIL)->firstOrFail();
            ApprovePayment::grant($learner->id, $staff, 365, 'browser lane fixture (TEST)');
        }
    }
}
