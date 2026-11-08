<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Agent content-upload tokens (owner request 2026-11-08).
     *
     * Only a SHA-256 hash of each bearer token is stored; the plain token is
     * shown once by `mcp:token issue`. Tokens belong to an active staff
     * account (the reviewer/actor recorded on MCP writes), carry explicit
     * abilities, and can expire or be revoked without a deploy.
     */
    public function up(): void
    {
        Schema::create('mcp_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('token_hash', 64)->unique();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->json('abilities');
            $table->timestamp('last_used_at')->nullable();
            $table->string('last_used_ip', 45)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'revoked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mcp_tokens');
    }
};
