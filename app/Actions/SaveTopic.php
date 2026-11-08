<?php

namespace App\Actions;

use App\Models\Topic;
use App\Support\StagedUpload;
use App\Support\TopicCover;
use App\Support\TopicLicense;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Create or update a topic draft from an agent request.
 *
 * This is the write owner used by the MCP tools; publishing still goes
 * through PublishLesson. The same product rules apply: a slug is the
 * natural key, every custom cover needs the four-line license record, and
 * an absent cover is filled by the deterministic GD cover (license-exempt).
 *
 * The action never changes status/published_at — content transitions only
 * happen through the explicit transition tool.
 */
final class SaveTopic
{
    /**
     * @param  array{slug: string, title_en: string, summary_public: string, category_id?: int|null, cover_upload_id?: string|null, source_note?: string|null}  $data
     * @return array{topic: Topic, created: bool}
     */
    public static function save(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $slug = trim((string) $data['slug']);
            $topic = Topic::query()->where('slug', $slug)->lockForUpdate()->first();
            $created = $topic === null;

            if (! $created && $topic->status !== 'draft') {
                throw ValidationException::withMessages([
                    'status' => "Topic [{$slug}] is {$topic->status}; MCP writes are draft-only. Archive it, return it to draft, then edit (requires content:publish), or edit in /admin.",
                ]);
            }

            $topic ??= new Topic(['slug' => $slug]);

            $topic->slug = $slug;
            $topic->title_en = trim((string) $data['title_en']);
            $topic->summary_public = trim((string) $data['summary_public']);

            if (array_key_exists('category_id', $data)) {
                $topic->category_id = $data['category_id'];
            }

            if (array_key_exists('source_note', $data)) {
                $note = trim((string) $data['source_note']);

                $topic->source_note = $note === '' ? null : $note;
            }

            $newCoverPath = null;

            if (! empty($data['cover_upload_id'])) {
                $newCoverPath = StagedUpload::consumeCover((string) $data['cover_upload_id'])['path'];
                $topic->cover_path = $newCoverPath;

                if (trim((string) $topic->source_note) === '' || TopicLicense::isGeneratedRecord($topic->source_note)) {
                    Storage::disk('public')->delete($newCoverPath);

                    throw ValidationException::withMessages([
                        'source_note' => 'A staff-uploaded cover needs its own license record (Source, License, Checked YYYY-MM-DD, Notes). The generated-cover record cannot be reused.',
                    ]);
                }

                $problem = TopicLicense::problem($topic->cover_path, $topic->source_note);
                if ($problem !== null) {
                    Storage::disk('public')->delete($newCoverPath);

                    throw ValidationException::withMessages(['source_note' => $problem]);
                }
            } elseif (trim((string) $topic->cover_path) === '') {
                $newCoverPath = TopicCover::generate($slug);
                $topic->cover_path = $newCoverPath;

                if (trim((string) $topic->source_note) === '') {
                    $topic->source_note = TopicLicense::generatedRecord($slug);
                }
            }

            if ($created) {
                $topic->status = 'draft';
                $topic->published_at = null;
            }

            try {
                $topic->save();
            } catch (Throwable $e) {
                if ($newCoverPath !== null) {
                    Storage::disk('public')->delete($newCoverPath);
                }

                throw $e;
            }

            return [
                'topic' => $topic->fresh(['category', 'lessons']),
                'created' => $created,
            ];
        });
    }
}
