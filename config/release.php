<?php

// S8 download page (scope §18.2): release metadata.
//
// The `artifact` block is the one source of truth for the signed build
// committed at public/downloads/fast-english-1.0.0.apk. The public
// metadata below it applies only when APP_ENV=production; testing/staging
// keep the «هنوز منتشر نشده» state so the download/browser lanes and their
// unpublished proofs stay meaningful. A real environment variable always
// wins, so a staging host can opt in without editing this file.
//
// Never invent a version, versionCode, date, size, or SHA-256 here. Update
// the artifact block from a measured build (see mobile/README.md), keep the
// file URL pointing at a file that is actually shipped, and let
// ReleaseArtifactTest verify size + digest together.

$artifact = [
    'version_name' => '1.0.0',
    'version_code' => '1',
    'release_date' => '2026-10-28',
    'size_bytes' => '1144598',
    'sha256' => '977e5243b7db6af28667990064e9cf8f2e8fda733d9870950177fff6c388d28b',
    'file_url' => '/downloads/fast-english-1.0.0.apk',
];

$production = env('APP_ENV') === 'production';

return [
    'artifact' => $artifact,

    'version_name' => env('RELEASE_VERSION_NAME') ?: ($production ? $artifact['version_name'] : null),

    'version_code' => env('RELEASE_VERSION_CODE') ?: ($production ? $artifact['version_code'] : null),

    'release_date' => env('RELEASE_DATE') ?: ($production ? $artifact['release_date'] : null),

    'size_bytes' => env('RELEASE_SIZE_BYTES') ?: ($production ? $artifact['size_bytes'] : null),

    'sha256' => env('RELEASE_SHA256') ?: ($production ? $artifact['sha256'] : null),

    'file_url' => env('RELEASE_FILE_URL') ?: ($production ? $artifact['file_url'] : null),
];
