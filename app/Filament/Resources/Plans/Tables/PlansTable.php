<?php

namespace App\Filament\Resources\Plans\Tables;

use App\Support\Toman;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class PlansTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name_fa')
                    ->label('Name')
                    ->searchable(),
                TextColumn::make('slug')
                    ->searchable(),
                TextColumn::make('price_toman')
                    ->label('Price')
                    ->formatStateUsing(fn ($state): string => Toman::format((int) $state))
                    ->sortable(),
                TextColumn::make('duration_days')
                    ->label('Days')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('display_order')
                    ->label('Order')
                    ->numeric()
                    ->sortable(),
                IconColumn::make('is_active')
                    ->label('Active')
                    ->boolean(),
                TextColumn::make('payment_requests_count')
                    ->label('Requests')
                    ->counts('paymentRequests'),
            ])
            ->recordActions([
                EditAction::make(),
            ]);
    }
}
