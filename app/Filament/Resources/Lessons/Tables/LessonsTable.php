<?php

namespace App\Filament\Resources\Lessons\Tables;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class LessonsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn ($query) => $query->with('topic'))
            ->columns([
                TextColumn::make('topic.title_en')
                    ->label('Topic')
                    ->searchable(),
                TextColumn::make('level')
                    ->badge()
                    ->sortable(),
                TextColumn::make('title_en')
                    ->label('Title')
                    ->searchable(),
                TextColumn::make('status')
                    ->badge(),
                IconColumn::make('is_public_sample')
                    ->label('Sample')
                    ->boolean(),
                TextColumn::make('audio_revision')
                    ->label('Rev.')
                    ->numeric()
                    ->sortable(),
                TextColumn::make('duration_seconds')
                    ->label('Secs')
                    ->numeric(),
                TextColumn::make('reviewed_at')
                    ->label('Reviewed')
                    ->dateTime()
                    ->placeholder('—'),
                TextColumn::make('published_at')
                    ->label('Published')
                    ->dateTime()
                    ->placeholder('—')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options(['draft' => 'Draft', 'published' => 'Published', 'archived' => 'Archived']),
                SelectFilter::make('level')
                    ->options(['A1' => 'A1', 'A2' => 'A2', 'B1' => 'B1', 'B2' => 'B2', 'C1' => 'C1', 'C2' => 'C2']),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                // Ever-published lessons are archived, not deleted (model
                // guard enforces this server-side; hidden here as well).
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
