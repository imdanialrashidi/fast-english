<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Grammar-first exercise content (owner request 2026-11-16). A unit's
     * exercise set is a sequence of grammar topics; every item belongs to
     * one topic, so the unit page can render explanation, examples and the
     * matching questions in the book's order. Matching joins choice as a
     * first-class type, and each choice option can carry its own Persian
     * feedback for the wrong answer.
     */
    public function up(): void
    {
        Schema::create('exercise_topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('set_id')->constrained('exercise_sets')->cascadeOnDelete();
            $table->string('key', 40);
            $table->unsignedSmallInteger('position');
            $table->string('title_en', 160);
            $table->string('title_fa', 160);
            $table->text('use_fa');
            $table->jsonb('formulas')->nullable();
            $table->jsonb('examples')->nullable();
            $table->text('notes_fa')->nullable();
            $table->timestamps();

            $table->unique(['set_id', 'key']);
            $table->unique(['set_id', 'position']);
        });

        Schema::table('exercise_sets', function (Blueprint $table) {
            $table->jsonb('source')->nullable();
        });

        Schema::table('exercise_items', function (Blueprint $table) {
            $table->foreignId('topic_id')->nullable()->after('set_id')
                ->constrained('exercise_topics')->cascadeOnDelete();
            $table->jsonb('feedback')->nullable()->after('explanation_fa');

            $table->index(['topic_id', 'position']);
        });

        DB::statement('alter table exercise_items drop constraint exercise_items_type_allowed');
        DB::statement("alter table exercise_items add constraint exercise_items_type_allowed check (type in ('choice','matching','fill_blank','order'))");
    }

    public function down(): void
    {
        DB::statement('alter table exercise_items drop constraint exercise_items_type_allowed');
        DB::statement("alter table exercise_items add constraint exercise_items_type_allowed check (type in ('choice','fill_blank','order'))");

        Schema::table('exercise_items', function (Blueprint $table) {
            $table->dropIndex(['topic_id', 'position']);
            $table->dropConstrainedForeignId('topic_id');
            $table->dropColumn('feedback');
        });

        Schema::table('exercise_sets', function (Blueprint $table) {
            $table->dropColumn('source');
        });

        Schema::dropIfExists('exercise_topics');
    }
};
