<?php

use Illuminate\Support\Arr;
use Tests\Support\ContentFixtures;

/**
 * Owner instruction 2026-10-25: a learner must never see a framework
 * English message. The product locale is Persian (APP_LOCALE=fa in
 * .env.example; config/app.php defaults to fa); these tests pin the
 * translation files and the JSON error shape the React handlers display.
 */
test('login validation and wrong credentials are Persian', function () {
    app()->setLocale('fa');

    $missing = $this->postJson(route('login.store'), [])->assertStatus(422);
    $errors = Arr::flatten((array) $missing->json('errors'));
    expect($errors)->not->toBeEmpty();
    foreach ($errors as $message) {
        expect((string) $message)->toMatch('/\p{Arabic}/u');
    }

    $this->postJson(route('login.store'), [
        'email' => 'nobody@example.com',
        'password' => 'wrong-password',
    ])->assertStatus(422)
        ->assertJsonPath('message', 'ایمیل یا رمز عبور اشتباه است.');
});

test('expired session json says so in Persian', function () {
    app()->setLocale('fa');

    $this->postJson(route('words.store'), [])
        ->assertStatus(401)
        ->assertJsonPath('message', 'نشست شما پایان یافته است. دوباره وارد شوید.');
});

test('learner validation failures return the first Persian message', function () {
    app()->setLocale('fa');
    $student = ContentFixtures::subscribedStudent();

    $this->actingAs($student)
        ->postJson(route('words.store'), [])
        ->assertStatus(422)
        ->assertJsonPath('message', 'واژه الزامی است.');
});
