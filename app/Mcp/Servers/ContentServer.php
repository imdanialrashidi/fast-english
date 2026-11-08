<?php

namespace App\Mcp\Servers;

use App\Mcp\Tools\BeginUploadTool;
use App\Mcp\Tools\GetContentTool;
use App\Mcp\Tools\ListContentTool;
use App\Mcp\Tools\SaveCategoryTool;
use App\Mcp\Tools\SaveLessonTool;
use App\Mcp\Tools\SaveTopicTool;
use App\Mcp\Tools\TransitionContentTool;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;
use Laravel\Mcp\Server\Tool;

#[Name('Fast English Content')]
#[Version('1.0.0')]
#[Instructions(<<<'MARKDOWN'
This server uploads and publishes Fast English lesson content (categories, topics, lessons, MP3 audio, covers).

Workflow:
1. Call list-content and get-content first. Topics are keyed by slug; lessons by (topic slug, CEFR level). save-topic/save-lesson are idempotent upserts, so retries update the same row.
2. For binary files call begin-upload, then PUT the raw bytes to the returned URL with the X-Upload-Token header (curl is in the response). Audio must be a real MP3 <= 30 MB; covers JPEG/PNG/WebP <= 2 MB. Upload tokens are single-use and expire.
3. save-topic and save-lesson write drafts only. They refuse existing published or archived rows; for those, archive it, return it to draft, edit, then publish again (or edit in /admin).
4. transition-content publishes/archives. Publishing is allowed only for tokens issued with content:publish. Publishing a draft lesson always requires confirm_review=true, which records the token owner as reviewer; only assert it after a human reviewed the exact text and audio. Publish the topic before its lessons.
5. A topic without a cover gets a deterministic generated cover. A staff-uploaded cover requires a source_note with Source:, License:, Checked: YYYY-MM-DD, Notes: lines.

Never invent a license, reviewer, duration, or audio file. Drafts are invisible to learners until transition-content publishes them.
MARKDOWN)]
class ContentServer extends Server
{
    /** @var array<int, class-string<Tool>> */
    protected array $tools = [
        ListContentTool::class,
        GetContentTool::class,
        SaveCategoryTool::class,
        SaveTopicTool::class,
        SaveLessonTool::class,
        BeginUploadTool::class,
        TransitionContentTool::class,
    ];
}
