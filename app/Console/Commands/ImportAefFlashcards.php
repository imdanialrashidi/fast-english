<?php

namespace App\Console\Commands;

use App\Models\Flashcard;
use App\Models\FlashcardBook;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use RuntimeException;

/**
 * Imports one unit's vocabulary deck from a reviewed JSON file plus its Woof
 * audio clips. The file is authoritative for that unit: cards missing from
 * it are removed (learner schedules cascade), and every card keeps a stable
 * external id across re-imports.
 *
 * Card shape:
 * external_id, word, phonetic, translation_fa, definition_en, example_en,
 * part_of_speech, lesson_code, topic, audio (file name in --audio).
 */
class ImportAefFlashcards extends Command
{
    protected $signature = 'flashcards:import-aef
        {file : Path to the unit deck JSON}
        {--audio= : Folder holding the generated MP3 files}
        {--draft : Import the book as a draft instead of published}';

    protected $description = 'Import or update one American English File unit deck with its audio.';

    public function handle(): int
    {
        $path = (string) $this->argument('file');
        if (! is_file($path)) {
            $this->error("Deck file not found: {$path}");

            return self::FAILURE;
        }

        $data = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        $slug = (string) ($data['book']['slug'] ?? '');
        $number = (int) ($data['unit']['number'] ?? 0);
        $audioDir = $this->option('audio');

        $book = FlashcardBook::query()->where('slug', $slug)->first();
        if ($book === null) {
            throw new InvalidArgumentException("Book not found: {$slug}. Run aef:import-catalog first.");
        }

        $unit = $book->units()->where('number', $number)->first();
        if ($unit === null) {
            throw new InvalidArgumentException("Unit {$number} not found in {$slug}.");
        }

        $cards = $data['cards'] ?? null;
        if (! is_array($cards) || $cards === []) {
            throw new InvalidArgumentException('The deck needs a non-empty cards array.');
        }

        $rows = [];
        $seen = [];
        foreach (array_values($cards) as $index => $card) {
            if (! is_array($card)) {
                throw new InvalidArgumentException('Card '.($index + 1).' is not an object.');
            }

            $externalId = trim((string) ($card['external_id'] ?? ''));
            if ($externalId === '' || isset($seen[$externalId])) {
                throw new InvalidArgumentException('Missing or duplicate card external_id at card '.($index + 1).'.');
            }
            $seen[$externalId] = true;

            foreach (['word', 'translation_fa', 'audio'] as $field) {
                if (trim((string) ($card[$field] ?? '')) === '') {
                    throw new InvalidArgumentException("Card {$externalId} is missing {$field}.");
                }
            }

            $rows[] = $card;
        }

        $audioFiles = [];
        foreach ($rows as $card) {
            $audio = (string) $card['audio'];
            $source = $audioDir === null ? null : rtrim((string) $audioDir, '/').'/'.basename($audio);
            if ($source === null || ! is_file($source)) {
                throw new RuntimeException("Audio not found for card {$card['external_id']}: {$audio}");
            }
            $audioFiles[$card['external_id']] = $source;
        }

        $written = DB::transaction(function () use ($data, $unit, $rows, $audioFiles, $slug, $number): int {
            $unit->forceFill([
                'title_en' => (string) ($data['unit']['title_en'] ?? $unit->title_en),
                'title_fa' => (string) ($data['unit']['title_fa'] ?? $unit->title_fa),
            ])->save();

            $dir = sprintf('flashcards/%s/u%02d', $slug, $number);
            $kept = [];

            foreach ($rows as $position => $card) {
                $externalId = (string) $card['external_id'];
                $kept[] = $externalId;

                $stored = $dir.'/'.$externalId.'.mp3';
                Storage::disk('local')->put($stored, (string) file_get_contents($audioFiles[$externalId]));

                Flashcard::query()->updateOrCreate(
                    ['external_id' => $externalId],
                    [
                        'unit_id' => $unit->id,
                        'word' => (string) $card['word'],
                        'display' => $card['display'] ?? null,
                        'phonetic' => $card['phonetic'] ?? null,
                        'translation_fa' => (string) $card['translation_fa'],
                        'definition_en' => $card['definition_en'] ?? null,
                        'example_en' => $card['example_en'] ?? null,
                        'part_of_speech' => $card['part_of_speech'] ?? null,
                        'lesson_code' => $card['lesson_code'] ?? null,
                        'topic' => $card['topic'] ?? null,
                        'image_path' => null,
                        'audio_path' => $stored,
                        'sort_order' => $position + 1,
                    ],
                );
            }

            Flashcard::query()
                ->where('unit_id', $unit->id)
                ->whereNotIn('external_id', $kept)
                ->delete();

            return count($kept);
        });

        $this->info(sprintf('%s · unit %d: %d cards imported with audio.', $book->title_en, $number, $written));

        return self::SUCCESS;
    }
}
