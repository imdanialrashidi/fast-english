<?php

// The committed APK is the public artifact behind /download. Its measured
// values live in config/release.php::artifact; this test keeps the file and
// that metadata from drifting apart (a wrong SHA-256 is worse than no link).
test('the committed APK exists and matches the published artifact metadata', function () {
    $artifact = config('release.artifact');
    expect($artifact)->toBeArray();

    $path = public_path(ltrim((string) $artifact['file_url'], '/'));
    expect(is_file($path))->toBeTrue()
        ->and(filesize($path))->toBe((int) $artifact['size_bytes'])
        ->and(hash_file('sha256', $path))->toBe($artifact['sha256'])
        ->and($artifact['sha256'])->toMatch('/^[0-9a-f]{64}$/')
        ->and($artifact['file_url'])->toStartWith('/downloads/')
        ->and($artifact['file_url'])->toEndWith('.apk');
});
