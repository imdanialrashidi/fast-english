<?php

namespace App\Support\Flashcards;

use App\Models\Flashcard;
use App\Models\FlashcardBook;
use App\Models\FlashcardUnit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Imports a curated flashcard dataset (manifest.json + units/*.json +
 * images/audio) into the app.
 *
 * The importer is idempotent by stable external ids: book slug, unit number
 * and card id. It never touches learner state, so re-importing corrected
 * content preserves every schedule. Images are cropped from the book page to
 * the inner card square and re-encoded as WebP; audio is copied verbatim
 * after a real MPEG sniff.
 */
final class Importer
{
    public function __construct(
        private readonly string $source,
        private readonly bool $force = false,
        private readonly bool $draft = false,
        private readonly bool $crop = true,
        private readonly bool $dryRun = false,
    ) {}

    /**
     * @return array{book: string, units: int, cards: int, images: int, audio: int, errors: list<string>}
     */
    public function run(): array
    {
        $source = rtrim($this->source, '/');
        $manifestPath = $source.'/manifest.json';

        if (! is_file($manifestPath)) {
            throw new RuntimeException("The dataset manifest was not found at {$manifestPath}.");
        }

        $manifest = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($manifest)) {
            throw new RuntimeException('The dataset manifest is not a JSON object.');
        }

        $bookData = is_array($manifest['book'] ?? null) ? $manifest['book'] : [];
        $slug = trim((string) ($bookData['id'] ?? ''));
        if ($slug === '' || preg_match('/^[a-z0-9-]+$/', $slug) !== 1) {
            throw new RuntimeException('The dataset book id must be a lowercase kebab-case slug.');
        }

        $units = is_array($manifest['units'] ?? null) ? $manifest['units'] : [];
        if ($units === []) {
            throw new RuntimeException('The dataset contains no units.');
        }

        $study = $this->studyConfig($source, $manifest);
        $report = [
            'book' => $slug,
            'units' => 0,
            'cards' => 0,
            'images' => 0,
            'audio' => 0,
            'errors' => [],
        ];

        $coverPath = $this->importCover($source, $slug, $report);

        $write = ! $this->dryRun;
        $work = function () use ($source, $slug, $bookData, $units, $study, $coverPath, &$report, $write): void {
            $book = $write
                ? FlashcardBook::updateOrCreate(
                    ['slug' => $slug],
                    [
                        'title_en' => (string) ($bookData['title'] ?? $slug),
                        'title_fa' => $this->nullable($bookData['titleFa'] ?? null),
                        'level' => $this->nullable($bookData['level'] ?? null),
                        'edition' => $this->nullable($bookData['edition'] ?? null),
                        'cover_path' => $coverPath,
                        'study_config' => $study,
                        'status' => $this->draft ? 'draft' : 'published',
                        'sort_order' => 0,
                    ],
                )
                : null;

            foreach ($units as $unitRef) {
                if (! is_array($unitRef)) {
                    continue;
                }

                $number = (int) ($unitRef['unit'] ?? 0);
                $unitFile = trim((string) ($unitRef['file'] ?? ''));
                if ($number <= 0 || $unitFile === '') {
                    throw new RuntimeException('Every dataset unit needs a positive number and a file path.');
                }

                $unitPath = $source.'/'.ltrim($unitFile, '/');
                if (! is_file($unitPath)) {
                    throw new RuntimeException("The unit file was not found: {$unitFile}.");
                }

                $unitData = json_decode((string) file_get_contents($unitPath), true, 512, JSON_THROW_ON_ERROR);
                if (! is_array($unitData)) {
                    throw new RuntimeException("The unit file is not a JSON object: {$unitFile}.");
                }

                $unit = $write
                    ? FlashcardUnit::updateOrCreate(
                        ['book_id' => $book->id, 'number' => $number],
                        [
                            'title_en' => (string) ($unitData['title'] ?? $unitRef['title'] ?? "Unit {$number}"),
                            'title_fa' => $this->nullable($unitData['titleFa'] ?? $unitRef['titleFa'] ?? null),
                            'subtitle' => $this->nullable($unitData['subtitle'] ?? $unitRef['subtitle'] ?? null),
                            'sort_order' => $number,
                        ],
                    )
                    : null;

                $report['units']++;

                $cards = is_array($unitData['cards'] ?? null) ? $unitData['cards'] : [];
                if ($cards === []) {
                    throw new RuntimeException("Unit {$number} has no cards.");
                }

                foreach ($cards as $index => $card) {
                    if (! is_array($card)) {
                        throw new RuntimeException("Unit {$number} contains a card that is not an object.");
                    }

                    $externalId = trim((string) ($card['id'] ?? ''));
                    if ($externalId === '' || preg_match('/^[a-z0-9-]+$/', $externalId) !== 1) {
                        throw new RuntimeException("Unit {$number} contains an invalid card id.");
                    }

                    $imageRel = trim((string) ($card['images']['front'] ?? ''));
                    $audioRel = trim((string) ($card['audio']['file'] ?? ''));
                    if ($imageRel === '' || $audioRel === '') {
                        throw new RuntimeException("Card {$externalId} is missing its image or audio path.");
                    }

                    $base = 'flashcards/'.$slug.'/u'.str_pad((string) $number, 2, '0', STR_PAD_LEFT);
                    $imageDest = $base.'/'.$externalId.'.webp';
                    $audioDest = $base.'/'.$externalId.'.mp3';

                    $report['images'] += $this->importImage($source.'/'.ltrim($imageRel, '/'), $imageDest) ? 1 : 0;
                    $report['audio'] += $this->importAudio($source.'/'.ltrim($audioRel, '/'), $audioDest) ? 1 : 0;

                    $word = trim((string) ($card['word'] ?? ''));
                    $translation = trim((string) ($card['translationFa'] ?? ''));
                    if ($word === '' || $translation === '') {
                        throw new RuntimeException("Card {$externalId} needs a word and a Persian translation.");
                    }

                    if ($write) {
                        Flashcard::updateOrCreate(
                            ['external_id' => $externalId],
                            [
                                'unit_id' => $unit->id,
                                'word' => mb_substr($word, 0, 120),
                                'display' => $this->nullable(mb_substr((string) ($card['display'] ?? $word), 0, 160)),
                                'phonetic' => $this->nullable(mb_substr((string) ($card['phonetic'] ?? ''), 0, 80)),
                                'translation_fa' => mb_substr($translation, 0, 160),
                                'definition_en' => $this->nullable(mb_substr((string) ($card['definitionEn'] ?? ''), 0, 500)),
                                'example_en' => $this->nullable(mb_substr((string) ($card['exampleEn'] ?? ''), 0, 500)),
                                'part_of_speech' => $this->nullable(mb_substr((string) ($card['partOfSpeech'] ?? ''), 0, 40)),
                                'lesson_code' => $this->nullable(mb_substr((string) ($card['lesson'] ?? ''), 0, 16)),
                                'topic' => $this->nullable(mb_substr((string) ($card['topic'] ?? ''), 0, 120)),
                                'image_path' => $imageDest,
                                'audio_path' => $audioDest,
                                'sort_order' => (int) ($card['order'] ?? ($index + 1)),
                            ],
                        );
                    }

                    $report['cards']++;
                }
            }
        };

        if ($write) {
            DB::transaction($work);
        } else {
            $work();
        }

        return $report;
    }

    /**
     * @param  array<string, mixed>  $manifest
     * @return array<string, mixed>|null
     */
    private function studyConfig(string $source, array $manifest): ?array
    {
        if (is_array($manifest['study'] ?? null)) {
            return $manifest['study'];
        }

        $deckPath = $source.'/deck.json';
        if (! is_file($deckPath)) {
            return null;
        }

        $deck = json_decode((string) file_get_contents($deckPath), true);

        return is_array($deck['study'] ?? null) ? $deck['study'] : null;
    }

    /** @param array<string, mixed> $report */
    private function importCover(string $source, string $slug, array &$report): ?string
    {
        $from = $source.'/cover.jpg';
        if (! is_file($from)) {
            return null;
        }

        $dest = 'flashcards/'.$slug.'/cover.webp';
        if ($this->dryRun) {
            return $dest;
        }

        if (! $this->force && Storage::disk('local')->exists($dest)) {
            return $dest;
        }

        $this->processCover($from, $dest);

        return $dest;
    }

    private function importImage(string $from, string $dest): bool
    {
        if (! is_file($from)) {
            throw new RuntimeException("The card image was not found: {$from}.");
        }

        if ($this->dryRun) {
            return true;
        }

        if (! $this->force && Storage::disk('local')->exists($dest)) {
            return false;
        }

        $this->processImage($from, $dest);

        return true;
    }

    private function importAudio(string $from, string $dest): bool
    {
        if (! is_file($from)) {
            throw new RuntimeException("The card audio was not found: {$from}.");
        }

        $bytes = (string) file_get_contents($from);
        if (! $this->looksLikeMp3($bytes)) {
            throw new RuntimeException("The card audio is not an MP3: {$from}.");
        }

        if ($this->dryRun) {
            return true;
        }

        if (! $this->force && Storage::disk('local')->exists($dest)) {
            return false;
        }

        Storage::disk('local')->makeDirectory(dirname($dest));
        Storage::disk('local')->put($dest, $bytes);

        return true;
    }

    private function processImage(string $from, string $dest): void
    {
        $bytes = (string) file_get_contents($from);
        $image = @imagecreatefromstring($bytes);
        if ($image === false) {
            throw new RuntimeException("The card image could not be decoded: {$from}.");
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $crop = $this->crop;

        if ($crop) {
            [$x, $y, $cropWidth, $cropHeight] = array_map('intval', (array) config('flashcards.images.crop', [70, 170, 940, 940]));
            $cropWidth = min($cropWidth, $width);
            $cropHeight = min($cropHeight, $height);
            $x = max(0, min($x, $width - $cropWidth));
            $y = max(0, min($y, $height - $cropHeight));
        } else {
            $side = min($width, $height);
            $cropWidth = $side;
            $cropHeight = $side;
            $x = (int) (($width - $side) / 2);
            $y = (int) (($height - $side) / 2);
        }

        $cropped = imagecrop($image, ['x' => $x, 'y' => $y, 'width' => $cropWidth, 'height' => $cropHeight]);
        imagedestroy($image);
        if ($cropped === false) {
            throw new RuntimeException("The card image could not be cropped: {$from}.");
        }

        $size = max(200, (int) config('flashcards.images.size', 1000));
        $scaled = imagescale($cropped, $size, $size, IMG_BICUBIC);
        imagedestroy($cropped);
        if ($scaled === false) {
            throw new RuntimeException("The card image could not be resized: {$from}.");
        }

        ob_start();
        imagewebp($scaled, null, (int) config('flashcards.images.quality', 88));
        $webp = ob_get_clean();
        imagedestroy($scaled);

        if (! is_string($webp) || $webp === '') {
            throw new RuntimeException("The card image could not be encoded as WebP: {$from}.");
        }

        Storage::disk('local')->makeDirectory(dirname($dest));
        Storage::disk('local')->put($dest, $webp);
    }

    private function processCover(string $from, string $dest): void
    {
        $bytes = (string) file_get_contents($from);
        $image = @imagecreatefromstring($bytes);
        if ($image === false) {
            throw new RuntimeException("The book cover could not be decoded: {$from}.");
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $targetRatio = 4 / 3;
        $ratio = $width / max(1, $height);
        if ($ratio > $targetRatio) {
            $cropWidth = (int) round($height * $targetRatio);
            $cropHeight = $height;
            $x = (int) (($width - $cropWidth) / 2);
            $y = 0;
        } else {
            $cropWidth = $width;
            $cropHeight = (int) round($width / $targetRatio);
            $x = 0;
            $y = (int) (($height - $cropHeight) / 2);
        }

        $cropped = imagecrop($image, ['x' => $x, 'y' => $y, 'width' => $cropWidth, 'height' => $cropHeight]);
        imagedestroy($image);
        if ($cropped === false) {
            throw new RuntimeException("The book cover could not be cropped: {$from}.");
        }

        $scaled = imagescale(
            $cropped,
            (int) config('flashcards.images.cover_width', 1200),
            (int) config('flashcards.images.cover_height', 900),
            IMG_BICUBIC,
        );
        imagedestroy($cropped);
        if ($scaled === false) {
            throw new RuntimeException("The book cover could not be resized: {$from}.");
        }

        ob_start();
        imagewebp($scaled, null, 86);
        $webp = ob_get_clean();
        imagedestroy($scaled);

        if (! is_string($webp) || $webp === '') {
            throw new RuntimeException("The book cover could not be encoded as WebP: {$from}.");
        }

        Storage::disk('local')->makeDirectory(dirname($dest));
        Storage::disk('local')->put($dest, $webp);
    }

    private function looksLikeMp3(string $bytes): bool
    {
        if (strlen($bytes) < 128) {
            return false;
        }

        if (str_starts_with($bytes, 'ID3')) {
            return true;
        }

        $first = ord($bytes[0]);

        return $first === 0xFF && (ord($bytes[1]) & 0xE0) === 0xE0;
    }

    private function nullable(mixed $value): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : $text;
    }
}
