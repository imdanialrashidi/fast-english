<?php

namespace App\Filament\Resources\Categories\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;

class CategoryForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name_fa')
                    ->label('Name (Persian)')
                    ->required()
                    ->maxLength(120),
                TextInput::make('slug')
                    ->required()
                    ->alphaDash()
                    ->unique(ignoreRecord: true)
                    ->maxLength(120),
                TextInput::make('display_order')
                    ->numeric()
                    ->integer()
                    ->default(0)
                    ->minValue(0),
                Toggle::make('is_active')
                    ->default(true),
            ]);
    }
}
