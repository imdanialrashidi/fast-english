<?php

namespace App\Mcp\Tools;

use App\Models\McpToken;
use App\Support\StagedUpload;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('begin-upload')]
#[Description('Step 1 for audio/covers: create a short-lived single-use upload. Returns a URL and X-Upload-Token header; PUT the raw bytes there with curl, then pass upload_id to save-lesson (audio) or save-topic (cover). Limits: MP3 audio 30 MB, cover JPEG/PNG/WebP 2 MB.')]
class BeginUploadTool extends ContentTool
{
    protected string $ability = McpToken::ABILITY_WRITE;

    /** @return array<string, mixed> */
    public function schema(JsonSchema $schema): array
    {
        return [
            'kind' => $schema->string()
                ->enum(StagedUpload::KINDS)
                ->required()
                ->description('audio (lesson MP3) or cover (topic JPEG/PNG/WebP).'),
            'size_bytes' => $schema->integer()
                ->min(1)
                ->description('Optional declared file size. It must fit the kind limit; the server still enforces the real byte count.'),
            'filename' => $schema->string()
                ->max(255)
                ->description('Optional original filename for your own bookkeeping; it is not used as a storage path.'),
        ];
    }

    protected function execute(Request $request, McpToken $token): mixed
    {
        $validated = $request->validate([
            'kind' => ['required', Rule::in(StagedUpload::KINDS)],
            'size_bytes' => ['nullable', 'integer', 'min:1'],
            'filename' => ['nullable', 'string', 'max:255'],
        ]);

        $upload = StagedUpload::begin(
            $token,
            $validated['kind'],
            isset($validated['size_bytes']) ? (int) $validated['size_bytes'] : null,
        );

        $url = route('mcp.upload', ['upload' => $upload['id']]);
        $headers = [
            'X-Upload-Token' => $upload['token'],
            'Content-Type' => 'application/octet-stream',
        ];

        return $this->ok([
            'upload' => [
                'upload_id' => $upload['id'],
                'kind' => $upload['kind'],
                'method' => 'PUT',
                'url' => $url,
                'headers' => $headers,
                'max_bytes' => $upload['max_bytes'],
                'expires_at' => $upload['expires_at'],
                'filename' => $validated['filename'] ?? null,
            ],
            'curl_example' => "curl -X PUT -H 'X-Upload-Token: {$upload['token']}' -H 'Content-Type: application/octet-stream' --data-binary @/path/to/file '{$url}'",
            'note' => 'The upload token is single-use and expires; it is not the MCP bearer token. Never print or share it.',
        ]);
    }
}
