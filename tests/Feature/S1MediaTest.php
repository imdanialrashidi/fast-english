<?php

use App\Models\Lesson;
use Database\Seeders\S1SampleSeeder;
use Tests\Support\ContentFixtures;

// S1-4 route parts: real MP3 over HTTP with Range semantics.
beforeEach(function () {
    $this->seed(S1SampleSeeder::class);
    $this->actingAs(ContentFixtures::subscribedStudent());
    $this->lesson = Lesson::where('level', 'A2')
        ->whereHas('topic', fn ($q) => $q->where('slug', 'city-park'))
        ->firstOrFail();
});

test('audio route returns 200 with Accept-Ranges and private no-store', function () {
    $response = $this->get(route('media.lesson.audio', $this->lesson));

    $response->assertOk();
    expect($response->headers->get('Accept-Ranges'))->toBe('bytes');
    expect($response->headers->get('Content-Type'))->toContain('audio/mpeg');
    expect($response->headers->get('Cache-Control'))->toContain('no-store');
    expect((int) $response->headers->get('Content-Length'))->toBe(160539);
});

test('valid Range returns 206 with the correct Content-Range', function () {
    $response = $this->get(
        route('media.lesson.audio', $this->lesson),
        ['Range' => 'bytes=0-99']
    );

    $response->assertStatus(206);
    expect($response->headers->get('Content-Range'))->toBe('bytes 0-99/160539');
    expect($response->headers->get('Content-Length'))->toBe('100');
});

test('out-of-range Range returns 416', function () {
    $response = $this->get(
        route('media.lesson.audio', $this->lesson),
        ['Range' => 'bytes=99999999-']
    );

    $response->assertStatus(416);
    expect($response->headers->get('Content-Range'))->toBe('bytes */160539');
});

test('suffix Range returns the trailing bytes with 206', function () {
    $response = $this->get(
        route('media.lesson.audio', $this->lesson),
        ['Range' => 'bytes=-100']
    );

    $response->assertStatus(206);
    expect($response->headers->get('Content-Range'))->toBe('bytes 160439-160538/160539');
});

test('HEAD returns headers with an empty body', function () {
    $response = $this->call('HEAD', route('media.lesson.audio', $this->lesson));

    $response->assertOk();
    expect($response->headers->get('Accept-Ranges'))->toBe('bytes');
    expect($response->headers->get('Content-Length'))->toBe('160539');
    expect($response->getContent())->toBeEmpty();
});
