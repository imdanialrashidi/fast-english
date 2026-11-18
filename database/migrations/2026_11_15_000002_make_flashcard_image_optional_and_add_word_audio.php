<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Owner clarification 2026-11-15: flashcards are text-first, so a card
     * image is optional content instead of a required one. Word audio for
     * article-vocabulary cards lives in its own content table keyed by the
     * lower-cased word, produced offline (Underdog Woof) and reviewed
     * before it is served.
     */
    public function up(): void
    {
        DB::statement('alter table flashcards alter column image_path drop not null');

        Schema::create('word_audio', function (Blueprint $table) {
            $table->id();
            $table->string('word_key', 120)->unique();
            $table->string('path');
            $table->string('source', 32)->default('underdog-woof');
            $table->string('voice', 80)->nullable();
            $table->unsignedInteger('seed')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->string('status', 16)->default('approved');
            $table->string('checked_by', 120)->nullable();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();
        });

        DB::statement("alter table word_audio add constraint word_audio_status_allowed check (status in ('draft','approved','rejected'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('word_audio');
        DB::statement('alter table flashcards alter column image_path set not null');
    }
};
