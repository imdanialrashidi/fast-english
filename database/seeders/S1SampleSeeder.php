<?php

namespace Database\Seeders;

use App\Models\Lesson;
use App\Models\Topic;
use App\Support\TopicCover;
use App\Support\TopicLicense;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * S1 fixture seeder: one public sample topic with two levels (A2 + B1) and
 * one premium topic with a single published B1 lesson.
 *
 * Every MP3 here is a locally generated sine-tone FIXTURE (see
 * database/seeders/fixtures/*-tone-fixture.mp3, made with ffmpeg and
 * measured with ffprobe). Fixture durations: A2 tone = 20 seconds at
 * 440 Hz, B1 tone = 30 seconds at 880 Hz. The two tones differ so a test
 * can detect an A2/B1 mix-up. Lesson texts are original sample prose
 * written for this slice (150-250 words each), not third-party articles.
 *
 * Never runs in production: fixture seeds must not create production data.
 */
class S1SampleSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new \RuntimeException('S1SampleSeeder refuses to run in production.');
        }

        $sample = Topic::updateOrCreate(
            ['slug' => 'city-park'],
            [
                'title_en' => 'The City Park',
                'summary_public' => 'A short story about a Saturday morning in the city park, told at two levels.',
                'cover_path' => TopicCover::generate('city-park'),
                'source_note' => TopicLicense::generatedRecord('city-park'),
                'status' => 'published',
                'published_at' => now(),
            ]
        );

        $this->seedLesson($sample, 'A2', 'The City Park', $this->a2Body(), 's1-a2-tone-fixture.mp3', 20, 3, true);
        $this->seedLesson($sample, 'B1', 'The City Park', $this->b1Body(), 's1-b1-tone-fixture.mp3', 30, 4, true);
        $premium = Topic::updateOrCreate(
            ['slug' => 'night-trains'],
            [
                'title_en' => 'Night Trains',
                'summary_public' => 'A B1 story about an overnight train journey. Full text requires a subscription.',
                'cover_path' => TopicCover::generate('night-trains'),
                'source_note' => TopicLicense::generatedRecord('night-trains'),
                'status' => 'published',
                'published_at' => now(),
            ]
        );

        $this->seedLesson($premium, 'B1', 'Night Trains', $this->premiumB1Body(), 's1-b1-tone-fixture.mp3', 30, 4, false);
    }

    private function seedLesson(
        Topic $topic,
        string $level,
        string $titleEn,
        string $bodyEn,
        string $fixtureFile,
        int $durationSeconds,
        int $estimatedMinutes,
        bool $isPublicSample,
    ): void {
        $audioPath = "lessons/s1-{$topic->slug}-".strtolower($level).'.mp3';
        Storage::disk('local')->makeDirectory('lessons');
        copy(
            database_path("seeders/fixtures/{$fixtureFile}"),
            Storage::disk('local')->path($audioPath)
        );

        Lesson::updateOrCreate(
            ['topic_id' => $topic->id, 'level' => $level],
            [
                'title_en' => $titleEn,
                'body_en' => $bodyEn,
                'audio_path' => $audioPath,
                'audio_revision' => 1,
                'duration_seconds' => $durationSeconds,
                'estimated_minutes' => $estimatedMinutes,
                'is_public_sample' => $isPublicSample,
                'status' => 'published',
            ]
        );
    }

    private function a2Body(): string
    {
        return <<<'TEXT'
        On Saturday morning, Sara walks to the city park near her home. The air is cool, and the streets are quiet. She carries a small bag with bread, cheese, and a bottle of water. She likes this quiet time before the busy day starts.

        The park is green and full of life. An old man feeds white birds near the small lake. Two children run after a red ball, and their mother watches them from a wooden bench. Sara sits under a tall tree and eats her breakfast slowly. The birds sing, and a soft wind moves the green leaves above her head.

        After one hour, she walks around the lake. The water is clean, and she can see small fish near the stones. She says hello to the old man, and he smiles at her. They talk about the warm weather for a few minutes. Then she walks home with a happy heart and plans to come back next week.
        TEXT;
    }

    private function b1Body(): string
    {
        return <<<'TEXT'
        Sara loves Saturday mornings because the city park belongs to early walkers, runners, and quiet readers before the crowds arrive. She leaves home at eight, carrying bread, cheese, and water, and takes the long path through the side streets so she can enjoy the cool air and the smell of fresh bread from the corner bakery.

        By the time she reaches the lake, the park is already awake. An old man she often sees there is feeding the white birds, while two children chase a red ball across the grass under their mother's watchful eyes. Sara chooses her usual bench under the tall tree, where the light falls softly through the leaves, and eats her breakfast without hurry, listening to the distant sound of the city waking up.

        Although she has visited this park a hundred times, she still notices something new on every walk: small fish hiding near the stones, a flower that opened overnight, a stranger's friendly smile. After a full round of the lake, she heads home feeling calm and ready for the busy week ahead, already looking forward to next Saturday.
        TEXT;
    }

    private function premiumB1Body(): string
    {
        return <<<'TEXT'
        The night train left the station at eleven, and Leila watched the city lights grow thin behind the window. She shared the small sleeping car with an elderly woman who offered her tea from a metal cup and asked where she was going with such a large suitcase.

        Leila explained that she was travelling to her brother's wedding in the north, a journey of almost nine hours through mountains and quiet villages. The rhythmic sound of the wheels soon mixed with the quiet voices of other passengers, and the gentle movement of the train made her feel strangely safe, like a child in a moving cradle.

        When she woke up, pale morning light was filling the car, and green hills were passing slowly outside. The elderly woman was gone, but a small paper bag of dates waited on her seat with a short note of good wishes. Leila smiled, realising that some journeys give you far more than just a destination.
        TEXT;
    }
}
