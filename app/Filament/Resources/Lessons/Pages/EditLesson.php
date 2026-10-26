<?php

namespace App\Filament\Resources\Lessons\Pages;

use App\Filament\Resources\Concerns\HasContentTransitions;
use App\Filament\Resources\Lessons\LessonResource;
use Filament\Actions\DeleteAction;
use Filament\Actions\ViewAction;
use Filament\Resources\Pages\EditRecord;

class EditLesson extends EditRecord
{
    use HasContentTransitions;

    protected static string $resource = LessonResource::class;

    /**
     * Lesson hides audio_path from array/JSON serialization (private media
     * path). Filament fills the form from attributesToArray(), so without
     * this hook every edit looks like it has no audio and is blocked by the
     * required FileUpload; re-uploading would bump audio_revision and reset
     * learner progress. Re-add the raw path for the staff form/view only.
     */
    protected function mutateFormDataBeforeFill(array $data): array
    {
        $data['audio_path'] = $this->getRecord()->getRawOriginal('audio_path');

        return $data;
    }

    protected function getHeaderActions(): array
    {
        return [
            ViewAction::make(),
            ...self::lessonTransitionActions(),
            // Hidden for ever-published lessons; the model guard refuses the
            // delete server-side regardless of the button state.
            DeleteAction::make()
                ->hidden(fn ($record) => $record !== null && ($record->status !== 'draft' || $record->published_at !== null)),
        ];
    }
}
