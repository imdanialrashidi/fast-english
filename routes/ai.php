<?php

use App\Http\Controllers\McpUploadController;
use App\Http\Middleware\AuthenticateMcpToken;
use App\Http\Middleware\AuthenticateMcpUpload;
use App\Http\Middleware\McpPrivateNoStore;
use App\Mcp\Servers\ContentServer;
use Illuminate\Support\Facades\Route;
use Laravel\Mcp\Facades\Mcp;

/*
|--------------------------------------------------------------------------
| Agent surfaces (MCP)
|--------------------------------------------------------------------------
|
| These routes are loaded by the MCP package outside the web stack: no
| session cookie and no CSRF token. Authentication is a staff bearer token
| (hashed in mcp_tokens) for the JSON-RPC endpoint and a short-lived,
| single-use upload token for the binary PUT. Nothing here is public:
| without a valid token every request is rejected before a tool runs.
|
*/

Route::middleware([
    McpPrivateNoStore::class,
    'throttle:'.(int) config('content_mcp.rate_limits.mcp', 120).',1',
    AuthenticateMcpToken::class,
])->group(function (): void {
    Mcp::web('/mcp/content', ContentServer::class)
        ->name('mcp.content');
});

Route::put('/mcp/uploads/{upload}', McpUploadController::class)
    ->where('upload', '[0-9a-fA-F-]{36}')
    ->middleware([
        McpPrivateNoStore::class,
        'throttle:'.(int) config('content_mcp.rate_limits.upload', 20).',1',
        AuthenticateMcpUpload::class,
    ])
    ->name('mcp.upload');
