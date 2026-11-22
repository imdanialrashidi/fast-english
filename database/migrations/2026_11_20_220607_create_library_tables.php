<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The reading library (owner decisions 2026-11-21): story books, Cambridge
 * IELTS reading and Inside Reading share one navigation tree and one
 * versioned document per readable leaf. Coursebooks stay in the existing
 * flashcard_books tables; only the new reading tracks live here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('library_nodes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('library_nodes')->cascadeOnDelete();
            $table->string('track', 32);
            $table->string('kind', 32);
            $table->string('slug', 191);
            $table->string('title_en')->nullable();
            $table->string('title_fa')->nullable();
            $table->string('subtitle_fa')->nullable();
            $table->string('level', 16)->nullable();
            $table->string('cover_path')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('status', 16)->default('preparing');
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['track', 'slug']);
            $table->index(['parent_id', 'sort_order']);
            $table->index(['track', 'status']);
        });

        Schema::create('reading_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('node_id')->unique()->constrained('library_nodes')->cascadeOnDelete();
            $table->string('schema_version', 16)->default('1.0');
            $table->unsignedInteger('revision')->default(1);
            $table->json('document');
            $table->string('checksum', 64);
            $table->unsignedInteger('page_count')->default(0);
            $table->unsignedInteger('question_count')->default(0);
            $table->unsignedInteger('word_count')->default(0);
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('reading_progress', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('node_id')->constrained('library_nodes')->cascadeOnDelete();
            $table->string('page_key', 64);
            $table->unsignedInteger('position_ms')->default(0);
            $table->unsignedInteger('revision')->default(1);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'node_id']);
        });

        Schema::create('reading_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('node_id')->constrained('library_nodes')->cascadeOnDelete();
            $table->json('answers');
            $table->unsignedSmallInteger('score');
            $table->unsignedSmallInteger('total');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'node_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reading_attempts');
        Schema::dropIfExists('reading_progress');
        Schema::dropIfExists('reading_documents');
        Schema::dropIfExists('library_nodes');
    }
};
