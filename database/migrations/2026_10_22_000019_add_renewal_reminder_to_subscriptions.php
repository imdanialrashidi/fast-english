<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Renewal reminder idempotency: one timestamp per current window. The
 * daily command only sends when this is null; a renewal resets it so the
 * next window can remind again.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->timestamp('renewal_reminder_sent_at')->nullable()->after('revoked_at');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn('renewal_reminder_sent_at');
        });
    }
};
