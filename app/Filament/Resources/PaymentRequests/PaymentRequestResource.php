<?php

namespace App\Filament\Resources\PaymentRequests;

use App\Filament\Resources\PaymentRequests\Pages\ListPaymentRequests;
use App\Filament\Resources\PaymentRequests\Pages\ViewPaymentRequest;
use App\Filament\Resources\PaymentRequests\Tables\PaymentRequestsTable;
use App\Models\PaymentRequest;
use App\Support\Entitlement;
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
            ])->columns(2),

            // The learner supplies these optional transfer hints so staff
            // can match the transfer against the destination account. They
            // stay private to the panel; the learner page never receives
            // them. Before this section they were write-only.
            Section::make('Transfer details (learner-supplied, optional)')->components([
                TextEntry::make('bank_reference')
                    ->label('Bank reference / tracking code')
                    ->getStateUsing(fn ($record) => filled($record->bank_reference) ? $record->bank_reference : '—'),
                TextEntry::make('sender_last4')
                    ->label('Sender card last 4')
                    ->getStateUsing(fn ($record) => filled($record->sender_last4) ? $record->sender_last4 : '—'),
                TextEntry::make('transferred_at')
                    ->label('Transferred at')
                    ->getStateUsing(fn ($record) => $record->transferred_at)
                    ->dateTime()
                    ->placeholder('—'),
            ])->columns(3),

            Section::make('Review audit')->components([
                TextEntry::make('reviewer.name')->label('Reviewed by')->placeholder('—'),
                TextEntry::make('canceller.name')->label('Cancelled by')->placeholder('—'),
                TextEntry::make('cancelled_at')->label('Cancelled at')->dateTime()->placeholder('—'),
                TextEntry::make('internal_note')
                    ->label('Internal note (staff only)')
                    ->getStateUsing(fn ($record) => filled($record->internal_note) ? $record->internal_note : '—')
                    ->columnSpanFull(),
            ])->columns(3),

            // A reviewer needs the current window before granting or
            // revoking; the payment snapshot alone says nothing about the
            // learner's live access.
            Section::make('Learner subscription (current)')->components([
                TextEntry::make('subscription_status')
                    ->label('State')
                    ->getStateUsing(fn ($record) => $record->user?->subscription?->statusLabel() ?? 'No subscription row'),
                TextEntry::make('subscription_starts_at')
                    ->label('Starts at')
                    ->getStateUsing(fn ($record) => $record->user?->subscription?->starts_at)
                    ->dateTime()
                    ->placeholder('—'),
                TextEntry::make('subscription_expires_at')
                    ->label('Expires at')
                    ->getStateUsing(fn ($record) => $record->user?->subscription?->expires_at)
                    ->dateTime()
                    ->placeholder('—'),
                TextEntry::make('subscription_revoked_at')
                    ->label('Revoked at')
                    ->getStateUsing(fn ($record) => $record->user?->subscription?->revoked_at)
                    ->dateTime()
                    ->placeholder('—'),
                TextEntry::make('subscription_events_summary')
                    ->label('Recent subscription events')
                    ->getStateUsing(fn ($record) => $record->user?->subscriptionEvents()
                        ->with('actor')
                        ->orderByDesc('created_at')
                        ->limit(5)
                        ->get()
                        ->map(fn ($event) => $event->created_at->timezone('Asia/Tehran')->format('Y-m-d H:i')
                            .' · '.$event->type
                            .($event->actor?->name ? ' · '.$event->actor->name : '')
                            .($event->duration_days ? ' · '.$event->duration_days.' days' : ''))
                        ->all() ?: ['No subscription events yet.'])
                    ->listWithLineBreaks()
                    ->columnSpanFull(),
            ])->columns(2),

            Section::make('Receipt (private, staff-only)')->components([
                ImageEntry::make('receipt_image')
                    ->label('Receipt image')
                    ->visible(fn ($record) => $record->receiptAvailable())
                    ->getStateUsing(fn ($record) => route('payments.receipt.show', $record))
                    ->imageHeight('24rem'),
                TextEntry::make('receipt_state')
                    ->label('Receipt')
                    ->visible(fn ($record) => ! $record->receiptAvailable())
                    ->getStateUsing(fn ($record) => $record->receiptStateLabel())
                    ->columnSpanFull(),
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
