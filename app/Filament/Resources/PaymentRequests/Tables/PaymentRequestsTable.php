<?php

namespace App\Filament\Resources\PaymentRequests\Tables;

use App\Filament\Resources\PaymentRequests\PaymentReviewActions;
use App\Models\PaymentRequest;
use App\Support\Toman;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

/**
 * S6 payment queue (scope §10–11, ADM-02): pending requests first, then
 * oldest first, with the server-written snapshot on every row. Status and
 * snapshot columns are read-only; expires_at has no editor anywhere.
 */
class PaymentRequestsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn ($query) => $query
                ->with(['user'])
                ->orderByRaw("case when status = '".PaymentRequest::STATUS_PENDING."' then 0 else 1 end")
                ->orderBy('created_at'))
            ->columns([
                TextColumn::make('id')
                    ->label('#')
                    ->sortable(),
                TextColumn::make('user.email')
                    ->label('Learner')
                    ->searchable(),
                TextColumn::make('status')
                    ->badge(),
                TextColumn::make('plan_name_snapshot')
                    ->label('Plan')
                    ->searchable(),
                TextColumn::make('amount_toman_snapshot')
                    ->label('Amount')
                    ->formatStateUsing(fn ($state) => Toman::format((int) $state)),
                TextColumn::make('duration_days_snapshot')
                    ->label('Days')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('created_at')
                    ->label('Opened')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        PaymentRequest::STATUS_PENDING => 'Pending',
                        PaymentRequest::STATUS_AWAITING_RECEIPT => 'Awaiting receipt',
                        PaymentRequest::STATUS_APPROVED => 'Approved',
                        PaymentRequest::STATUS_REJECTED => 'Rejected',
                        PaymentRequest::STATUS_CANCELLED => 'Cancelled',
                    ]),
            ])
            ->recordActions([
                ViewAction::make(),
                PaymentReviewActions::approve(),
                PaymentReviewActions::reject(),
                PaymentReviewActions::cancel(),
            ]);
    }
}
