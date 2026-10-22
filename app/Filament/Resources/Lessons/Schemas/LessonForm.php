<?php

namespace App\Filament\Resources\Lessons\Schemas;

use App\Actions\PublishLesson;
use App\Rules\Mp3Signature;
use App\Support\Glossary;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

class LessonForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Select::make('topic_id')
                    ->relationship('topic', 'title_en')
                    ->required()
                    ->searchable()
                    ->preload(),
                Select::make('level')
                    ->options(array_combine(PublishLesson::LEVELS, PublishLesson::LEVELS))
                    ->required(),
                TextInput::make('title_en')
                    ->label('Title (English)')
                    ->required()
                    ->maxLength(255),
                Textarea::make('body_en')
                    ->label('Body (English, plain paragraphs)')
                    ->required()
                    ->rows(10)
                    ->columnSpanFull(),
                Repeater::make('glossary')
                    ->label('Key words (max '.Glossary::MAX_ENTRIES.')')
                    ->schema([
                        TextInput::make('word')
                            ->required()
                            ->maxLength(Glossary::MAX_WORD_LENGTH),
                        TextInput::make('meaning_fa')
                            ->label('Meaning (Persian)')
                            ->required()
                            ->maxLength(Glossary::MAX_MEANING_LENGTH),
                        TextInput::make('example_en')
                            ->label('Example (English, optional)')
                            ->maxLength(Glossary::MAX_EXAMPLE_LENGTH),
                    ])
                    ->maxItems(Glossary::MAX_ENTRIES)
                    ->default([])
                    ->addActionLabel('Add word')
                    ->columnSpanFull(),
                FileUpload::make('audio_path')
                    ->label('Audio (MP3, max 30 MB)')
                    ->disk('local')
                    ->directory('lessons')
                    ->acceptedFileTypes(['audio/mpeg'])
                    ->rules(['file', 'mimetypes:audio/mpeg', 'max:30720', new Mp3Signature])
                    ->getUploadedFileNameForStorageUsing(
                        fn (TemporaryUploadedFile $file): string => (string) Str::ulid().'.mp3'
                    )
                    ->helperText('Stored on the private disk; replacing it increments the audio revision.')
                    ->required(),
                TextInput::make('duration_seconds')
                    ->label('Duration (seconds)')
                    ->required()
                    ->numeric()
                    ->minValue(1),
                TextInput::make('estimated_minutes')
                    ->label('Study time (minutes)')
                    ->required()
                    ->numeric()
                    ->minValue(1),
                Toggle::make('is_public_sample')
                    ->label('Public sample'),
                Select::make('reviewed_by')
                    ->label('Reviewer')
                    ->relationship('reviewer', 'name')
                    ->searchable()
                    ->preload()
                    ->helperText('Content review is required before publishing.'),
                DateTimePicker::make('reviewed_at')
                    ->label('Reviewed at'),
                Placeholder::make('status')
                    ->content(fn ($record) => $record?->status ?? 'draft')
                    ->helperText('Status changes only through the Publish / Archive actions.'),
            ]);
    }
}
