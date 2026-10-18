<?php

namespace App\Filament\Resources\PaymentRequests;

use App\Filament\Resources\PaymentRequests\Pages\ListPaymentRequests;
use App\Filament\Resources\PaymentRequests\Pages\ViewPaymentRequest;
use App\Filament\Resources\PaymentRequests\Tables\PaymentRequestsTable;
use App\Models\PaymentRequest;
use App\Support\Entitlement;
use App\Support\Toman;
use BackedEnum;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

/**
 * S6 staff payment queue (scope ADM-02, §10–11).
 *
 * Read-only resource: staff never create or edit requests here — the
 * snapshot is immutable and expires_at has no free-text editor. All state
 * changes go through the review actions, which call the shared
 * ApprovePayment action. The receipt renders through the staff-only
 * no-store receipt route (session + policy, never a public URL).
 */
class PaymentRequestResource extends Resource
{
    protected static ?string $model = PaymentRequest::class;

    protected static ?string $navigationLabel = 'Payment queue';

    protected static ?string $recordTitleAttribute = 'id';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBanknotes;

    public static function table(Table $table): Table
    {
        return PaymentRequestsTable::configure($table);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Snapshot (server-written, immutable)')->components([
                TextEntry::make('user.email')->label('Learner'),
                TextEntry::make('plan_name_snapshot')->label('Plan'),
                TextEntry::make('amount_toman_snapshot')
                    ->label('Amount (toman)')
                    ->getStateUsing(fn ($record) => $record->snapshot()['amount_label']),
                TextEntry::make('duration_days_snapshot')->label('Duration (days)'),
                TextEntry::make('destination_card')
                    ->label('Destination card')
                    ->getStateUsing(fn ($record) => $record->snapshot()['card_number'] !== '' ? $record->snapshot()['card_number'] : '—'),
                TextEntry::make('destination_holder')
                    ->label('Card holder')
                    ->getStateUsing(fn ($record) => $record->snapshot()['holder_name'] !== '' ? $record->snapshot()['holder_name'] : '—'),
                TextEntry::make('destination_bank')
                    ->label('Bank')
                    ->getStateUsing(fn ($record) => $record->snapshot()['bank_name'] !== '' ? $record->snapshot()['bank_name'] : '—'),
                TextEntry::make('status')->badge(),
                TextEntry::make('public_reason')->label('Public reason')->placeholder('—'),
                TextEntry::make('created_at')->label('Opened')->dateTime(),
                TextEntry::make('reviewed_at')->label('Reviewed at')->dateTime()->placeholder('—'),
            ]),
            Section::make('Receipt (private, staff-only)')->components([
                ImageEntry::make('receipt_image')
                    ->label('Receipt image')
                    ->getStateUsing(fn ($record) => $record->receipt_path
                        ? route('payments.receipt.show', $record)
                        : null)
                    ->placeholder('No receipt submitted yet.')
                    ->imageHeight('24rem'),
            ]),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPaymentRequests::route('/'),
            'view' => ViewPaymentRequest::route('/{record}'),
        ];
    }

    /**
     * The panel queue is staff-only. Learner routes keep using the
     * owner-only PaymentRequestPolicy::view; that policy is untouched so
     * staff gain no access to another learner's pages — only to this
     * queue and the receipt bytes (viewReceipt).
     */
    public static function canViewAny(): bool
    {
        return self::activeStaff();
    }

    public static function canView(Model $record): bool
    {
        return self::activeStaff();
    }

    private static function activeStaff(): bool
    {
        return Entitlement::staff(auth()->user());
    }
}
