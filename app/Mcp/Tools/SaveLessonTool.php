<?php

namespace App\Mcp\Tools;

use App\Actions\PublishLesson;
use App\Actions\SaveLesson;
use App\Mcp\ContentPayload;
use App\Models\McpToken;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('save-lesson')]
#[Description('Create or update one lesson draft for a (topic, level) pair (idempotent). New lessons require audio_upload_id from begin-upload. Omitted fields keep their current value on update. Replacing audio increments audio_revision and resets learner audio position; only do that when the old file is wrong. This never publishes and never records a review.')]
#[IsIdempotent]
class SaveLessonTool extends ContentTool
{
    protected string $ability = McpToken::ABILITY_WRITE;

    /** @return array<string, mixed> */
    public function schema(JsonSchema $schema): array
    {
        return [
            'topic_slug' => $schema->string()
                ->max(120)
                ->required()
                ->description('Slug of an existing topic. Create the topic first with save-topic.'),
            'level' => $schema->string()
                ->enum(PublishLesson::LEVELS)
                ->required()
                ->description('CEFR level. One lesson exists per topic and level.'),
            'title_en' => $schema->string()
                ->max(255)
                ->description('English lesson title (required for a new lesson).'),
            'body_en' => $schema->string()
                ->max(50000)
                ->description('English body as plain paragraphs separated by blank lines. No HTML, Markdown, links, or Persian text. Required for a new lesson.'),
            'duration_seconds' => $schema->integer()
                ->min(1)
                ->max(86400)
                ->description('Real audio duration in seconds (required for a new lesson).'),
            'estimated_minutes' => $schema->integer()
                ->min(1)
                ->max(600)
                ->description('Estimated study time in minutes (required for a new lesson).'),
            'glossary' => $schema->array()
                ->max(12)
                ->items($schema->object([
                    'word' => $schema->string()->max(120)->required(),
                    'meaning_fa' => $schema->string()->max(500)->required(),
                    'example_en' => $schema->string()->max(500),
                ]))
                ->description('Up to 12 key words with English word, Persian meaning, optional English example.'),
            'audio_upload_id' => $schema->string()
                ->description('The upload_id returned by begin-upload for an MP3 (max 30 MB). Required when creating; omit to keep existing audio.'),
            'is_public_sample' => $schema->boolean()
                ->description('Only for the free public sample. Defaults to false for a new lesson.'),
        ];
    }

    protected function execute(Request $request, McpToken $token): mixed
    {
        $request->merge([
            'level' => strtoupper(trim((string) $request->get('level'))),
        ]);

        $validated = $request->validate([
            'topic_slug' => ['required', 'string', 'max:120'],
            'level' => ['required', Rule::in(PublishLesson::LEVELS)],
            'title_en' => ['nullable', 'string', 'max:255'],
            'body_en' => ['nullable', 'string', 'max:50000'],
            'duration_seconds' => ['nullable', 'integer', 'min:1', 'max:86400'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1', 'max:600'],
            'glossary' => ['nullable', 'array', 'max:12'],
            'audio_upload_id' => ['nullable', 'uuid'],
            'is_public_sample' => ['nullable', 'boolean'],
        ]);

        $data = [
            'topic_slug' => trim($validated['topic_slug']),
            'level' => $validated['level'],
        ];

        foreach ([
            'title_en',
            'body_en',
            'duration_seconds',
            'estimated_minutes',
            'glossary',
            'audio_upload_id',
            'is_public_sample',
        ] as $field) {
            if (array_key_exists($field, $validated) && $validated[$field] !== null) {
                $data[$field] = $validated[$field];
            }
        }

        $result = SaveLesson::save($data);
        $lesson = $result['lesson'];

        return $this->ok([
            'created' => $result['created'],
            'lesson' => ContentPayload::lesson($lesson, true),
            'publish_problems' => PublishLesson::lessonProblems($lesson),
            'next_step' => 'Publish the parent topic first, review the lesson, then call transition-content with action=publish and confirm_review=true.',
        ]);
    }
}
