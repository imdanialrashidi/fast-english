<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Owner direction 2026-10-21: sentence-level audio/text synchronisation is
 * retired. The reader, sample, and landing preview render plain paragraphs
 * with the normal player, so the stored timing columns have no consumer.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('alter table lessons drop constraint if exists lessons_audio_cues_revision_positive');

        Schema::table('lessons', function (Blueprint $table) {
            $table->dropColumn(['audio_cues', 'audio_cues_revision']);
        });
    }

    public function down(): void
    {
        Schema::table('lessons', function (Blueprint $table) {
            $table->jsonb('audio_cues')->nullable()->after('glossary');
            $table->unsignedInteger('audio_cues_revision')->nullable()->after('audio_cues');
        });

        DB::statement('alter table lessons add constraint lessons_audio_cues_revision_positive check (audio_cues_revision is null or audio_cues_revision >= 1)');
    }
};
