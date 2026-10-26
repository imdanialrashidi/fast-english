<?php

namespace App\Filament\Resources\Topics\Schemas;

use App\Rules\CoverSignature;
use App\Support\CoverImage;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Placeholder;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

class TopicForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('slug')
                    ->required()
                    ->alphaDash()
                    ->unique(ignoreRecord: true)
                    ->maxLength(120),
                TextInput::make('title_en')
                    ->label('Title (English)')
                    ->required()
                    ->maxLength(255),
                Textarea::make('summary_public')
                    ->label('Public summary')
                    ->required()
                    ->columnSpanFull(),
                Select::make('category_id')
                    ->relationship('category', 'name_fa')
                    ->searchable()
                    ->preload()
                    ->createOptionForm([
                        TextInput::make('name_fa')->label('Name (Persian)')->required()->maxLength(120),
                        TextInput::make('slug')->required()->alphaDash()->unique()->maxLength(120),
                    ]),
                FileUpload::make('cover_path')
                    ->label('Cover (JPEG, PNG, or WebP, max 2 MB)')
                    ->disk('public')
                    ->directory('covers')
                    ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
                    ->rules(['file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:2048', new CoverSignature])
                    ->getUploadedFileNameForStorageUsing(
                        fn (TemporaryUploadedFile $file): string => (string) Str::ulid().'.'.(CoverImage::MIME_MAP[$file->getMimeType()] ?? 'jpg')
                    )
                    ->helperText('Stored under a random name on the public disk; metadata is stripped on save.'),
                Textarea::make('source_note')
                    ->label('Source note (private)')
                    ->helperText('Private: never shown to learners. Staff covers need four lines — Source: / License: / Checked: YYYY-MM-DD / Notes:. GD default covers (covers/gd-*.jpg) are exempt.')
                    ->columnSpanFull(),
                Placeholder::make('status')
                    ->content(fn ($record) => $record?->status ?? 'draft')
                    ->helperText('Status changes only through the Publish / Archive actions.'),
            ]);
    }
}
