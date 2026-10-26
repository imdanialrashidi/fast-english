<?php

namespace Database\Seeders;

use App\Actions\PublishPlacementTest;
use App\Models\PlacementQuestion;
use App\Models\PlacementTest;
use Illuminate\Database\Seeder;

/**
 * The public placement test (owner launch input 2026-10-26).
 *
 * Twenty four-option fill-in-the-blank items, four per CEFR band, ordered
 * from A1 to C1. Every item has one unambiguously correct answer and three
 * plausible distractors that test the same grammar point or word class.
 * The correct option rotates across all four positions (five items each),
 * so position is never a signal.
 *
 * Item design rules:
 * - one blank per sentence, one correct completion, no "all of the above";
 * - the blank tests a single structure (tense, article, collocation, …);
 * - no culturally specific knowledge, no trick punctuation, no dialect
 *   variant that would make a second option acceptable;
 * - everyday adult contexts (work, travel, study), never product copy.
 *
 * Run once on a new install, after migrations:
 *   php artisan db:seed --class=PlacementCatalogSeeder --force
 *
 * Safe to re-run: the version is matched by name, questions are added once,
 * and publishing retires the previous current version. Published versions
 * stay immutable for attempts that were pinned to them.
 */
class PlacementCatalogSeeder extends Seeder
{
    public const VERSION = 'placement-2026-10-v1';

    /**
     * @return list<array{level: string, prompt: string, options: list<string>, answer: int}>
     */
    public static function items(): array
    {
        return [
            // --- A1: present simple, articles, place prepositions, plurals ---
            [
                'level' => 'A1',
                'prompt' => 'Ali ____ football every Friday.',
                'options' => ['play', 'playing', 'plays', 'played'],
                'answer' => 2,
            ],
            [
                'level' => 'A1',
                'prompt' => 'She is ____ engineer.',
                'options' => ['an', 'a', 'the', 'some'],
                'answer' => 0,
            ],
            [
                'level' => 'A1',
                'prompt' => 'The keys are ____ the bag.',
                'options' => ['at', 'to', 'of', 'in'],
                'answer' => 3,
            ],
            [
                'level' => 'A1',
                'prompt' => 'There are three ____ in the room.',
                'options' => ['chair', 'chairs', 'a chair', "chair's"],
                'answer' => 1,
            ],

            // --- A2: past simple, comparatives, future intention, obligation ---
            [
                'level' => 'A2',
                'prompt' => 'We ____ to Shiraz last summer.',
                'options' => ['go', 'gone', 'went', 'going'],
                'answer' => 2,
            ],
            [
                'level' => 'A2',
                'prompt' => 'This book is ____ than that one.',
                'options' => ['interestinger', 'most interesting', 'interesting', 'more interesting'],
                'answer' => 3,
            ],
            [
                'level' => 'A2',
                'prompt' => 'I ____ visit my grandmother tomorrow.',
                'options' => ['am going to', 'going to', 'will to', 'am go to'],
                'answer' => 0,
            ],
            [
                'level' => 'A2',
                'prompt' => "You ____ wear a seatbelt in a car. It's the law.",
                'options' => ['might', 'must', 'could', 'would'],
                'answer' => 1,
            ],

            // --- B1: present perfect, first conditional, passive, gerund ---
            [
                'level' => 'B1',
                'prompt' => 'She ____ here since 2019.',
                'options' => ['works', 'is working', 'has worked', 'worked'],
                'answer' => 2,
            ],
            [
                'level' => 'B1',
                'prompt' => "If it ____ tomorrow, we'll stay at home.",
                'options' => ['rains', 'will rain', 'rained', 'is raining'],
                'answer' => 0,
            ],
            [
                'level' => 'B1',
                'prompt' => 'The report ____ by the manager yesterday.',
                'options' => ['wrote', 'is writing', 'has wrote', 'was written'],
                'answer' => 3,
            ],
            [
                'level' => 'B1',
                'prompt' => "I'm looking forward to ____ you.",
                'options' => ['meet', 'meeting', 'met', 'have met'],
                'answer' => 1,
            ],

            // --- B2: past perfect, second conditional, reported speech, linking ---
            [
                'level' => 'B2',
                'prompt' => "She couldn't open the door because she ____ her keys.",
                'options' => ['lost', 'was losing', 'had lost', 'has lost'],
                'answer' => 2,
            ],
            [
                'level' => 'B2',
                'prompt' => 'If I ____ more time, I would learn another language.',
                'options' => ['have', 'will have', 'am having', 'had'],
                'answer' => 3,
            ],
            [
                'level' => 'B2',
                'prompt' => 'She said she ____ the email the day before.',
                'options' => ['had sent', 'sends', 'has sent', 'will send'],
                'answer' => 0,
            ],
            [
                'level' => 'B2',
                'prompt' => 'The project was cancelled ____ the lack of funding.',
                'options' => ['although', 'due to', 'despite of', 'even though'],
                'answer' => 1,
            ],

            // --- C1: inversion, unreal past, reduced relative, precise lexis ---
            [
                'level' => 'C1',
                'prompt' => 'Not only ____ the exam, but he also got the highest score.',
                'options' => ['he passed', 'he did pass', 'did he pass', 'passed he'],
                'answer' => 2,
            ],
            [
                'level' => 'C1',
                'prompt' => 'Had I known about the delay, I ____ differently.',
                'options' => ['would have acted', 'would act', 'had acted', 'will act'],
                'answer' => 0,
            ],
            [
                'level' => 'C1',
                'prompt' => "The proposal ____ at yesterday's meeting was rejected.",
                'options' => ['discussing', 'discuss', 'to discuss', 'discussed'],
                'answer' => 3,
            ],
            [
                'level' => 'C1',
                'prompt' => 'His argument was so ____ that even his critics were convinced.',
                'options' => ['compulsory', 'compelling', 'complacent', 'compatible'],
                'answer' => 1,
            ],
        ];
    }

    public function run(): void
    {
        $test = PlacementTest::where('version', self::VERSION)->first();

        if ($test !== null && $test->status === PlacementTest::STATUS_PUBLISHED && $test->is_current) {
            return;
        }

        if ($test === null) {
            $test = PublishPlacementTest::createDraft(self::VERSION);
        }

        $existing = PlacementQuestion::where('test_id', $test->id)->count();
        if ($existing === 0) {
            foreach (self::items() as $index => $item) {
                PublishPlacementTest::addQuestion(
                    $test->fresh(),
                    $index + 1,
                    $item['prompt'],
                    $item['options'],
                    $item['answer'],
                );
            }
        } elseif ($existing !== count(self::items())) {
            throw new \RuntimeException(
                'Placement version ['.self::VERSION.'] already has '.$existing.' questions; expected '.count(self::items()).'.'
            );
        }

        PublishPlacementTest::publish($test->fresh());
    }
}
