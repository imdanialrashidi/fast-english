<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Book flashcards (owner request 2026-11-15): one book -> units ->
     * cards, with a per-user two-grade Anki-style scheduler and an
     * append-only review log. Content is imported from the curated
     * FastEnglish flashcard dataset; the scheduler state lives separately
     * from book content so a content re-import never resets progress.
     */
    public function up(): void
    {
        Schema::create('flashcard_books', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->string('title_en');
            $table->string('title_fa')->nullable();
            $table->string('level', 8)->nullable();
            $table->string('edition', 80)->nullable();
            $table->string('cover_path')->nullable();
            $table->json('study_config')->nullable();
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['status', 'sort_order']);
        });

        DB::statement("alter table flashcard_books add constraint flashcard_books_status_allowed check (status in ('draft','published','archived'))");

        Schema::create('flashcard_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('book_id')->constrained('flashcard_books')->cascadeOnDelete();
            $table->unsignedSmallInteger('number');
            $table->string('title_en');
            $table->string('title_fa')->nullable();
            $table->string('subtitle')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['book_id', 'number']);
            $table->index(['book_id', 'sort_order']);
        });

        Schema::create('flashcards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('unit_id')->constrained('flashcard_units')->cascadeOnDelete();
            $table->string('external_id', 80)->unique();
            $table->string('word', 120);
            $table->string('display', 160)->nullable();
            $table->string('phonetic', 80)->nullable();
            $table->string('translation_fa', 160);
            $table->string('definition_en', 500)->nullable();
            $table->string('example_en', 500)->nullable();
            $table->string('part_of_speech', 40)->nullable();
            $table->string('lesson_code', 16)->nullable();
            $table->string('topic', 120)->nullable();
            $table->string('image_path');
            $table->string('audio_path');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['unit_id', 'sort_order']);
        });

        Schema::create('user_flashcards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('flashcard_id')->constrained('flashcards')->cascadeOnDelete();
            $table->string('phase', 16)->default('new');
            $table->unsignedSmallInteger('step')->default(0);
            $table->timestamp('due_at')->nullable();
            $table->unsignedInteger('interval_days')->default(0);
            $table->float('ease_factor')->default(2.5);
            $table->unsignedInteger('reps')->default(0);
            $table->unsignedInteger('lapses')->default(0);
            $table->string('last_rating', 8)->nullable();
            $table->timestamp('last_reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'flashcard_id']);
            $table->index(['user_id', 'phase', 'due_at']);
            $table->index(['user_id', 'last_rating']);
        });

        DB::statement("alter table user_flashcards add constraint user_flashcards_phase_allowed check (phase in ('new','learning','review','relearning'))");
        DB::statement("alter table user_flashcards add constraint user_flashcards_rating_allowed check (last_rating is null or last_rating in ('again','good'))");
        DB::statement('alter table user_flashcards add constraint user_flashcards_ease_floor check (ease_factor >= 1.3)');

        Schema::create('flashcard_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('flashcard_id')->constrained('flashcards')->cascadeOnDelete();
            $table->uuid('client_review_id');
            $table->uuid('session_id')->nullable();
            $table->string('rating', 8);
            $table->boolean('was_new')->default(false);
            $table->string('phase_before', 16);
            $table->string('phase_after', 16);
            $table->unsignedInteger('interval_before')->default(0);
            $table->unsignedInteger('interval_after')->default(0);
            $table->float('ease_before');
            $table->float('ease_after');
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('reviewed_at');
            $table->timestamps();

            // One answer per client action: a retried request can never
            // apply a second schedule.
            $table->unique(['user_id', 'client_review_id']);
            $table->index(['user_id', 'reviewed_at']);
            $table->index(['flashcard_id', 'reviewed_at']);
        });

        DB::statement("alter table flashcard_reviews add constraint flashcard_reviews_rating_allowed check (rating in ('again','good'))");
        DB::statement("alter table flashcard_reviews add constraint flashcard_reviews_phase_before_allowed check (phase_before in ('new','learning','review','relearning'))");
        DB::statement("alter table flashcard_reviews add constraint flashcard_reviews_phase_after_allowed check (phase_after in ('new','learning','review','relearning'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('flashcard_reviews');
        Schema::dropIfExists('user_flashcards');
        Schema::dropIfExists('flashcards');
        Schema::dropIfExists('flashcard_units');
        Schema::dropIfExists('flashcard_books');
    }
};
