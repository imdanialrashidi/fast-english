<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The panel backup/restore subsystem was replaced by the stateless
     * Import / Export page (App\Support\DataTransfer). `backups` only held
     * operational metadata for stored archives, jobs, and a prune command;
     * all of them are gone, so the table has no remaining reader.
     */
    public function up(): void
    {
        Schema::dropIfExists('backups');
    }

    public function down(): void
    {
        if (Schema::hasTable('backups')) {
            return;
        }

        Schema::create('backups', function (Blueprint $table) {
            $table->id();
            $table->string('filename')->unique();
            $table->string('disk')->default('local');
            $table->bigInteger('size_bytes')->nullable();
            $table->string('checksum_sha256', 64)->nullable();
            $table->string('status', 32)->default('creating');
            $table->index(['status', 'created_at']);
            $table->string('type', 32)->default('manual');
            $table->json('manifest')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('error_message')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }
};
