<?php

namespace Database\Factories;

use App\Models\TedTalk;
use App\Models\Topic;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Storage;

/**
 * @extends Factory<TedTalk>
 *
 * Audio always points at a real MP3 on the private disk so the media route
 * test exercises the same range/file behaviour as production.
 */
class TedTalkFactory extends Factory
{
    protected $model = TedTalk::class;

    public function definition(): array
    {
        return [
            'topic_id' => Topic::factory(),
            'slug' => fake()->unique()->slug(4),
            'title_en' => fake()->sentence(5),
            'speaker' => fake()->name(),
            'area' => 'politics',
            'duration_seconds' => 640,
            'audio_path' => 'ted/test-'.fake()->unique()->uuid().'.mp3',
            'audio_revision' => 1,
            'cover_path' => null,
            'segments' => [
                [
                    ['t' => 0, 'text' => 'This is the first sentence of the talk.'],
                    ['t' => 5200, 'text' => 'And this is the second sentence.'],
                ],
            ],
            'words' => [
                ['word' => 'tariff', 'en' => 'a tax on imported goods', 'fa' => 'تعرفه'],
                ['word' => 'backfire', 'en' => 'to have the opposite effect', 'fa' => null],
            ],
            'source_url' => 'https://www.ted.com/talks/example',
            'source_license' => 'CC BY-NC-ND 4.0',
            'status' => 'published',
            'published_at' => now(),
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (TedTalk $talk) {
            $source = database_path('seeders/fixtures/s1-a2-tone-fixture.mp3');
            Storage::disk('local')->makeDirectory(dirname($talk->audio_path));
            copy($source, Storage::disk('local')->path($talk->audio_path));
        });
    }
}
