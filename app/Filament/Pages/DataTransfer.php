<?php

namespace App\Filament\Pages;

use App\Support\DataTransfer as TransferService;
use BackedEnum;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;

/**
 * Staff-only Import / Export (OPS-01).
 *
 * One ZIP out, one ZIP in. The page is intentionally small: it has no
 * archive list, no scheduled jobs and no lifecycle table — the owner
 * downloads a file, keeps it, and can import it on any matching install.
 *
 * The destructive work posts to DataTransferController behind auth+staff;
 * this page never trusts client state for data replacement.
 */
class DataTransfer extends Page
{
    protected string $view = 'filament.pages.data-transfer';

    protected static ?string $navigationLabel = 'Import / Export';

    protected static ?string $title = 'Import / Export';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedArrowsRightLeft;

    protected static ?int $navigationSort = 90;

    public ?string $safetyName = null;

    public ?string $safetySize = null;

    public function mount(): void
    {
        $absolute = TransferService::latestSafetyCopy();

        if ($absolute !== null && is_file($absolute)) {
            $this->safetyName = basename($absolute);
            $this->safetySize = TransferService::humanBytes((int) filesize($absolute));
        }
    }

    public static function canAccess(): bool
    {
        $user = auth()->user();

        return $user !== null && (bool) $user->is_staff && $user->disabled_at === null;
    }
}
