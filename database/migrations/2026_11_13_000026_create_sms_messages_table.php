<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SMS audit trail (owner request 2026-11-13): the product sends exactly
 * two messages — a login/verification code and a subscription-activation
 * confirmation. Each attempt records its receipt id as a string, the
 * provider's answer, and the delivery state, so a support question can be
 * matched to the MelliPayamak panel without keeping the code or text here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('kind', 30);
            $table->string('phone', 20);
            $table->unsignedInteger('body_id')->nullable();
            $table->string('rec_id', 40)->nullable();
            $table->string('status', 20);
            $table->string('provider_code', 20)->nullable();
            $table->string('error_kind', 30)->nullable();
            $table->unsignedTinyInteger('check_attempts')->default(0);
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();

            // The delivery poller scans accepted rows by age; support
            // looks a learner up by phone or a panel receipt id.
            $table->index(['status', 'created_at']);
            $table->index('rec_id');
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_messages');
    }
};
