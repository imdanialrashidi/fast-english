<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Owner instruction 2026-11-25: after a subscription is activated the
 * learner completes a small profile (name, surname, Jalali birth date) and
 * may upload a profile photo. The birth date is stored as the three
 * owner-requested Jalali components; no calendar conversion is invented.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('first_name')->nullable()->after('name');
            $table->string('last_name')->nullable()->after('first_name');
            $table->string('birth_date_jalali', 10)->nullable()->after('last_name');
            $table->string('avatar_path')->nullable()->after('birth_date_jalali');
            $table->timestamp('profile_completed_at')->nullable()->after('avatar_path');
            $table->boolean('needs_profile')->default(false)->after('profile_completed_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'first_name',
                'last_name',
                'birth_date_jalali',
                'avatar_path',
                'profile_completed_at',
                'needs_profile',
            ]);
        });
    }
};
