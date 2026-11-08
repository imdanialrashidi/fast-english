<?php

namespace App\Console\Commands;

use App\Support\StagedUpload;
use Illuminate\Console\Command;

/**
 * Remove abandoned staged agent uploads (owner request 2026-11-08).
 *
 * Upload tokens expire after 30 minutes by default, but the bytes would
 * otherwise stay on the private disk if the agent never calls the save
 * tool. The scheduler runs this every fifteen minutes; --dry-run reports
 * what would be removed without touching files.
 */
class McpCleanupUploads extends Command
{
    protected $signature = 'mcp:cleanup-uploads {--dry-run : List expired staged uploads without deleting them}';

    protected $description = 'Delete expired staged uploads from the content MCP server.';

    public function handle(): int
    {
        $ttl = (int) config('content_mcp.upload_ttl_minutes', 30);
        $dryRun = (bool) $this->option('dry-run');
        $count = StagedUpload::cleanup($ttl, $dryRun);

        $this->info(($dryRun ? 'Would remove' : 'Removed')." {$count} expired staged upload(s).");

        return 0;
    }
}
