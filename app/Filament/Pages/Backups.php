<?php

namespace App\Filament\Pages;

use App\Models\Backup;
use BackedEnum;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;

/**
 * Staff-only one-click Backup & Restore (OPS-01).
 *
 * Lists previous backups with status/date/size, offers one-click create,
 * upload, download, delete, and a confirmed restore with a verified
 * pre-restore recovery point. The destructive work posts to
 * BackupController (auth + staff middleware) — this page never trusts
 * client state for data replacement.
 */
class Backups extends Page
{
    protected string $view = 'filament.pages.backups';

    protected static ?string $navigationLabel = 'Backups';

    protected static ?string $title = 'Backups';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedArchiveBox;

    protected static ?int $navigationSort = 90;

    /** @var list<array<string, mixed>> */
    public array $items = [];

    public ?array $lastCompleted = null;

    public function mount(): void
    {
        $backups = Backup::query()->orderByDesc('id')->limit(50)->get();

        $this->items = $backups->map(fn (Backup $backup): array => [
            'id' => $backup->id,
            'filename' => $backup->filename,
            'status' => $backup->status,
            'type' => $backup->type,
            'size_bytes' => $backup->size_bytes,
            'size_human' => $backup->size_bytes !== null ? self::humanBytes((int) $backup->size_bytes) : '—',
            'checksum_short' => $backup->checksum_sha256 !== null ? substr($backup->checksum_sha256, 0, 12).'…' : '—',
            'error_message' => $backup->error_message,
            'created_at' => $backup->created_at?->toDateTimeString(),
            'completed_at' => $backup->completed_at?->toDateTimeString(),
        ])->all();

        $last = Backup::where('status', Backup::STATUS_COMPLETED)
            ->orderByDesc('completed_at')->first();

        $this->lastCompleted = $last !== null ? [
            'id' => $last->id,
            'completed_at' => $last->completed_at?->toDateTimeString(),
            'size_human' => $last->size_bytes !== null ? self::humanBytes((int) $last->size_bytes) : '—',
        ] : null;
    }

    public static function canAccess(): bool
    {
        $user = auth()->user();

        return $user !== null && (bool) $user->is_staff && $user->disabled_at === null;
    }

    private static function humanBytes(int $bytes): string
    {
        foreach (['B', 'KB', 'MB', 'GB'] as $unit) {
            if ($bytes < 1024 || $unit === 'GB') {
                return round($bytes, 1).' '.$unit;
            }
            $bytes /= 1024;
        }

        return round($bytes, 1).' GB';
    }
}
