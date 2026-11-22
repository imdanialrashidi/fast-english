<?php

namespace App\Console\Commands;

use App\Models\LibraryNode;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Attach the owner's one 2x3 art sheet to an already imported storybook
 * without touching the text, audio or revision. The six panel-to-frame
 * anchors are stored at import time (`meta.panel_map`); this command only
 * makes the sheet bytes available and flips the mapped pages to their
 * panel. A sheet added later therefore does not reset a reader's progress.
 */
class AttachLibrarySheet extends Command
{
    protected $signature = 'library:sheet
        {book : Story node slug (story/a2/police-tv) or id}
        {file : Path to the 2400x1800 2x3 sheet}';

    protected $description = 'Attach a 2x3 storybook sheet and light up its six mapped frames';

    public function handle(): int
    {
        $book = (string) $this->argument('book');
        $node = LibraryNode::query()
            ->where(fn ($query) => $query->where('slug', $book)->orWhere('id', (int) $book))
            ->first();

        if ($node === null || $node->track !== 'story') {
            $this->error('Story node not found.');

            return self::FAILURE;
        }

        $document = $node->document;
        if ($document === null) {
            $this->error('This node has no imported document.');

            return self::FAILURE;
        }

        $source = (string) $this->argument('file');
        if (! is_file($source)) {
            $this->error('Sheet file not found: '.$source);

            return self::FAILURE;
        }

        $info = @getimagesize($source);
        if ($info === false) {
            $this->error('The sheet is not a readable image.');

            return self::FAILURE;
        }

        [$width, $height] = $info;
        $ratio = $height === 0 ? 0 : $width / $height;
        if (abs($ratio - 4 / 3) > 0.08) {
            $this->warn(sprintf('Expected a 4:3 sheet; got %dx%d (%.2f:1). Panels may crop badly.', $width, $height, $ratio));
        }

        $extension = strtolower(pathinfo($source, PATHINFO_EXTENSION));
        if (! in_array($extension, ['webp', 'png', 'jpg', 'jpeg'], true)) {
            $this->error('Sheet must be webp, png or jpeg.');

            return self::FAILURE;
        }

        $file = $extension === 'jpeg' ? 'sheet.jpg' : 'sheet.'.$extension;
        $target = storage_path("app/private/library/{$node->slug}/r{$document->revision}/images");
        File::ensureDirectoryExists($target);
        File::copy($source, $target.'/'.$file);

        $payload = $document->document;
        $payload['meta']['sheet'] = [
            'file' => $file,
            'columns' => 2,
            'rows' => 3,
            'alt_fa' => null,
        ];

        $panelMap = [];
        foreach ((array) ($payload['meta']['panel_map'] ?? []) as $entry) {
            if (is_array($entry) && isset($entry['frame_id'])) {
                $panelMap[(string) $entry['frame_id']] = $entry;
            }
        }

        $mapped = 0;
        foreach ($payload['chapters'] as $chapterIndex => $chapter) {
            foreach ($chapter['pages'] as $pageIndex => $page) {
                $panel = $panelMap[(string) ($page['id'] ?? '')] ?? null;
                if ($panel === null) {
                    continue;
                }
                $payload['chapters'][$chapterIndex]['pages'][$pageIndex]['panel_index'] = (int) $panel['panel_index'];
                $payload['chapters'][$chapterIndex]['pages'][$pageIndex]['alt_fa'] = $panel['alt_fa'] ?? null;
                $mapped++;
            }
        }

        $document->update([
            'document' => $payload,
            'checksum' => hash('sha256', (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
        ]);
        $node->update(['status' => 'published']);

        $this->info(sprintf('Attached %s to %s · %d mapped frames · revision %d', $file, $node->slug, $mapped, $document->revision));

        return self::SUCCESS;
    }
}
