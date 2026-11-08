<?php

namespace App\Mcp\Tools;

use App\Actions\PublishLesson;
use App\Actions\SaveTopic;
use App\Mcp\ContentPayload;
use App\Models\Category;
use App\Models\McpToken;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('save-topic')]
#[Description('Create or update a topic draft by slug (idempotent). If no cover is uploaded and none exists, a deterministic license-exempt cover is generated. A staff-uploaded cover needs source_note with Source/License/Checked/Notes lines. This never publishes.')]
#[IsIdempotent]
class SaveTopicTool extends ContentTool
{
    protected string $ability = McpToken::ABILITY_WRITE;

    /** @return array<string, mixed> */
    public function schema(JsonSchema $schema): array
    {
        return [
            'slug' => $schema->string()
                ->max(120)
                ->required()
                ->description('Unique topic slug; it is the natural key and also the public URL segment. Do not change it after publishing.'),
            'title_en' => $schema->string()
                ->max(255)
                ->required()
                ->description('English topic title.'),
            'summary_public' => $schema->string()
                ->max(5000)
                ->required()
                ->description('One or two Persian sentences shown in the library. No unsupported claims.'),
            'category_id' => $schema->integer()
                ->min(1)
                ->description('Existing category id from list-content. Do not send together with category_slug.'),
            'category_slug' => $schema->string()
                ->max(120)
                ->description('Existing category slug from list-content. Do not send together with category_id.'),
            'cover_upload_id' => $schema->string()
                ->description('The upload_id returned by begin-upload for a cover (JPEG/PNG/WebP, max 2 MB). Omit to keep the current cover or generate one.'),
            'source_note' => $schema->string()
                ->max(2000)
                ->description('Private license record for a staff-uploaded cover. Four lines: Source: / License: / Checked: YYYY-MM-DD / Notes:.'),
        ];
    }

    protected function execute(Request $request, McpToken $token): mixed
    {
        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:120', 'alpha_dash'],
            'title_en' => ['required', 'string', 'max:255'],
            'summary_public' => ['required', 'string', 'max:5000'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'category_slug' => ['nullable', 'string', 'max:120', 'exists:categories,slug'],
            'cover_upload_id' => ['nullable', 'uuid'],
            'source_note' => ['nullable', 'string', 'max:2000'],
        ]);

        if (! empty($validated['category_id']) && ! empty($validated['category_slug'])) {
            return $this->failure('Send either category_id or category_slug, not both.', [
                'code' => 'invalid_arguments',
            ]);
        }

        $data = [
            'slug' => trim($validated['slug']),
            'title_en' => $validated['title_en'],
            'summary_public' => $validated['summary_public'],
        ];

        if (array_key_exists('category_id', $validated) || array_key_exists('category_slug', $validated)) {
            $data['category_id'] = ! empty($validated['category_slug'])
                ? (int) Category::query()->where('slug', $validated['category_slug'])->value('id')
                : ($validated['category_id'] ?? null);
        }

        if (array_key_exists('cover_upload_id', $validated) && $validated['cover_upload_id'] !== null) {
            $data['cover_upload_id'] = $validated['cover_upload_id'];
        }

        if (array_key_exists('source_note', $validated)) {
            $data['source_note'] = $validated['source_note'];
        }

        $result = SaveTopic::save($data);
        $topic = $result['topic'];

        return $this->ok([
            'created' => $result['created'],
            'topic' => ContentPayload::topic($topic, true),
            'publish_problems' => PublishLesson::topicProblems($topic),
            'next_step' => 'Add lessons with save-lesson, publish the topic with transition-content, then publish each lesson.',
        ]);
    }
}
