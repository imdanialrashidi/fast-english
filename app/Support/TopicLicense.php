<?php

namespace App\Support;

/**
 * D4 license-record enforcement (owner direction 2026-10-10).
 *
 * Staff-uploaded covers (JPEG/PNG/WebP) each need a license record:
 * source + license name + date checked + usage notes. The record lives in
 * topics.source_note as four labelled lines (no schema change; reversible):
 *
 *   Source: <where the photo came from>
 *   License: <license name>
 *   Checked: <YYYY-MM-DD>
 *   Notes: <usage notes>
 *
 * GD-generated default covers use a fixed GENERATED line instead and are
 * exempt from the staff rule. problem() returns null when the record is
 * valid, else a human reason. PublishLesson refuses to publish a topic
 * whose staff cover lacks a valid record.
 */
final class TopicLicense
{
    /**
     * Null when valid; else a reason string.
     *
     * @param  string|null  $coverPath  topics.cover_path
     * @param  string|null  $sourceNote  topics.source_note
     */
    public static function problem(?string $coverPath, ?string $sourceNote): ?string
    {
        $cover = trim((string) $coverPath);
        if ($cover === '') {
            return null; // No staff cover — generator covers this topic.
        }

        // GD default covers are machine-made; they carry no third-party
        // license burden. Staff uploads live outside covers/gd-*.jpg.
        if (str_starts_with($cover, 'covers/gd-')) {
            return null;
        }

        $note = trim((string) $sourceNote);
        if ($note === '') {
            return 'The cover needs a license record (source, license, date checked, notes).';
        }

        $needles = ['Source:', 'License:', 'Checked:', 'Notes:'];
        foreach ($needles as $needle) {
            if (! str_contains($note, $needle)) {
                return 'The cover license record must include source, license, date checked, and notes.';
            }
        }

        if (! preg_match('/Checked:\s*(\d{4}-\d{2}-\d{2})/', $note, $m)) {
            return 'The cover license record needs a Checked date as YYYY-MM-DD.';
        }

        [$y, $mo, $d] = array_map('intval', explode('-', $m[1]));
        if (! checkdate($mo, $d, $y)) {
            return 'The cover license Checked date is not a real calendar date.';
        }

        return null;
    }

    /** Fixed record for GD-generated default covers (no third-party rights). */
    public static function generatedRecord(string $slug): string
    {
        return "Source: generated abstract cover for {$slug}\nLicense: generated (no third-party rights)\nChecked: ".date('Y-m-d')."\nNotes: GD deterministic from slug, no baked text.";
    }

    /**
     * True when a note is the machine-generated cover record. Replacing a
     * generated cover with a staff upload must supply its own license; the
     * generated record cannot be carried over as if it licensed a photo.
     */
    public static function isGeneratedRecord(?string $note): bool
    {
        $note = trim((string) $note);

        return str_starts_with($note, 'Source: generated abstract cover for ')
            && str_contains($note, 'License: generated (no third-party rights)');
    }
}
