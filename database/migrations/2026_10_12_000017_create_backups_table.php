<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Panel-based one-click backup & restore (OPS-01, AC-22 follow-up).
     *
     * The `backups` table is operational metadata only: it never holds
     * backup bytes, secrets, or payment payloads — only the private-disk
     * path, size, SHA-256, status lifecycle, compatibility manifest, and
     * a sanitized error message. Backup archives live on the private
     * (`local`) disk under `backups/` and are never web-reachable.
     */
    public function up(): void
    {
        Schema::create('backups', function (Blueprint $table) {
            $table->id();
            // Relative path on the `local` disk, e.g. backups/2026-....zip.
            $table->string('filename')->unique();
            $table->string('disk')->default('local');
            $table->bigInteger('size_bytes')->nullable();
            // SHA-256 of the zip file (hex, 64 chars) once verified.
            $table->string('checksum_sha256', 64)->nullable();
            // Lifecycle: creating → completed|failed; restoring → restored|restore_failed.
            $table->string('status', 32)->default('creating');
            $table->index(['status', 'created_at']);
            // Origin: manual (panel one-click), pre_restore (emergency
            // point before a destructive restore), uploaded (staff upload).
            $table->string('type', 32)->default('manual');
            // Compatibility + integrity manifest (JSON): format version,
            // laravel major, migration list, table counts, file checksums.
            // Never holds secrets, passwords, or .env values.
            $table->json('manifest')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('error_message')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backups');
    }
};
