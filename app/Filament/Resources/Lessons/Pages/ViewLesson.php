<?php

namespace App\Filament\Resources\Lessons\Pages;

use App\Filament\Resources\Concerns\HasContentTransitions;
use App\Filament\Resources\Lessons\LessonResource;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;

class ViewLesson extends ViewRecord
{
    use HasContentTransitions;

    protected static string $resource = LessonResource::class;

    /** Same hidden-attribute bridge as EditLesson (private audio path). */
    protected function mutateFormDataBeforeFill(array $data): array
    {
        $data['audio_path'] = $this->getRecord()->getRawOriginal('audio_path');

        return $data;
    }

    protected function getHeaderActions(): array
    {
        return [
            EditAction::make(),
            ...self::lessonTransitionActions(),
        ];
    }
}
