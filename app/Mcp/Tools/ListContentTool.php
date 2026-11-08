<?php

namespace App\Mcp\Tools;

use App\Mcp\ContentPayload;
use App\Models\Category;
use App\Models\Lesson;
use App\Models\McpToken;
use App\Models\Topic;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[Name('list-content')]
#[Description('List categories, topics, and lesson statuses. Use this first to avoid duplicate topics/lessons and to find category ids or topic slugs.')]
#[IsReadOnly]
class ListContentTool extends ContentTool
{
    protected string $ability = McpToken::ABILITY_READ;

    /** @return array<string, mixed> */
    public function schema(JsonSchema $schema): array
    {
        return [
            'status' => $schema->string()
                ->enum(['draft', 'published', 'archived'])
                ->description('Only topics in this status. Lessons keep their own status and are always listed under the topic.'),
            'search' => $schema->string()
                ->max(120)
                ->description('Case-insensitive match on topic title, slug, or public summary.'),
            'limit' => $schema->integer()
                ->min(1)
                ->max(200)
                ->default(50)
                ->description('Maximum topics to return (default 50, max 200).'),
        ];
    }

    protected function execute(Request $request, McpToken $token): mixed
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['draft', 'published', 'archived'])],
            'search' => ['nullable', 'string', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $limit = (int) ($validated['limit'] ?? 50);
        $search = trim((string) ($validated['search'] ?? ''));

        $query = Topic::query()
            ->with(['category', 'lessons'])
            ->orderBy('title_en')
            ->limit($limit);

        if (isset($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if ($search !== '') {
            $term = '%'.$search.'%';
            $query->where(function ($nested) use ($term): void {
                $nested->where('title_en', 'ilike', $term)
                    ->orWhere('slug', 'ilike', $term)
                    ->orWhere('summary_public', 'ilike', $term);
            });
        }

        $topics = $query->get();

        return $this->ok([
            'categories' => Category::query()
                ->orderBy('display_order')
                ->orderBy('name_fa')
                ->get()
                ->map(fn (Category $category): array => ContentPayload::category($category))
                ->all(),
            'topics' => $topics
                ->map(fn (Topic $topic): array => ContentPayload::topic($topic))
                ->all(),
            'counts' => [
                'topics' => Topic::query()->count(),
                'published_topics' => Topic::query()->where('status', 'published')->count(),
                'lessons' => Lesson::query()->count(),
                'published_lessons' => Lesson::query()->where('status', 'published')->count(),
            ],
            'limit' => $limit,
        ]);
    }
}
