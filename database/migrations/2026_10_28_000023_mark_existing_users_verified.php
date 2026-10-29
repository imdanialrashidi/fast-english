<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Grandfather accounts that existed before email verification shipped.
 *
 * Without this, the new verification gate would lock the owner and every
 * early tester out of their own accounts. New registrations stay
 * unverified and receive a code. Reverting is intentionally a no-op: a
 * verified timestamp is not destructive and must not be silently removed.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->whereNull('email_verified_at')
            ->update(['email_verified_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)')]);
    }

    public function down(): void
    {
        // No-op: verification is an auditable fact, not a reversible setting.
    }
};
