<?php

// Permanent light only (owner-approved ADR-0002; see docs/DESIGN.md):
// every server-surface text pair reuses the canonical light tokens at
// or above 4.5:1 (WCAG 2.2 AA normal text). The dark :root[data-theme]
// block was retired with the migration — this test parses the single
// :root block in resources/css/app.css, recomputes relative luminance,
// and locks the pairs. The Inertia learner surface owns its own exact
// palette in resources/css/inertia.css (locked by M0InertiaFoundationTest).

function s3Luminance(string $hex): float
{
    $hex = ltrim($hex, '#');
    $channels = array_map(
        fn ($c) => hexdec($c) / 255,
        [substr($hex, 0, 2), substr($hex, 2, 2), substr($hex, 4, 2)]
    );

    $linear = array_map(
        fn ($c) => $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4,
        $channels
    );

    return 0.2126 * $linear[0] + 0.7152 * $linear[1] + 0.0722 * $linear[2];
}

function s3Contrast(string $a, string $b): float
{
    $lighter = max(s3Luminance($a), s3Luminance($b));
    $darker = min(s3Luminance($a), s3Luminance($b));

    return round(($lighter + 0.05) / ($darker + 0.05), 2);
}

function s3ThemeTokens(string $css, string $theme): array
{
    // Permanent light only (ADR-0002): the single plain :root block owns
    // every value. Any :root[data-theme] block is a dark-resurrection
    // regression and parses as absent here.
    if ($theme !== 'light') {
        return [];
    }
    $pattern = '/:root\\s*\\{(.*?)\\}/s';
    if (! preg_match($pattern, $css, $match)) {
        return [];
    }

    preg_match_all('/--fe-([a-z-]+):\s*(#[0-9a-fA-F]{6})/', $match[0], $matches, PREG_SET_ORDER);
    $tokens = [];
    foreach ($matches as $m) {
        $tokens[$m[1]] = strtolower($m[2]);
    }

    return $tokens;
}

test('learner text pairs measure at or above 4.5 to 1 in the permanent light theme', function () {
    $css = (string) file_get_contents(resource_path('css/app.css'));

    $pairs = [
        'text on canvas' => ['text', 'canvas'],
        'muted text on canvas' => ['muted-text', 'canvas'],
        'text on surface' => ['text', 'surface'],
        'muted text on surface' => ['muted-text', 'surface'],
        'on-primary on primary' => ['on-primary', 'primary'],
        'on-primary on primary-hover' => ['on-primary', 'primary-hover'],
        'on-accent on accent' => ['on-accent', 'accent'],
        'on-secondary on secondary' => ['on-secondary', 'secondary'],
        'text on tint-lavender' => ['text', 'tint-lavender'],
        'success on surface' => ['success', 'surface'],
        'danger on surface' => ['danger', 'surface'],
    ];

    foreach (['light'] as $theme) {
        $tokens = s3ThemeTokens($css, $theme);
        expect($tokens)->not->toBeEmpty('missing plain :root token block');

        // The owner base colors must stay exactly as approved (light only).
        $owner = ['text' => '#172238', 'canvas' => '#f7f5ef', 'primary' => '#4263eb', 'secondary' => '#dde5fb', 'accent' => '#e9ac52'];
        foreach ($owner as $token => $hex) {
            expect($tokens)->toHaveKey($token);
            expect($tokens[$token])->toBe($hex, "[{$theme}] --fe-{$token} must stay owner-approved {$hex}");
        }

        foreach ($pairs as $label => [$fg, $bg]) {
            expect($tokens)->toHaveKey($fg)->toHaveKey($bg);
            $ratio = s3Contrast($tokens[$fg], $tokens[$bg]);
            fwrite(STDERR, "\n[S3 contrast] [{$theme}] {$label}: {$ratio}:1");
            expect($ratio)->toBeGreaterThanOrEqual(4.5, "[{$theme}] {$label} measured {$ratio}:1");
        }
    }
});

test('learner control and focus pairs measure at or above 3 to 1 in the permanent light theme', function () {
    $css = (string) file_get_contents(resource_path('css/app.css'));

    $pairs = [
        'input-border on surface' => ['input-border', 'surface'],
        'text on surface (text/surface legibility)' => ['text', 'surface'],
        'primary on surface (focus ring)' => ['primary', 'surface'],
    ];

    foreach (['light'] as $theme) {
        $tokens = s3ThemeTokens($css, $theme);
        expect($tokens)->not->toBeEmpty();

        foreach ($pairs as $label => [$fg, $bg]) {
            expect($tokens)->toHaveKey($fg)->toHaveKey($bg);
            $ratio = s3Contrast($tokens[$fg], $tokens[$bg]);
            fwrite(STDERR, "\n[S3 control] [{$theme}] {$label}: {$ratio}:1");
            expect($ratio)->toBeGreaterThanOrEqual(3.0, "[{$theme}] {$label} measured {$ratio}:1");
        }
    }
});

test('no color literal lives outside the token blocks', function () {
    $css = (string) file_get_contents(resource_path('css/app.css'));

    // Permanent light only (ADR-0002): any theme-attribute block is a
    // dark-resurrection regression.
    expect($css)->not->toContain('[data-theme');

    $rest = $css;
    // Strip every :root...{...} token block (themed + fallback).
    $rest = (string) preg_replace('/:root(\[data-theme=\'[a-z]+\'\])?\s*\{.*?\}/s', '', $rest);
    $rest = (string) preg_replace('/\/\*.*?\*\//s', '', $rest);

    expect($rest)->not->toMatch('/#[0-9a-fA-F]{3,8}\b/');
});
