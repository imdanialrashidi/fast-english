<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TED Talk section (owner request 2026-11-21): one talk per podcast topic,
 * rendered as the seventh tab beside A1–C2.
 *
 * A TED talk is deliberately NOT a CEFR level: level stays a content
 * attribute of lessons and never becomes permission or a catch-all bucket.
 * The talk has its own private audio, official sentence cues, a ten-word
 * gloss and a licensed cover. `topic_id` is unique but nullable so reviewed
 * talks that have no close podcast stay in the pool unassigned.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ted_talks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('topic_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('slug')->unique();
            $table->string('title_en');
            $table->string('speaker')->nullable();
            $table->string('area', 32)->index();
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->string('audio_path');
            $table->unsignedInteger('audio_revision')->default(1);
            $table->string('cover_path')->nullable();
            $table->json('segments');
            $table->json('words');
            $table->string('source_url');
            $table->string('source_license', 64)->default('CC BY-NC-ND 4.0');
            $table->text('license_note')->nullable();
            $table->string('status', 16)->default('draft');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'area']);
            $table->index(['status', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ted_talks');
    }
};
