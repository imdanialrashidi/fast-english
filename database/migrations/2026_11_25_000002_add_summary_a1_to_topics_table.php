<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Owner instruction 2026-11-25: the reader's summary area must say what
 * the podcast is about (existing `summary_public`, Persian) and also carry
 * a very simple A1 English summary. The second column is content, not a
 * computed translation; staff/MCP can fill it per topic.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('topics', function (Blueprint $table): void {
            $table->text('summary_a1_en')->nullable()->after('summary_public');
        });
    }

    public function down(): void
    {
        Schema::table('topics', function (Blueprint $table): void {
            $table->dropColumn('summary_a1_en');
        });
    }
};
