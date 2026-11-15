<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Flashcard scheduler (two-grade SM-2, Anki-style learning steps)
    |--------------------------------------------------------------------------
    |
    | The child/adult only answers "I knew it" (good) or "I did not" (again).
    | New cards walk the learning steps, a review card that lapses drops its
    | ease and enters relearning, and a review card that graduates grows by
    | its current ease. Values are intentionally conservative for a book
    | vocabulary deck; the deck row may override the UI reveal delay.
    |
    */

    'scheduler' => [
        'learning_steps_minutes' => [1, 10],
        'lapse_steps_minutes' => [10],
        'graduating_interval_days' => 1,
        'lapse_interval_days' => 1,
        'minimum_ease' => 1.3,
        'maximum_ease' => 3.0,
        'ease_penalty' => 0.2,
        'max_interval_days' => 180,
    ],

    // One daily review session is capped so a returning learner with a
    // backlog is never buried. Unit sessions are the new-card path and are
    // not capped (a unit is 20–25 cards).
    'daily_review_limit' => 100,

    'reveal_delay_ms' => 3000,

    // Import-time image preparation. AEF front artwork is a 1080×1440 page
    // with book chrome; the crop keeps the inner card square only.
    'images' => [
        'size' => 1000,
        'crop' => [70, 170, 940, 940],
        'quality' => 88,
        'cover_width' => 1200,
        'cover_height' => 900,
    ],

];
