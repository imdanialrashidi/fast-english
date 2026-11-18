<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Book exercises (owner request 2026-11-15): a set belongs to one book
     * unit (or, later, one lesson). Items carry the prompt and the answer
     * key server-side; the client never receives the key before submit.
     * Attempts and answers are learner state and are never touched by a
     * content re-import.
     */
    public function up(): void
    {
        Schema::create('exercise_sets', function (Blueprint $table) {
            $table->id();
            $table->string('external_id', 80)->unique();
            $table->foreignId('unit_id')->nullable()->constrained('flashcard_units')->cascadeOnDelete();
            $table->foreignId('lesson_id')->nullable()->constrained('lessons')->cascadeOnDelete();
            $table->string('title');
            $table->text('instructions_fa');
            $table->string('status', 16)->default('draft');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['unit_id', 'status']);
            $table->index(['lesson_id', 'status']);
        });

        DB::statement("alter table exercise_sets add constraint exercise_sets_status_allowed check (status in ('draft','published','archived'))");
        DB::statement('alter table exercise_sets add constraint exercise_sets_target_present check (unit_id is not null or lesson_id is not null)');

        Schema::create('exercise_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('set_id')->constrained('exercise_sets')->cascadeOnDelete();
            $table->string('external_id', 80);
            $table->unsignedSmallInteger('position');
            $table->string('type', 16);
            $table->text('prompt');
            $table->jsonb('options')->nullable();
            $table->jsonb('answer');
            $table->string('explanation_fa', 500)->nullable();
            $table->unsignedSmallInteger('points')->default(1);
            $table->timestamps();

            $table->unique(['set_id', 'external_id']);
            $table->unique(['set_id', 'position']);
        });

        DB::statement("alter table exercise_items add constraint exercise_items_type_allowed check (type in ('choice','fill_blank','order'))");

        Schema::create('exercise_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('set_id')->constrained('exercise_sets')->cascadeOnDelete();
            $table->unsignedSmallInteger('score')->default(0);
            $table->unsignedSmallInteger('total')->default(0);
            $table->timestamp('submitted_at');
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['set_id', 'user_id']);
        });

        Schema::create('exercise_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attempt_id')->constrained('exercise_attempts')->cascadeOnDelete();
            $table->foreignId('item_id')->constrained('exercise_items')->cascadeOnDelete();
            $table->jsonb('response')->nullable();
            $table->boolean('is_correct')->default(false);
            $table->timestamps();

            $table->unique(['attempt_id', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exercise_answers');
        Schema::dropIfExists('exercise_attempts');
        Schema::dropIfExists('exercise_items');
        Schema::dropIfExists('exercise_sets');
    }
};
