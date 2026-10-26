<?php

namespace App\Filament\Resources\Plans\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class PlanForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make('Plan')->components([
                    TextInput::make('name_fa')
                        ->label('Name (Persian)')
                        ->required()
                        ->maxLength(120),
                    TextInput::make('slug')
                        ->required()
                        ->alphaDash()
                        ->unique(ignoreRecord: true)
                        ->maxLength(120),
                    TextInput::make('price_toman')
                        ->label('Price (toman)')
                        ->required()
                        ->numeric()
                        ->integer()
                        ->minValue(0),
                    TextInput::make('duration_days')
                        ->label('Access duration (days)')
                        ->required()
                        ->numeric()
                        ->integer()
                        ->minValue(1)
                        ->maxValue(3650),
                    TextInput::make('display_order')
                        ->numeric()
                        ->integer()
                        ->default(0)
                        ->minValue(0),
                    Toggle::make('is_active')
                        ->label('Visible for purchase')
                        ->default(true),
                ])->columns(2),
            ]);
    }
}
