<?php

namespace App\Filament\Resources\Topics\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class TopicsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn ($query) => $query->with('category'))
            ->columns([
                ImageColumn::make('cover_path')
                    ->label('Cover')
                    ->disk('public'),
                TextColumn::make('title_en')
                    ->label('Title')
                    ->searchable(),
                TextColumn::make('category.name_fa')
                    ->label('Category'),
                TextColumn::make('status')
                    ->badge(),
                TextColumn::make('lessons_count')
                    ->counts('lessons')
                    ->label('Lessons'),
                TextColumn::make('published_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options(['draft' => 'Draft', 'published' => 'Published', 'archived' => 'Archived']),
                SelectFilter::make('category')
                    ->relationship('category', 'name_fa'),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                // Ever-published topics are archived, not deleted (model guard
                // enforces this server-side; the button is hidden as well).
                DeleteAction::make()
                    ->hidden(fn ($record) => $record !== null && ($record->status !== 'draft' || $record->published_at !== null)),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
