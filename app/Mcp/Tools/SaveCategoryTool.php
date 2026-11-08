<?php

namespace App\Mcp\Tools;

use App\Mcp\ContentPayload;
use App\Models\Category;
use App\Models\McpToken;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;

#[Name('save-category')]
#[Description('Create or update a category by slug (idempotent). Categories organize topics; use list-content to see existing ones before creating a duplicate.')]
#[IsIdempotent]
class SaveCategoryTool extends ContentTool
{
    protected string $ability = McpToken::ABILITY_WRITE;

    /** @return array<string, mixed> */
    public function schema(JsonSchema $schema): array
    {
        return [
            'slug' => $schema->string()
                ->max(120)
                ->required()
                ->description('Lowercase English slug with letters, numbers, dashes, or underscores.'),
            'name_fa' => $schema->string()
                ->max(120)
                ->required()
                ->description('Short Persian display name, e.g. «داستان‌ها».'),
            'display_order' => $schema->integer()
                ->min(0)
                ->description('Smaller numbers appear first. Omit on update to keep the current value.'),
            'is_active' => $schema->boolean()
                ->description('Omit on update to keep the current value.'),
        ];
    }

    protected function execute(Request $request, McpToken $token): mixed
    {
        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:120', 'alpha_dash'],
            'name_fa' => ['required', 'string', 'max:120'],
            'display_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $values = ['name_fa' => trim($validated['name_fa'])];

        if (array_key_exists('display_order', $validated) && $validated['display_order'] !== null) {
            $values['display_order'] = (int) $validated['display_order'];
        }

        if (array_key_exists('is_active', $validated) && $validated['is_active'] !== null) {
            $values['is_active'] = (bool) $validated['is_active'];
        }

        $category = Category::query()->updateOrCreate(
            ['slug' => trim($validated['slug'])],
            $values,
        );

        return $this->ok([
            'created' => (bool) $category->wasRecentlyCreated,
            'category' => ContentPayload::category($category),
        ]);
    }
}
