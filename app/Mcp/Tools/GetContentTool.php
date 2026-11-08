<?php

namespace App\Mcp\Tools;

use App\Actions\PublishLesson;
use App\Mcp\ContentPayload;
use App\Models\McpToken;
use App\Models\Topic;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('get-content')]
#[Description('Read one topic with its lessons, full body/glossary, review state, and the exact problems blocking publication. Use it before editing an existing draft.')]
#[IsReadOnly]
class GetContentTool extends ContentTool
{
    protected string $ability = McpToken::ABILITY_READ;

    /** @return array<string, mixed> */
    public function schema(JsonSchema $schema): array
    {
        return [
            'topic_slug' => $schema->string()
                ->max(120)
                ->required()
                ->description('The topic slug returned by list-content or save-topic.'),
            'level' => $schema->string()
                ->enum(PublishLesson::LEVELS)
                ->description('Optionally return only this CEFR lesson.'),
        ];
    }

    protected function execute(Request $request, McpToken $token): mixed
    {
        $validated = $request->validate([
            'topic_slug' => ['required', 'string', 'max:120'],
            'level' => ['nullable', Rule::in(PublishLesson::LEVELS)],
        ]);

        $topic = Topic::query()
            ->with(['category', 'lessons' => fn ($query) => $query->orderBy('level')])
            ->where('slug', $validated['topic_slug'])
            ->first();

        if ($topic === null) {
            return $this->failure("Topic [{$validated['topic_slug']}] was not found.", [
                'code' => 'not_found',
            ]);
        }

        if (isset($validated['level'])) {
            $lessons = $topic->lessons
                ->where('level', $validated['level'])
                ->values();

            if ($lessons->isEmpty()) {
                return $this->failure(
                    "Topic [{$topic->slug}] has no {$validated['level']} lesson.",
                    ['code' => 'not_found'],
                );
            }

            $topic->setRelation('lessons', $lessons);
        }

        return $this->ok([
            'topic' => ContentPayload::topic($topic, true),
        ]);
    }
}
