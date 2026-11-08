<?php

use App\Support\AudioFile;
use App\Support\CoverImage;

return [

    /*
    |--------------------------------------------------------------------------
    | Content MCP server
    |--------------------------------------------------------------------------
    |
    | The agent-facing content upload boundary. Tokens are issued only for
    | active staff through `php artisan mcp:token`; this file holds the
    | non-secret limits that both the MCP tools and the staged upload
    | endpoint enforce. Nothing here enables publishing by itself: that is a
    | per-token ability granted explicitly at issue time.
    |
    */

    'token_days' => 90,

    'default_abilities' => [
        'content:read',
        'content:write',
    ],

    // A staged binary is single-use and short-lived; the cleanup command
    // removes anything older than this so abandoned uploads cannot
    // accumulate on the private disk.
    'upload_ttl_minutes' => 30,

    'max_upload_bytes' => [
        'audio' => AudioFile::MAX_BYTES,
        'cover' => CoverImage::MAX_BYTES,
    ],

    'rate_limits' => [
        // Requests per minute per client IP for the JSON-RPC endpoint and
        // for binary PUTs. One agent normally stays far below these.
        'mcp' => 120,
        'upload' => 20,
    ],

    'staging_dir' => 'staged',

];
