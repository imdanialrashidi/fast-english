<?php

namespace App\Mcp\Tools;

use App\Actions\PublishLesson;
use App\Mcp\ContentPayload;
use App\Models\Lesson;
use App\Models\McpToken;
use App\Models\Topic;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('transition-content')]
#[Description('Publish, archive, or return content to draft. Requires the content:publish ability. Topic publish requires a cover; a draft lesson publish always requires confirm_review=true — assert it only after a person reviewed the exact text and audio, which records the token owner as reviewer with the current time. Publishing an already-published lesson is a no-op.')]
class TransitionContentTool extends ContentTool
{
    protected string $ability = McpToken::ABILITY_PUBLISH;

    /** @return array<string, mixed> */
    public function schema(JsonSchema $schema): array
    {
        return [
            'type' => $schema->string()
                ->enum(['topic', 'lesson'])
                ->required(),
            'action' => $schema->string()
                ->enum(['publish', 'archive', 'to-draft'])
                ->required(),
            'id' => $schema->integer()
                ->min(1)
                ->description('Numeric topic/lesson id. Use this or the slug lookup fields.'),
            'topic_slug' => $schema->string()
                ->max(120)
                ->description('Topic slug (for a topic) or the parent topic slug (for a lesson).'),
            'level' => $schema->string()
                ->enum(PublishLesson::LEVELS)
                ->description('Required with topic_slug when type=lesson.'),
            'confirm_review' => $schema->boolean()
                ->description('Required when publishing a draft lesson: true asserts a human reviewed this exact draft. The token owner is recorded as reviewer/time. Not needed for an already-published lesson or for archive/to-draft.'),
        ];
    }

    protected function execute(Request $request, McpToken $token): mixed
    {
        $level = strtoupper(trim((string) $request->get('level')));

        $request->merge([
            'type' => strtolower(trim((string) $request->get('type'))),
            'action' => strtolower(trim((string) $request->get('action'))),
            'level' => $level === '' ? null : $level,
        ]);

        $validated = $request->validate([
            'type' => ['required', Rule::in(['topic', 'lesson'])],
            'action' => ['required', Rule::in(['publish', 'archive', 'to-draft'])],
            'id' => ['nullable', 'integer', 'min:1'],
            'topic_slug' => ['nullable', 'string', 'max:120'],
            'level' => ['nullable', Rule::in(PublishLesson::LEVELS)],
            'confirm_review' => ['nullable', 'boolean'],
        ]);

        $record = $this->resolveRecord($validated);

        if ($record === null) {
            return $this->failure('The content record was not found. Use list-content/get-content to get its id or slug.', [
                'code' => 'not_found',
            ]);
        }

        if ($record instanceof Lesson && $validated['action'] === 'publish' && $record->status === 'draft') {
            if (! ($validated['confirm_review'] ?? false)) {
                return $this->failure(
                    'Publishing a draft lesson through MCP requires confirm_review=true. Review the text and audio first; the token owner is recorded as reviewer with the current time. Publishing an already-published lesson is a no-op and does not need it.',
                    ['code' => 'review_required'],
                );
            }
        }

        $fingerprint = $record instanceof Lesson && $validated['action'] === 'publish'
            ? $this->lessonFingerprint($record)
            : null;

        $result = DB::transaction(function () use ($record, $validated, $token, $fingerprint): Topic|Lesson {
            // Re-read under a row lock so a concurrent save cannot edit the
            // row between this review assertion and the status transition.
            $locked = $record instanceof Lesson
                ? Lesson::query()->lockForUpdate()->find($record->id)
                : Topic::query()->lockForUpdate()->find($record->id);

            if ($locked === null) {
                throw ValidationException::withMessages([
                    'id' => 'The content record disappeared before the transition.',
                ]);
            }

            if ($locked instanceof Lesson && $validated['action'] === 'publish') {
                if ($fingerprint !== null && ! hash_equals($fingerprint, $this->lessonFingerprint($locked))) {
                    throw ValidationException::withMessages([
                        'content' => 'The lesson changed after it was resolved. Review the current draft again, then call transition-content with confirm_review=true.',
                    ]);
                }

                if ($locked->status === 'draft') {
                    if (! ($validated['confirm_review'] ?? false)) {
                        throw ValidationException::withMessages([
                            'confirm_review' => 'Publishing a draft lesson through MCP requires confirm_review=true.',
                        ]);
                    }

                    $locked->reviewed_by = $token->user_id;
                    $locked->reviewed_at = now();
                    $locked->save();
                }
            }

            return $this->transition($locked, $validated['action']);
        });

        return $this->ok([
            'type' => $validated['type'],
            'id' => (int) $result->id,
            'status' => (string) $result->status,
            'published_at' => $result->published_at?->toIso8601String(),
            'content' => $result instanceof Topic
                ? ContentPayload::topic($result->load(['category', 'lessons']), true)
                : ContentPayload::lesson($result->load('topic'), true),
        ]);
    }

    private function lessonFingerprint(Lesson $lesson): string
    {
        return hash('sha256', json_encode([
            'title_en' => $lesson->title_en,
            'body_en' => $lesson->body_en,
            'glossary' => $lesson->glossary,
            'audio_path' => $lesson->getRawOriginal('audio_path'),
            'audio_revision' => $lesson->audio_revision,
            'duration_seconds' => $lesson->duration_seconds,
            'estimated_minutes' => $lesson->estimated_minutes,
            'is_public_sample' => $lesson->is_public_sample,
        ], JSON_THROW_ON_ERROR));
    }

    /** @param array<string, mixed> $validated */
    private function resolveRecord(array $validated): Topic|Lesson|null
    {
        $id = $validated['id'] ?? null;
        $slug = $validated['topic_slug'] ?? null;
        $level = $validated['level'] ?? null;

        if ($validated['type'] === 'topic') {
            if ($id !== null) {
                return Topic::query()->find($id);
            }

            return $slug !== null ? Topic::query()->where('slug', $slug)->first() : null;
        }

        if ($id !== null) {
            return Lesson::query()->with('topic')->find($id);
        }

        if ($slug === null || $level === null) {
            return null;
        }

        return Lesson::query()
            ->with('topic')
            ->where('level', $level)
            ->whereHas('topic', fn ($query) => $query->where('slug', $slug))
            ->first();
    }

    private function transition(Topic|Lesson $record, string $action): Topic|Lesson
    {
        if ($record instanceof Topic) {
            return match ($action) {
                'publish' => PublishLesson::publishTopic($record),
                'archive' => PublishLesson::archiveTopic($record),
                default => PublishLesson::returnTopicToDraft($record),
            };
        }

        return match ($action) {
            'publish' => PublishLesson::publish($record),
            'archive' => PublishLesson::archive($record),
            default => PublishLesson::returnToDraft($record),
        };
    }
}
