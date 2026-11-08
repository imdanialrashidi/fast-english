<?php

use App\Models\Lesson;
use App\Models\McpToken;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\ContentFixtures;

/**
 * Owner request 2026-11-08: agents upload content through a staff-only MCP
 * server. These tests exercise the real HTTP JSON-RPC route, the real
 * staged upload endpoint, and the same product publish rules the panel
 * uses — no mocked authorization or storage.
 */
function mcpIssueToken(User $user, array $abilities = [McpToken::ABILITY_READ, McpToken::ABILITY_WRITE, McpToken::ABILITY_PUBLISH], ?Carbon $expiresAt = null): array
{
    return McpToken::issue($user, 'test agent', $abilities, $expiresAt);
}

function mcpRpc($test, string $plain, string $method, array $params = [], int $id = 1)
{
    return $test->postJson('/mcp/content', [
        'jsonrpc' => '2.0',
        'id' => $id,
        'method' => $method,
        'params' => $params,
    ], [
        'Authorization' => 'Bearer '.$plain,
        'Accept' => 'application/json, text/event-stream',
    ]);
}

function mcpTool($test, string $plain, string $name, array $arguments = [])
{
    return mcpRpc($test, $plain, 'tools/call', [
        'name' => $name,
        'arguments' => $arguments,
    ]);
}

function mcpStructured($response): array
{
    $response->assertOk();

    return (array) $response->json('result.structuredContent', []);
}

function mcpPut($test, array $upload, string $bytes, ?string $pathOverride = null)
{
    $path = $pathOverride ?? (string) parse_url($upload['url'], PHP_URL_PATH);

    return $test->call('PUT', $path, [], [], [], [
        'HTTP_X_UPLOAD_TOKEN' => $upload['headers']['X-Upload-Token'],
        'CONTENT_TYPE' => 'application/octet-stream',
    ], $bytes);
}

function mcpBeginAudio($test, string $plain, ?int $declared = null): array
{
    $arguments = ['kind' => 'audio'];

    if ($declared !== null) {
        $arguments['size_bytes'] = $declared;
    }

    $response = mcpTool($test, $plain, 'begin-upload', $arguments);
    $response->assertOk();

    return (array) $response->json('result.structuredContent.upload');
}

function mcpFixture(string $name): string
{
    return (string) file_get_contents(database_path('seeders/fixtures/'.$name));
}

beforeEach(function () {
    $this->staff = ContentFixtures::staff();
    [$this->token, $this->plain] = mcpIssueToken($this->staff);
});

test('the MCP endpoint rejects anonymous, invalid, revoked, expired, student, and disabled identities', function () {
    $payload = ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list', 'params' => []];

    $this->postJson('/mcp/content', $payload)
        ->assertStatus(401)
        ->assertHeader('WWW-Authenticate', 'Bearer realm="mcp", error="invalid_token"');

    $this->postJson('/mcp/content', $payload, [
        'Authorization' => 'Bearer femcp_'.str_repeat('a', 64),
    ])->assertStatus(401);

    $revoked = mcpIssueToken($this->staff);
    $revoked[0]->forceFill(['revoked_at' => now()])->save();

    mcpRpc($this, $revoked[1], 'tools/list')->assertStatus(401);

    $expired = mcpIssueToken($this->staff, [McpToken::ABILITY_READ], Carbon::now()->subMinute());

    mcpRpc($this, $expired[1], 'tools/list')->assertStatus(401);

    $student = ContentFixtures::student();
    $studentToken = mcpIssueToken($student);

    mcpRpc($this, $studentToken[1], 'tools/list')->assertStatus(403);

    $disabling = ContentFixtures::staff();
    $disabledToken = mcpIssueToken($disabling);
    $disabling->forceFill(['disabled_at' => now()])->save();

    mcpRpc($this, $disabledToken[1], 'tools/list')->assertStatus(403);
});

test('the server completes the legacy initialize handshake and lists the content tools', function () {
    $init = mcpRpc($this, $this->plain, 'initialize', [
        'protocolVersion' => '2025-06-18',
        'capabilities' => [],
        'clientInfo' => ['name' => 'pest', 'version' => '1.0'],
    ]);

    $init->assertOk()
        ->assertJsonPath('result.protocolVersion', '2025-06-18')
        ->assertJsonPath('result.serverInfo.name', 'Fast English Content');

    expect((string) $init->headers->get('Cache-Control'))
        ->toContain('private')
        ->toContain('no-store');

    $list = mcpRpc($this, $this->plain, 'tools/list');

    $names = collect($list->json('result.tools'))->pluck('name')->all();

    expect($names)->toBe([
        'list-content',
        'get-content',
        'save-category',
        'save-topic',
        'save-lesson',
        'begin-upload',
        'transition-content',
    ]);
});

test('the server supports the current discovery handshake and mirrored headers', function () {
    $discover = mcpRpc($this, $this->plain, 'server/discover');

    $discover->assertOk();
    expect($discover->json('result.supportedVersions'))->toContain('2026-07-28');

    $list = $this->postJson('/mcp/content', [
        'jsonrpc' => '2.0',
        'id' => 2,
        'method' => 'tools/list',
        'params' => [
            '_meta' => [
                'io.modelcontextprotocol/protocolVersion' => '2026-07-28',
                'io.modelcontextprotocol/clientCapabilities' => [],
            ],
        ],
    ], [
        'Authorization' => 'Bearer '.$this->plain,
        'Accept' => 'application/json, text/event-stream',
        'MCP-Protocol-Version' => '2026-07-28',
        'Mcp-Method' => 'tools/list',
    ]);

    $list->assertOk()->assertJsonPath('result.tools.0.name', 'list-content');
});

test('tool abilities are enforced inside the server, not only at the route', function () {
    [$writeOnly, $writePlain] = mcpIssueToken($this->staff, [McpToken::ABILITY_WRITE]);

    $list = mcpTool($this, $writePlain, 'list-content');
    $list->assertOk()
        ->assertJsonPath('result.isError', true)
        ->assertJsonPath('result.structuredContent.code', 'ability_denied');

    $transition = mcpTool($this, $writePlain, 'transition-content', [
        'type' => 'topic',
        'action' => 'archive',
        'topic_slug' => 'missing-topic',
    ]);

    $transition->assertOk()
        ->assertJsonPath('result.isError', true)
        ->assertJsonPath('result.structuredContent.code', 'ability_denied');

    expect($writeOnly->hasAbility(McpToken::ABILITY_READ))->toBeFalse();
});

test('an agent can create a category, topic, audio lesson, and publish a public sample', function () {
    $category = mcpTool($this, $this->plain, 'save-category', [
        'slug' => 'stories-mcp',
        'name_fa' => 'داستان‌ها',
        'display_order' => 1,
    ]);

    $category->assertOk()->assertJsonPath('result.structuredContent.created', true);

    $topicResponse = mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-story',
        'title_en' => 'MCP Story',
        'summary_public' => 'یک داستان کوتاه برای آزمایش مسیر عامل.',
        'category_slug' => 'stories-mcp',
    ]);

    $topicResponse->assertOk()
        ->assertJsonPath('result.structuredContent.created', true)
        ->assertJsonPath('result.structuredContent.topic.status', 'draft');

    $topic = Topic::query()->where('slug', 'mcp-story')->firstOrFail();

    expect($topic->status)->toBe('draft')
        ->and($topic->cover_path)->toStartWith('covers/gd-')
        ->and(Storage::disk('public')->exists($topic->cover_path))->toBeTrue()
        ->and(Storage::disk('public')->exists('covers/gd-mcp-story.jpg'))->toBeTrue();

    $audio = mcpFixture('s1-a2-tone-fixture.mp3');
    $upload = mcpBeginAudio($this, $this->plain, strlen($audio));

    expect($upload['kind'])->toBe('audio')
        ->and($upload['max_bytes'])->toBe(30 * 1024 * 1024);

    mcpPut($this, $upload, $audio)->assertOk();

    $lessonResponse = mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-story',
        'level' => 'A2',
        'title_en' => 'MCP Story Lesson',
        'body_en' => "First paragraph of the agent story.\n\nSecond paragraph of the agent story.",
        'duration_seconds' => 20,
        'estimated_minutes' => 3,
        'glossary' => [
            ['word' => 'agent', 'meaning_fa' => 'عامل', 'example_en' => 'The agent uploads a lesson.'],
        ],
        'audio_upload_id' => $upload['upload_id'],
        'is_public_sample' => true,
    ]);

    $lessonResponse->assertOk()
        ->assertJsonPath('result.structuredContent.created', true)
        ->assertJsonPath('result.structuredContent.lesson.status', 'draft')
        ->assertJsonPath('result.structuredContent.lesson.audio_ready', true);

    $lesson = Lesson::query()->where('topic_id', $topic->id)->firstOrFail();

    expect($lesson->audio_path)->toStartWith('lessons/')
        ->and(Storage::disk('local')->exists($lesson->audio_path))->toBeTrue()
        ->and(Storage::disk('public')->exists($lesson->audio_path))->toBeFalse()
        ->and($lesson->reviewed_by)->toBeNull();

    mcpTool($this, $this->plain, 'transition-content', [
        'type' => 'topic',
        'action' => 'publish',
        'topic_slug' => 'mcp-story',
    ])->assertOk()->assertJsonPath('result.structuredContent.status', 'published');

    $reviewRefused = mcpTool($this, $this->plain, 'transition-content', [
        'type' => 'lesson',
        'action' => 'publish',
        'topic_slug' => 'mcp-story',
        'level' => 'A2',
    ]);

    $reviewRefused->assertOk()->assertJsonPath('result.isError', true);
    expect(mcpStructured($reviewRefused)['code'])->toBe('review_required');
    expect($lesson->fresh()->status)->toBe('draft');

    $published = mcpTool($this, $this->plain, 'transition-content', [
        'type' => 'lesson',
        'action' => 'publish',
        'topic_slug' => 'mcp-story',
        'level' => 'A2',
        'confirm_review' => true,
    ]);

    $published->assertOk()->assertJsonPath('result.structuredContent.status', 'published');

    $lesson->refresh();
    expect($lesson->status)->toBe('published')
        ->and($lesson->reviewed_by)->toBe($this->staff->id)
        ->and($lesson->reviewed_at)->not->toBeNull();

    $this->get('/sample')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Sample/Show')
            ->where('lesson.title_en', 'MCP Story Lesson')
            ->where('topic.slug', 'mcp-story'));

    $topicEdit = mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-story',
        'title_en' => 'Changed After Publish',
        'summary_public' => 'Must not change live content through a write token.',
    ]);

    $topicEdit->assertOk()->assertJsonPath('result.isError', true);
    expect(mcpStructured($topicEdit)['errors'])->toHaveKey('status');

    $lessonEdit = mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-story',
        'level' => 'A2',
        'title_en' => 'Changed After Publish',
    ]);

    $lessonEdit->assertOk()->assertJsonPath('result.isError', true);
    expect(mcpStructured($lessonEdit)['errors'])->toHaveKey('status');
    expect($topic->fresh()->title_en)->toBe('MCP Story')
        ->and($lesson->fresh()->title_en)->toBe('MCP Story Lesson');
});

test('saving the same topic and lesson twice updates in place and keeps the audio revision', function () {
    mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-idempotent',
        'title_en' => 'Idempotent Topic',
        'summary_public' => 'A topic that must not duplicate.',
    ])->assertOk();

    mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-idempotent',
        'title_en' => 'Idempotent Topic Updated',
        'summary_public' => 'A topic that must not duplicate.',
    ])->assertOk()->assertJsonPath('result.structuredContent.created', false);

    expect(Topic::query()->where('slug', 'mcp-idempotent')->count())->toBe(1);

    $audio = mcpFixture('s1-a2-tone-fixture.mp3');
    $upload = mcpBeginAudio($this, $this->plain);
    mcpPut($this, $upload, $audio)->assertOk();

    mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-idempotent',
        'level' => 'B1',
        'title_en' => 'B1 Draft',
        'body_en' => "One.\n\nTwo.",
        'duration_seconds' => 20,
        'estimated_minutes' => 3,
        'audio_upload_id' => $upload['upload_id'],
    ])->assertOk();

    $lesson = Lesson::query()->firstOrFail();
    $originalAudioPath = $lesson->audio_path;

    mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-idempotent',
        'level' => 'B1',
        'title_en' => 'B1 Draft Updated',
    ])->assertOk()->assertJsonPath('result.structuredContent.created', false);

    $lesson->refresh();

    expect(Lesson::query()->count())->toBe(1)
        ->and($lesson->title_en)->toBe('B1 Draft Updated')
        ->and($lesson->audio_path)->toBe($originalAudioPath)
        ->and($lesson->audio_revision)->toBe(1);

    $secondUpload = mcpBeginAudio($this, $this->plain);
    mcpPut($this, $secondUpload, $audio)->assertOk();

    mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-idempotent',
        'level' => 'B1',
        'audio_upload_id' => $secondUpload['upload_id'],
    ])->assertOk();

    $lesson->refresh();

    expect($lesson->audio_revision)->toBe(2)
        ->and($lesson->audio_path)->not->toBe($originalAudioPath)
        ->and(Storage::disk('local')->exists($originalAudioPath))->toBeFalse()
        ->and(Storage::disk('local')->exists($lesson->audio_path))->toBeTrue();
});

test('editing a draft clears its review and every draft publish needs a fresh confirmation', function () {
    mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-review-refresh',
        'title_en' => 'Review Refresh',
        'summary_public' => 'Review invalidation proof.',
    ])->assertOk();

    $audio = mcpFixture('s1-a2-tone-fixture.mp3');
    $upload = mcpBeginAudio($this, $this->plain);
    mcpPut($this, $upload, $audio)->assertOk();

    mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-review-refresh',
        'level' => 'B1',
        'title_en' => 'Reviewed Draft',
        'body_en' => "Original paragraph.\n\nSecond paragraph.",
        'duration_seconds' => 20,
        'estimated_minutes' => 3,
        'audio_upload_id' => $upload['upload_id'],
    ])->assertOk();

    $lesson = Lesson::query()->firstOrFail();
    $lesson->forceFill([
        'reviewed_by' => $this->staff->id,
        'reviewed_at' => now()->subDay(),
    ])->save();

    mcpTool($this, $this->plain, 'transition-content', [
        'type' => 'topic',
        'action' => 'publish',
        'topic_slug' => 'mcp-review-refresh',
    ])->assertOk();

    $refused = mcpTool($this, $this->plain, 'transition-content', [
        'type' => 'lesson',
        'action' => 'publish',
        'topic_slug' => 'mcp-review-refresh',
        'level' => 'B1',
    ]);

    $refused->assertOk()->assertJsonPath('result.isError', true);
    expect(mcpStructured($refused)['code'])->toBe('review_required')
        ->and($lesson->fresh()->status)->toBe('draft');

    mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-review-refresh',
        'level' => 'B1',
        'title_en' => 'Edited After Review',
    ])->assertOk();

    $lesson->refresh();
    expect($lesson->reviewed_by)->toBeNull()
        ->and($lesson->reviewed_at)->toBeNull();

    mcpTool($this, $this->plain, 'transition-content', [
        'type' => 'lesson',
        'action' => 'publish',
        'topic_slug' => 'mcp-review-refresh',
        'level' => 'B1',
        'confirm_review' => true,
    ])->assertOk()->assertJsonPath('result.structuredContent.status', 'published');

    $lesson->refresh();
    expect($lesson->reviewed_by)->toBe($this->staff->id)
        ->and($lesson->reviewed_at->greaterThan(now()->subMinute()))->toBeTrue();
});

test('a failed lesson publish leaves no review behind', function () {
    mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-failed-publish',
        'title_en' => 'Failed Publish',
        'summary_public' => 'Parent remains a draft.',
    ])->assertOk();

    $audio = mcpFixture('s1-a2-tone-fixture.mp3');
    $upload = mcpBeginAudio($this, $this->plain);
    mcpPut($this, $upload, $audio)->assertOk();

    mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-failed-publish',
        'level' => 'A1',
        'title_en' => 'Unpublishable',
        'body_en' => "One.\n\nTwo.",
        'duration_seconds' => 20,
        'estimated_minutes' => 3,
        'audio_upload_id' => $upload['upload_id'],
    ])->assertOk();

    $refused = mcpTool($this, $this->plain, 'transition-content', [
        'type' => 'lesson',
        'action' => 'publish',
        'topic_slug' => 'mcp-failed-publish',
        'level' => 'A1',
        'confirm_review' => true,
    ]);

    $refused->assertOk()->assertJsonPath('result.isError', true);
    expect(mcpStructured($refused)['errors'])->toHaveKey('topic');

    $lesson = Lesson::query()->firstOrFail();
    expect($lesson->reviewed_by)->toBeNull()
        ->and($lesson->reviewed_at)->toBeNull()
        ->and($lesson->status)->toBe('draft');
});

test('invalid audio and cover bytes are rejected before a record is written', function () {
    mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-invalid',
        'title_en' => 'Invalid Uploads',
        'summary_public' => 'Validation proof.',
    ])->assertOk();

    $audioUpload = mcpBeginAudio($this, $this->plain);
    mcpPut($this, $audioUpload, 'this is not an mp3')->assertStatus(422);

    $lesson = mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-invalid',
        'level' => 'A1',
        'title_en' => 'Bad Audio',
        'body_en' => "One.\n\nTwo.",
        'duration_seconds' => 20,
        'estimated_minutes' => 3,
        'audio_upload_id' => $audioUpload['upload_id'],
    ]);

    $lesson->assertOk()->assertJsonPath('result.isError', true);
    expect(Lesson::query()->count())->toBe(0);

    $coverUpload = mcpTool($this, $this->plain, 'begin-upload', ['kind' => 'cover']);
    $coverUpload->assertOk();
    $cover = (array) $coverUpload->json('result.structuredContent.upload');

    mcpPut($this, $cover, 'not an image')->assertStatus(422);

    $validCoverUpload = mcpTool($this, $this->plain, 'begin-upload', ['kind' => 'cover']);
    $validCover = (array) $validCoverUpload->json('result.structuredContent.upload');
    mcpPut($this, $validCover, mcpFixture('s3-cover-fixture.jpg'))->assertOk();

    $withoutLicense = mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-licensed',
        'title_en' => 'Licensed Cover',
        'summary_public' => 'A staff cover needs a record.',
        'cover_upload_id' => $validCover['upload_id'],
    ]);

    $withoutLicense->assertOk()->assertJsonPath('result.isError', true);
    expect(mcpStructured($withoutLicense)['errors'])->toHaveKey('source_note')
        ->and(Topic::query()->where('slug', 'mcp-licensed')->exists())->toBeFalse();

    $secondCoverUpload = mcpTool($this, $this->plain, 'begin-upload', ['kind' => 'cover']);
    $secondCover = (array) $secondCoverUpload->json('result.structuredContent.upload');
    mcpPut($this, $secondCover, mcpFixture('s3-cover-fixture.jpg'))->assertOk();

    mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-licensed',
        'title_en' => 'Licensed Cover',
        'summary_public' => 'A staff cover with a record.',
        'cover_upload_id' => $secondCover['upload_id'],
        'source_note' => "Source: staff archive\nLicense: CC-BY 4.0\nChecked: 2026-11-08\nNotes: MCP test.",
    ])->assertOk()->assertJsonPath('result.structuredContent.ok', true);
});

test('a generated-cover license record cannot be reused for a staff-uploaded cover', function () {
    mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-license-carryover',
        'title_en' => 'License Carryover',
        'summary_public' => 'Generated first, then a real cover.',
    ])->assertOk();

    $topic = Topic::query()->where('slug', 'mcp-license-carryover')->firstOrFail();
    expect($topic->source_note)->toContain('License: generated');

    $uploadResponse = mcpTool($this, $this->plain, 'begin-upload', ['kind' => 'cover']);
    $upload = (array) $uploadResponse->json('result.structuredContent.upload');
    mcpPut($this, $upload, mcpFixture('s3-cover-fixture.jpg'))->assertOk();

    $refused = mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-license-carryover',
        'title_en' => 'License Carryover',
        'summary_public' => 'Generated first, then a real cover.',
        'cover_upload_id' => $upload['upload_id'],
    ]);

    $refused->assertOk()->assertJsonPath('result.isError', true);
    expect(mcpStructured($refused)['errors'])->toHaveKey('source_note');

    $topic->refresh();
    expect($topic->cover_path)->toStartWith('covers/gd-')
        ->and($topic->source_note)->toContain('License: generated');
});

test('revoking the MCP token between begin-upload and the PUT blocks the upload', function () {
    [$agentToken, $agentPlain] = mcpIssueToken($this->staff);
    $upload = mcpBeginAudio($this, $agentPlain);

    $agentToken->forceFill(['revoked_at' => now()])->save();

    mcpPut($this, $upload, mcpFixture('s1-a2-tone-fixture.mp3'))->assertStatus(401);
});

test('staged upload tokens are single-use, tamper-proof, expiring, and kind-bound', function () {
    $audio = mcpFixture('s1-a2-tone-fixture.mp3');
    $upload = mcpBeginAudio($this, $this->plain);

    mcpPut($this, $upload, $audio)->assertOk();
    mcpPut($this, $upload, $audio)->assertStatus(409);

    mcpTool($this, $this->plain, 'save-topic', [
        'slug' => 'mcp-upload-lifecycle',
        'title_en' => 'Upload Lifecycle',
        'summary_public' => 'Token lifecycle proof.',
    ])->assertOk();

    mcpTool($this, $this->plain, 'save-lesson', [
        'topic_slug' => 'mcp-upload-lifecycle',
        'level' => 'A1',
        'title_en' => 'Upload Lifecycle',
        'body_en' => "One.\n\nTwo.",
        'duration_seconds' => 20,
        'estimated_minutes' => 3,
        'audio_upload_id' => $upload['upload_id'],
    ])->assertOk()->assertJsonPath('result.isError', false);

    mcpPut($this, $upload, $audio)->assertStatus(409);

    $tampered = $upload;
    $tampered['headers']['X-Upload-Token'] = substr($tampered['headers']['X-Upload-Token'], 0, -1).'x';
    mcpPut($this, $tampered, $audio)->assertStatus(401);

    $expiring = mcpBeginAudio($this, $this->plain);
    $this->travel(31)->minutes();
    mcpPut($this, $expiring, $audio)->assertStatus(401);
    $this->travelBack();

    $cover = mcpTool($this, $this->plain, 'begin-upload', ['kind' => 'cover']);
    $coverUpload = (array) $cover->json('result.structuredContent.upload');
    mcpPut($this, $coverUpload, $audio)->assertStatus(422);
});

test('declared and actual oversize uploads are refused', function () {
    $begin = mcpTool($this, $this->plain, 'begin-upload', [
        'kind' => 'audio',
        'size_bytes' => 40 * 1024 * 1024,
    ]);

    $begin->assertOk()->assertJsonPath('result.isError', true);

    config(['content_mcp.max_upload_bytes.audio' => 1024]);

    $upload = mcpBeginAudio($this, $this->plain);
    $oversize = 'ID3'.str_repeat('x', 2048);

    $response = mcpPut($this, $upload, $oversize);
    expect($response->status())->toBeIn([413, 422]);
});

test('expired staged files are removed by the cleanup command', function () {
    $id = (string) Str::uuid();
    Storage::disk('local')->put('staged/'.$id, 'abandoned');
    Storage::disk('local')->put('staged/'.$id.'.done', '1');

    $this->travel(2)->hours();

    $this->artisan('mcp:cleanup-uploads')->assertExitCode(0);

    expect(Storage::disk('local')->exists('staged/'.$id))->toBeFalse()
        ->and(Storage::disk('local')->exists('staged/'.$id.'.done'))->toBeFalse();
});

test('the token CLI issues a one-time bearer token and revokes it', function () {
    $exit = Artisan::call('mcp:token', [
        'action' => 'issue',
        '--name' => 'cli-agent',
        '--email' => $this->staff->email,
        '--abilities' => 'content:read,content:write',
        '--days' => 30,
    ]);

    expect($exit)->toBe(0);

    $token = McpToken::query()->where('name', 'cli-agent')->firstOrFail();
    $output = Artisan::output();

    expect($output)->toContain('femcp_')
        ->and($token->abilities)->toBe(['content:read', 'content:write'])
        ->and($token->expires_at)->not->toBeNull();

    $this->artisan('mcp:token', [
        'action' => 'revoke',
        '--id' => $token->id,
    ])->assertExitCode(0);

    expect($token->fresh()->revoked_at)->not->toBeNull();

    $this->artisan('mcp:token', [
        'action' => 'issue',
        '--name' => 'student-agent',
        '--email' => ContentFixtures::student()->email,
    ])->assertExitCode(1);
});
