<?php

namespace App\Actions;

use App\Models\Lesson;
use App\Models\Topic;
use App\Support\Glossary;
use App\Support\StagedUpload;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Create or update a lesson draft from an agent request.
 *
 * One row per (topic, level) — the same natural key the panel uses. The
 * publish gate (audio signature, positive duration, recorded review, plus
 * a published parent) stays in PublishLesson; this action only writes a
 * draft. It never records a review, and any content change clears an
 * earlier review so a stale sign-off cannot be reused. Replacing audio
 * deliberately bumps audio_revision through the model hook, matching
 * product behavior.
 */
final class SaveLesson
{
    /**
     * @param  array{topic_slug: string, level: string, title_en?: string, body_en?: string, duration_seconds?: int, estimated_minutes?: int, glossary?: mixed, audio_upload_id?: string|null, is_public_sample?: bool}  $data
     * @return array{lesson: Lesson, created: bool}
     */
    public static function save(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $topicSlug = trim((string) $data['topic_slug']);
            $topic = Topic::query()->where('slug', $topicSlug)->first();

            if ($topic === null) {
                throw ValidationException::withMessages([
                    'topic_slug' => "Topic [{$topicSlug}] was not found. Create the topic first with save-topic.",
                ]);
            }

            $level = strtoupper(trim((string) $data['level']));
            if (! in_array($level, PublishLesson::LEVELS, true)) {
                throw ValidationException::withMessages([
                    'level' => 'The level must be one of '.implode(', ', PublishLesson::LEVELS).'.',
                ]);
            }

            $lesson = Lesson::query()
                ->where('topic_id', $topic->id)
                ->where('level', $level)
                ->lockForUpdate()
                ->first();

            $created = $lesson === null;

            if (! $created && $lesson->status !== 'draft') {
                throw ValidationException::withMessages([
                    'status' => "Lesson [{$level}] is {$lesson->status}; MCP writes are draft-only. Archive it, return it to draft, then edit (requires content:publish), or edit in /admin.",
                ]);
            }

            $lesson ??= new Lesson([
                'topic_id' => $topic->id,
                'level' => $level,
                'status' => 'draft',
            ]);

            $lesson->topic_id = $topic->id;
            $lesson->level = $level;

            if ($created) {
                foreach (['title_en', 'body_en', 'duration_seconds', 'estimated_minutes'] as $field) {
                    if (! array_key_exists($field, $data) || $data[$field] === null || $data[$field] === '') {
                        throw ValidationException::withMessages([
                            $field => "The {$field} field is required for a new lesson.",
                        ]);
                    }
                }

                if (empty($data['audio_upload_id'])) {
                    throw ValidationException::withMessages([
                        'audio_upload_id' => 'A new lesson needs an audio upload. Call begin-upload first, upload the MP3, then pass its upload_id.',
                    ]);
                }
            }

            if (array_key_exists('title_en', $data)) {
                $title = trim((string) $data['title_en']);
                if ($title === '') {
                    throw ValidationException::withMessages(['title_en' => 'The lesson title must not be empty.']);
                }
                $lesson->title_en = $title;
            }

            if (array_key_exists('body_en', $data)) {
                $body = trim((string) $data['body_en']);
                if ($body === '') {
                    throw ValidationException::withMessages(['body_en' => 'The lesson body must not be empty.']);
                }
                $lesson->body_en = $body;
            }

            if (array_key_exists('duration_seconds', $data)) {
                $duration = (int) $data['duration_seconds'];
                if ($duration < 1) {
                    throw ValidationException::withMessages(['duration_seconds' => 'The duration must be a positive number of seconds.']);
                }
                $lesson->duration_seconds = $duration;
            }

            if (array_key_exists('estimated_minutes', $data)) {
                $minutes = (int) $data['estimated_minutes'];
                if ($minutes < 1) {
                    throw ValidationException::withMessages(['estimated_minutes' => 'The study time must be a positive number of minutes.']);
                }
                $lesson->estimated_minutes = $minutes;
            }

            if (array_key_exists('glossary', $data)) {
                $lesson->glossary = Glossary::validate($data['glossary']);
            }

            if (array_key_exists('is_public_sample', $data)) {
                $lesson->is_public_sample = (bool) $data['is_public_sample'];
            }

            $oldAudio = $lesson->exists ? (string) $lesson->getRawOriginal('audio_path') : null;
            $newAudio = null;

            if (! empty($data['audio_upload_id'])) {
                $newAudio = StagedUpload::consumeAudio((string) $data['audio_upload_id']);
                $lesson->audio_path = $newAudio['path'];
            }

            if ($created) {
                $lesson->status = 'draft';
                $lesson->published_at = null;
                $lesson->audio_revision = 1;
            } elseif ($lesson->isDirty([
                'title_en',
                'body_en',
                'glossary',
                'duration_seconds',
                'estimated_minutes',
                'is_public_sample',
                'audio_path',
            ])) {
                // A review describes the exact draft that was read/listened
                // to. Any content change invalidates it; the MCP publish tool
                // always requires a fresh explicit confirmation.
                $lesson->reviewed_by = null;
                $lesson->reviewed_at = null;
            }

            try {
                $lesson->save();
            } catch (Throwable $e) {
                if ($newAudio !== null) {
                    Storage::disk('local')->delete($newAudio['path']);
                }

                throw $e;
            }

            if ($newAudio !== null && $oldAudio !== null && $oldAudio !== '' && $oldAudio !== $newAudio['path']) {
                Storage::disk('local')->delete($oldAudio);
            }

            return [
                'lesson' => $lesson->fresh(['topic']),
                'created' => $created,
            ];
        });
    }
}
