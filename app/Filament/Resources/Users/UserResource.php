<?php

namespace App\Filament\Resources\Users;

use App\Filament\Resources\Users\Pages\ListUsers;
use App\Filament\Resources\Users\Pages\ViewUser;
use App\Models\PaymentRequest;
use App\Models\User;
use App\Support\Entitlement;
use App\Support\Toman;
use BackedEnum;
use Filament\Actions\ViewAction;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

/**
 * Staff user operations (scope ADM-02: plans, destination, support,
 * payment queue and users).
 *
 * The panel is intentionally read-only except for account suspension and
 * the shared audited subscription actions. Staff never edit a learner's
 * profile, password, role or expiry by hand.
 */
class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationLabel = 'Users';

    protected static ?string $recordTitleAttribute = 'name';

    protected static string|UnitEnum|null $navigationGroup = 'Business';

    protected static ?int $navigationSort = 0;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedUsers;

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with('subscription'))
            ->columns([
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('email')
                    ->searchable(),
                IconColumn::make('is_staff')
                    ->label('Staff')
                    ->boolean(),
                TextColumn::make('subscription_status')
                    ->label('Subscription')
                    ->badge()
                    ->getStateUsing(fn (User $record) => $record->subscription?->statusLabel() ?? 'None'),
                TextColumn::make('subscription.expires_at')
                    ->label('Access until')
                    ->dateTime()
                    ->placeholder('—'),
                TextColumn::make('disabled_at')
                    ->label('Suspended')
                    ->dateTime()
                    ->placeholder('—'),
                TextColumn::make('payment_requests_count')
                    ->label('Requests')
                    ->counts('paymentRequests'),
                TextColumn::make('created_at')
                    ->label('Joined')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('is_staff')
                    ->label('Role')
                    ->options(['1' => 'Staff', '0' => 'Learner']),
                Filter::make('suspended')
                    ->label('Suspended only')
                    ->query(fn (Builder $query) => $query->whereNotNull('disabled_at'))
                    ->toggle(),
                Filter::make('active_subscription')
                    ->label('Active subscription')
                    ->query(fn (Builder $query) => $query->whereHas('subscription', fn (Builder $subscription) => $subscription
                        ->whereNull('revoked_at')
                        ->where('starts_at', '<=', now())
                        ->where('expires_at', '>', now())))
                    ->toggle(),
            ])
            ->recordActions([
                ViewAction::make(),
            ])
            ->defaultSort('created_at', 'desc');
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Account')->components([
                TextEntry::make('name'),
                TextEntry::make('email'),
                TextEntry::make('role')
                    ->label('Role')
                    ->getStateUsing(fn (User $record) => $record->is_staff ? 'Staff' : 'Learner'),
                TextEntry::make('disabled_at')
                    ->label('Suspended at')
                    ->dateTime()
                    ->placeholder('Active account'),
                TextEntry::make('created_at')->label('Joined')->dateTime(),
            ])->columns(2),

            Section::make('Subscription (current)')->components([
                TextEntry::make('subscription_state')
                    ->label('State')
                    ->getStateUsing(fn (User $record) => $record->subscription?->statusLabel() ?? 'No subscription row'),
                TextEntry::make('subscription.starts_at')->dateTime()->placeholder('—'),
                TextEntry::make('subscription.expires_at')->dateTime()->placeholder('—'),
                TextEntry::make('subscription.revoked_at')->dateTime()->placeholder('—'),
                TextEntry::make('subscription_events_summary')
                    ->label('Recent subscription events')
                    ->getStateUsing(fn (User $record) => $record->subscriptionEvents()
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

            Section::make('Recent payment requests')->components([
                TextEntry::make('payment_requests_summary')
                    ->label('Latest 5')
                    ->getStateUsing(fn (User $record) => $record->paymentRequests()
                        ->orderByDesc('created_at')
                        ->limit(5)
                        ->get()
                        ->map(fn (PaymentRequest $request) => '#'.$request->id
                            .' · '.$request->status
                            .' · '.Toman::format((int) $request->amount_toman_snapshot)
                            .' · '.$request->created_at->timezone('Asia/Tehran')->format('Y-m-d H:i'))
                        ->all() ?: ['No payment requests yet.'])
                    ->listWithLineBreaks()
                    ->columnSpanFull(),
            ]),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListUsers::route('/'),
            'view' => ViewUser::route('/{record}'),
        ];
    }

    public static function canViewAny(): bool
    {
        return self::activeStaff();
    }

    public static function canView(Model $record): bool
    {
        return self::activeStaff();
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function canDeleteAny(): bool
    {
        return false;
    }

    private static function activeStaff(): bool
    {
        return Entitlement::staff(auth()->user());
    }
}
