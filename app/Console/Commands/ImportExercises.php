<?php

namespace App\Console\Commands;

use App\Models\ExerciseItem;
use App\Models\ExerciseSet;
use App\Models\ExerciseTopic;
use App\Models\FlashcardBook;
use App\Models\Lesson;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Throwable;

/**
 * Imports one reviewed exercise file. The v2 shape is grammar-first: a unit
 * set carries ordered grammar topics (Persian explanation, formulas,
 * examples) and every item belongs to one topic, so the unit page can render
 * explanation → questions → explanation in the book's order.
 *
 * Content only: attempts and answers live in their own tables and survive a
 * re-import. Topics and items are upserted by stable keys and never deleted.
 *
 * Shape (see database/seeders/fixtures/exercises/aef-3e-starter-u01.json):
 * external_id, book+unit (or lesson_id), title, instructions_fa, source{},
 * topics[{key,title_en,title_fa,use_fa,formulas[],examples[],notes_fa}],
 * items[{external_id,topic,type,prompt,options,answer,explanation_fa,
 * feedback{option: text}}].
 */
class ImportExercises extends Command
{
    protected $signature = 'exercises:import
        {source : Path to one exercise JSON or a directory of files}
        {--draft : Import the sets as drafts instead of published}
        {--dry-run : Validate the files without writing}';

    protected $description = 'Import or update grammar-first exercise sets for book units or lessons.';

    public function handle(): int
    {
        $source = (string) $this->argument('source');
        $files = $this->files($source);

        if ($files === []) {
            $this->error("No exercise JSON found at: {$source}");

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $rows = [];
        $failures = 0;

        foreach ($files as $file) {
            try {
                $normalized = $this->read($file);
                if (! $dryRun) {
                    $this->write($normalized);
                }

                $rows[] = [
                    basename($file),
                    $normalized['external_id'],
                    count($normalized['topics']),
                    count($normalized['items']),
                    $dryRun ? 'valid' : 'written',
                ];
            } catch (Throwable $e) {
                $failures++;
                $rows[] = [basename($file), '—', 0, 0, 'error: '.$e->getMessage()];
            }
        }

        $this->table(['File', 'Set', 'Topics', 'Items', 'Result'], $rows);
        $this->info(sprintf(
            '%d file(s): %d ok, %d error(s)%s.',
            count($files),
            count($files) - $failures,
            $failures,
            $dryRun ? ' (dry run: nothing written)' : '',
        ));

        return $failures === 0 ? self::SUCCESS : self::FAILURE;
    }

    /** @return list<string> */
    private function files(string $source): array
    {
        if (is_dir($source)) {
            $files = glob(rtrim($source, '/').'/*.json') ?: [];
            sort($files);

            return $files;
        }

        return is_file($source) ? [$source] : [];
    }

    /** @return array{external_id: string, unit_id: ?int, lesson_id: ?int, title: string, instructions_fa: string, sort_order: int, source: ?array, topics: list<array<string, mixed>>, items: list<array<string, mixed>>} */
    private function read(string $path): array
    {
        $data = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        if (! is_array($data)) {
            throw new InvalidArgumentException("The exercise file must contain one JSON object: {$path}");
        }

        return $this->normalize($data);
    }

    /** @param array<string, mixed> $normalized */
    private function write(array $normalized): void
    {
        DB::transaction(function () use ($normalized): void {
            $set = ExerciseSet::query()->updateOrCreate(
                ['external_id' => $normalized['external_id']],
                [
                    'unit_id' => $normalized['unit_id'],
                    'lesson_id' => $normalized['lesson_id'],
                    'title' => $normalized['title'],
                    'instructions_fa' => $normalized['instructions_fa'],
                    'status' => (bool) $this->option('draft') ? 'draft' : 'published',
                    'sort_order' => $normalized['sort_order'],
                    'source' => $normalized['source'],
                ],
            );

            $topicIds = [];
            foreach ($normalized['topics'] as $topic) {
                $model = ExerciseTopic::query()->updateOrCreate(
                    ['set_id' => $set->id, 'key' => $topic['key']],
                    [
                        'position' => $topic['position'],
                        'title_en' => $topic['title_en'],
                        'title_fa' => $topic['title_fa'],
                        'use_fa' => $topic['use_fa'],
                        'formulas' => $topic['formulas'],
                        'examples' => $topic['examples'],
                        'notes_fa' => $topic['notes_fa'],
                    ],
                );
                $topicIds[$topic['key']] = (int) $model->id;
            }

            foreach ($normalized['items'] as $item) {
                ExerciseItem::query()->updateOrCreate(
                    ['set_id' => $set->id, 'external_id' => $item['external_id']],
                    [
                        'topic_id' => $item['topic'] === null ? null : $topicIds[$item['topic']],
                        'position' => $item['position'],
                        'type' => $item['type'],
                        'prompt' => $item['prompt'],
                        'options' => $item['options'],
                        'answer' => $item['answer'],
                        'explanation_fa' => $item['explanation_fa'],
                        'feedback' => $item['feedback'],
                        'points' => $item['points'],
                    ],
                );
            }
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{external_id: string, unit_id: ?int, lesson_id: ?int, title: string, instructions_fa: string, sort_order: int, source: ?array, topics: list<array<string, mixed>>, items: list<array<string, mixed>>}
     */
    private function normalize(array $data): array
    {
        $externalId = $this->text($data['external_id'] ?? null, 'external_id');
        $title = $this->text($data['title'] ?? null, 'title');
        $instructions = $this->text($data['instructions_fa'] ?? null, 'instructions_fa');

        $unitId = null;
        $lessonId = null;

        if (isset($data['book'], $data['unit'])) {
            $bookSlug = $this->text($data['book'], 'book');
            $unitNumber = (int) $data['unit'];
            $book = FlashcardBook::query()->where('slug', $bookSlug)->first();
            if ($book === null) {
                throw new InvalidArgumentException("Book not found: {$bookSlug}");
            }

            $unit = $book->units()->where('number', $unitNumber)->first();
            if ($unit === null) {
                throw new InvalidArgumentException("Unit {$unitNumber} not found in {$bookSlug}.");
            }

            $unitId = (int) $unit->id;
        } elseif (isset($data['lesson_id'])) {
            $lesson = Lesson::query()->find((int) $data['lesson_id']);
            if ($lesson === null) {
                throw new InvalidArgumentException('Lesson not found: '.$data['lesson_id']);
            }

            $lessonId = (int) $lesson->id;
        } else {
            throw new InvalidArgumentException('The set needs book+unit or lesson_id.');
        }

        $topics = $this->topics($data['topics'] ?? []);
        $items = $this->items($data['items'] ?? null, array_column($topics, 'key'));

        return [
            'external_id' => $externalId,
            'unit_id' => $unitId,
            'lesson_id' => $lessonId,
            'title' => $title,
            'instructions_fa' => $instructions,
            'sort_order' => isset($data['sort_order']) ? max(0, (int) $data['sort_order']) : 0,
            'source' => isset($data['source']) && is_array($data['source']) ? $data['source'] : null,
            'topics' => $topics,
            'items' => $items,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function topics(mixed $raw): array
    {
        if ($raw === []) {
            return [];
        }

        if (! is_array($raw)) {
            throw new InvalidArgumentException('topics must be an array.');
        }

        $rows = [];
        $seenKeys = [];
        $seenPositions = [];

        foreach (array_values($raw) as $index => $topic) {
            if (! is_array($topic)) {
                throw new InvalidArgumentException('Topic '.($index + 1).' is not an object.');
            }

            $key = $this->text($topic['key'] ?? null, 'topics.'.($index + 1).'.key');
            if (isset($seenKeys[$key])) {
                throw new InvalidArgumentException("Duplicate topic key: {$key}");
            }
            $seenKeys[$key] = true;

            $position = isset($topic['position']) ? (int) $topic['position'] : $index + 1;
            if ($position < 1 || isset($seenPositions[$position])) {
                throw new InvalidArgumentException("Invalid or duplicate position for topic {$key}.");
            }
            $seenPositions[$position] = true;

            $formulas = $this->formulas($topic['formulas'] ?? [], $key);
            $examples = $this->examples($topic['examples'] ?? [], $key);

            $rows[] = [
                'key' => $key,
                'position' => $position,
                'title_en' => $this->text($topic['title_en'] ?? null, "topics.{$key}.title_en"),
                'title_fa' => $this->text($topic['title_fa'] ?? null, "topics.{$key}.title_fa"),
                'use_fa' => $this->text($topic['use_fa'] ?? null, "topics.{$key}.use_fa"),
                'formulas' => $formulas,
                'examples' => $examples,
                'notes_fa' => $this->nullableText($topic['notes_fa'] ?? null),
            ];
        }

        return $rows;
    }

    /** @return list<array{label_fa: string, text: string}> */
    private function formulas(mixed $raw, string $topic): array
    {
        if (! is_array($raw) || $raw === []) {
            throw new InvalidArgumentException("Topic {$topic} needs at least one formula.");
        }

        $rows = [];
        foreach (array_values($raw) as $formula) {
            if (! is_array($formula)) {
                throw new InvalidArgumentException("Topic {$topic} has a malformed formula.");
            }
            $rows[] = [
                'label_fa' => $this->text($formula['label_fa'] ?? null, "topics.{$topic}.formulas.label_fa"),
                'text' => $this->text($formula['text'] ?? null, "topics.{$topic}.formulas.text"),
            ];
        }

        return $rows;
    }

    /** @return list<array{en: string, fa: ?string}> */
    private function examples(mixed $raw, string $topic): array
    {
        if (! is_array($raw) || $raw === []) {
            throw new InvalidArgumentException("Topic {$topic} needs at least one example.");
        }

        $rows = [];
        foreach (array_values($raw) as $example) {
            if (! is_array($example)) {
                throw new InvalidArgumentException("Topic {$topic} has a malformed example.");
            }
            $rows[] = [
                'en' => $this->text($example['en'] ?? null, "topics.{$topic}.examples.en"),
                'fa' => $this->nullableText($example['fa'] ?? null),
            ];
        }

        return $rows;
    }

    /**
     * @param  list<string>  $topicKeys
     * @return list<array<string, mixed>>
     */
    private function items(mixed $raw, array $topicKeys): array
    {
        if (! is_array($raw) || $raw === []) {
            throw new InvalidArgumentException('The set needs a non-empty items array.');
        }

        $seenIds = [];
        $seenPositions = [];
        $rows = [];

        foreach (array_values($raw) as $index => $item) {
            if (! is_array($item)) {
                throw new InvalidArgumentException('Item '.($index + 1).' is not an object.');
            }

            $itemExternal = $this->text($item['external_id'] ?? null, 'items.'.($index + 1).'.external_id');
            if (isset($seenIds[$itemExternal])) {
                throw new InvalidArgumentException("Duplicate item external_id: {$itemExternal}");
            }
            $seenIds[$itemExternal] = true;

            $position = isset($item['position']) ? (int) $item['position'] : $index + 1;
            if ($position < 1 || isset($seenPositions[$position])) {
                throw new InvalidArgumentException("Invalid or duplicate position for item {$itemExternal}.");
            }
            $seenPositions[$position] = true;

            $topic = null;
            if (isset($item['topic'])) {
                $topic = $this->text($item['topic'], "items.{$itemExternal}.topic");
                if (! in_array($topic, $topicKeys, true)) {
                    throw new InvalidArgumentException("Item {$itemExternal} points at an unknown topic: {$topic}");
                }
            } elseif ($topicKeys !== []) {
                throw new InvalidArgumentException("Item {$itemExternal} needs a topic.");
            }

            $type = $this->text($item['type'] ?? null, "items.{$itemExternal}.type");
            if (! in_array($type, ['choice', 'matching'], true)) {
                throw new InvalidArgumentException("Unknown type for item {$itemExternal}: {$type}");
            }

            $prompt = $this->text($item['prompt'] ?? null, "items.{$itemExternal}.prompt");
            $options = null;
            $answer = null;
            $feedback = null;

            if ($type === 'choice') {
                $rawOptions = $item['options'] ?? null;
                if (! is_array($rawOptions) || count($rawOptions) < 2) {
                    throw new InvalidArgumentException("Choice item {$itemExternal} needs at least two options.");
                }

                $options = array_values(array_map(
                    fn (mixed $option): string => $this->text($option, "items.{$itemExternal}.options"),
                    $rawOptions,
                ));

                $answerIndex = $item['answer'] ?? null;
                if (! is_int($answerIndex) || $answerIndex < 0 || $answerIndex >= count($options)) {
                    throw new InvalidArgumentException("Choice item {$itemExternal} needs a valid answer index.");
                }
                $answer = ['index' => $answerIndex];

                if (isset($item['feedback'])) {
                    if (! is_array($item['feedback'])) {
                        throw new InvalidArgumentException("Choice item {$itemExternal} has malformed feedback.");
                    }
                    $feedback = [];
                    foreach ($item['feedback'] as $optionIndex => $text) {
                        $optionIndex = (int) $optionIndex;
                        if ($optionIndex < 0 || $optionIndex >= count($options)) {
                            throw new InvalidArgumentException("Feedback for item {$itemExternal} points at an unknown option.");
                        }
                        $feedback[(string) $optionIndex] = $this->text($text, "items.{$itemExternal}.feedback");
                    }
                }
            } else {
                $pairs = $item['pairs'] ?? null;
                if (! is_array($pairs) || count($pairs) < 2 || count($pairs) > 6) {
                    throw new InvalidArgumentException("Matching item {$itemExternal} needs 2 to 6 pairs.");
                }

                $left = [];
                $right = [];
                foreach (array_values($pairs) as $pair) {
                    if (! is_array($pair)) {
                        throw new InvalidArgumentException("Matching item {$itemExternal} has a malformed pair.");
                    }
                    $left[] = $this->text($pair['left'] ?? null, "items.{$itemExternal}.pairs.left");
                    $right[] = $this->text($pair['right'] ?? null, "items.{$itemExternal}.pairs.right");
                }

                if (count(array_unique($right)) !== count($right)) {
                    throw new InvalidArgumentException("Matching item {$itemExternal} has a duplicate right side.");
                }

                $options = ['left' => $left, 'right' => $right];
                $answer = ['map' => array_keys($left)];
            }

            $explanation = $this->nullableText($item['explanation_fa'] ?? null);
            $points = isset($item['points']) ? (int) $item['points'] : 1;

            $rows[] = [
                'external_id' => $itemExternal,
                'topic' => $topic,
                'position' => $position,
                'type' => $type,
                'prompt' => $prompt,
                'options' => $options,
                'answer' => $answer,
                'explanation_fa' => $explanation,
                'feedback' => $feedback,
                'points' => max(1, $points),
            ];
        }

        return $rows;
    }

    private function text(mixed $value, string $field): string
    {
        $text = trim((string) ($value ?? ''));
        if ($text === '') {
            throw new InvalidArgumentException("Missing {$field}.");
        }

        return $text;
    }

    private function nullableText(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : $text;
    }
}
