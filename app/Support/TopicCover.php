<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

/**
 * D4 deterministic cover generator (scope §9.4, owner direction 2026-10-10).
 *
 * Every published topic shows a real cover, never an empty placeholder:
 * the default is an abstract cover rendered server-side with GD,
 * deterministic from the topic slug, with no text baked into the image.
 * Staff may upload licensed photos (JPEG/PNG/WebP, EXIF stripped via
 * CoverImage::reencode); each upload needs a license record
 * (source + license name + date checked + usage notes) enforced through
 * TopicLicense::problem() and the publish gate. No image is ever fetched
 * from a third-party API at runtime.
 *
 * Palette follows the modern hybrid system (ivory/navy/blue/amber +
 * derived tints); no text functions are used here by design.
 *
 * Layouts: six deterministic variants from the slug hash (0–5), so the
 * library never looks like one repeated blob. Variant shapes differ;
 * positions/sizes within a variant derive from the seeded RNG only.
 */
final class TopicCover
{
    public const WIDTH = 800;

    public const HEIGHT = 450;

    public const VARIANTS = 6;

    /**
     * Public URL for a stored cover path, or null when no cover exists.
     * One spelling of the `/storage/` rule for every payload module.
     */
    public static function url(?string $path): ?string
    {
        return $path !== null && $path !== '' ? '/storage/'.$path : null;
    }

    /**
     * Deterministic layout variant for a slug (0–5).
     */
    public static function variant(string $slug): int
    {
        $safe = self::safe($slug);
        // sprintf %u gives the unsigned crc32 on every platform.
        $unsigned = (int) sprintf('%u', crc32($safe));

        return $unsigned % self::VARIANTS;
    }

    /**
     * Generate (or regenerate) the deterministic abstract cover for a slug.
     * Returns the public-disk relative path (covers/gd-{slug}.jpg).
     */
    public static function generate(string $slug): string
    {
        $safe = self::safe($slug);
        $path = "covers/gd-{$safe}.jpg";

        Storage::disk('public')->makeDirectory('covers');
        $absolute = Storage::disk('public')->path($path);

        // Deterministic seed from slug (crc32 is stable across runs).
        $seed = crc32($safe);
        mt_srand($seed);

        $img = imagecreatetruecolor(self::WIDTH, self::HEIGHT);
        if ($img === false) {
            throw new \RuntimeException('GD could not create the cover canvas.');
        }

        try {
            $ivory = self::alloc($img, '#F7F5EF');
            $navy = self::alloc($img, '#172238');
            $blue = self::alloc($img, '#4263EB');
            $amber = self::alloc($img, '#E9AC52');
            $tintBlue = self::alloc($img, '#DDE5FB');
            $tintWarm = self::alloc($img, '#EDE8D6');

            imagefilledrectangle($img, 0, 0, self::WIDTH, self::HEIGHT, $ivory);

            $variant = self::variant($safe);
            $palette = [$blue, $navy, $tintBlue, $tintWarm, $amber];

            match ($variant) {
                // 0 — diagonal bands + orbits (editorial calm default).
                0 => self::paintBands($img, [$tintWarm, $tintBlue, $navy]),
                // 1 — horizon: stacked horizontal fields + amber sun disc.
                1 => self::paintHorizon($img, $tintWarm, $tintBlue, $navy, $amber),
                // 2 — orbits: large overlapping discs on a navy field edge.
                2 => self::paintOrbits($img, $navy, $palette),
                // 3 — pillars: vertical reading spines + dot rhythm.
                3 => self::paintPillars($img, $palette),
                // 4 — diamonds: rotated slabs + one amber bar.
                4 => self::paintDiamonds($img, $palette, $amber),
                // 5 — dots: quiet dot grid over a warm wash + navy arc.
                default => self::paintDots($img, $tintWarm, $tintBlue, $navy, $blue, $amber),
            };

            // Soft frame: navy border (2px) for editorial calm.
            imagerectangle($img, 0, 0, self::WIDTH - 1, self::HEIGHT - 1, $navy);
            imagerectangle($img, 1, 1, self::WIDTH - 2, self::HEIGHT - 2, $navy);

            // NOTE: no baked-text APIs here by design — covers
            // never carry baked text (titles render in HTML).
            imagejpeg($img, $absolute, 85);
        } finally {
            imagedestroy($img);
            // Reset RNG so cover generation never leaks determinism into
            // unrelated random flows (ids, tokens).
            mt_srand();
        }

        // Re-encode through the same pipeline as uploads (strips metadata).
        CoverImage::reencode($path);

        return $path;
    }

    private static function safe(string $slug): string
    {
        $slug = trim($slug) === '' ? 'untitled' : $slug;
        $safe = preg_replace('/[^a-z0-9-]+/', '-', strtolower($slug)) ?? 'untitled';

        return trim($safe, '-') === '' ? 'untitled' : trim($safe, '-');
    }

    /** @param list<int> $bands */
    private static function paintBands($img, array $bands): void
    {
        for ($i = 0; $i < 3; $i++) {
            $y = mt_rand(0, self::HEIGHT - 120);
            $h = mt_rand(60, 140);
            $color = $bands[$i % count($bands)];
            $slant = mt_rand(40, 120);
            $pts = [0, $y + $slant, self::WIDTH, $y, self::WIDTH, $y + $h, 0, $y + $h + $slant];
            imagefilledpolygon($img, $pts, $color);
        }
        $colors = $bands;
        for ($i = 0; $i < 3; $i++) {
            $cx = mt_rand(60, self::WIDTH - 60);
            $cy = mt_rand(60, self::HEIGHT - 60);
            imagefilledellipse($img, $cx, $cy, mt_rand(100, 340), mt_rand(80, 260), $colors[mt_rand(0, count($colors) - 1)]);
        }
        $barY = mt_rand(20, self::HEIGHT - 60);
        imagefilledrectangle($img, 0, $barY, self::WIDTH, $barY + 14, self::alloc($img, '#E9AC52'));
    }

    private static function paintHorizon($img, int $warm, int $tintBlue, int $navy, int $amber): void
    {
        $h1 = mt_rand(120, 200);
        $h2 = mt_rand(220, 320);
        imagefilledrectangle($img, 0, 0, self::WIDTH, $h1, $warm);
        imagefilledrectangle($img, 0, $h1, self::WIDTH, $h2, $tintBlue);
        imagefilledrectangle($img, 0, $h2, self::WIDTH, self::HEIGHT, $navy);
        // Amber sun disc sitting on the horizon line.
        $cx = mt_rand(120, self::WIDTH - 120);
        $d = mt_rand(120, 200);
        imagefilledellipse($img, $cx, $h2, $d, $d, $amber);
        // Thin ivory horizon line.
        imagefilledrectangle($img, 0, $h2 - 2, self::WIDTH, $h2 + 2, self::alloc($img, '#F7F5EF'));
    }

    /** @param list<int> $palette */
    private static function paintOrbits($img, int $navy, array $palette): void
    {
        // Navy field on one side, discs overlapping the edge.
        $edge = mt_rand(420, 560);
        imagefilledrectangle($img, $edge, 0, self::WIDTH, self::HEIGHT, $navy);
        for ($i = 0; $i < 4; $i++) {
            $cx = mt_rand((int) ($edge - 160), self::WIDTH - 60);
            $cy = mt_rand(60, self::HEIGHT - 60);
            imagefilledellipse($img, $cx, $cy, mt_rand(140, 360), mt_rand(120, 300), $palette[mt_rand(0, count($palette) - 1)]);
        }
        imagefilledrectangle($img, 0, mt_rand(20, self::HEIGHT - 40), (int) ($edge - 40), mt_rand(30, 44) + 20, self::alloc($img, '#E9AC52'));
    }

    /** @param list<int> $palette */
    private static function paintPillars($img, array $palette): void
    {
        $x = 40;
        while ($x < self::WIDTH - 40) {
            $w = mt_rand(36, 90);
            $color = $palette[mt_rand(0, count($palette) - 1)];
            imagefilledrectangle($img, $x, mt_rand(0, 60), $x + $w, self::HEIGHT - mt_rand(0, 60), $color);
            $x += $w + mt_rand(18, 60);
        }
        // Dot rhythm along the bottom.
        for ($dx = 60; $dx < self::WIDTH - 40; $dx += 64) {
            imagefilledellipse($img, $dx, self::HEIGHT - 30, 16, 16, self::alloc($img, '#172238'));
        }
    }

    /** @param list<int> $palette */
    private static function paintDiamonds($img, array $palette, int $amber): void
    {
        for ($i = 0; $i < 3; $i++) {
            $cx = mt_rand(140, self::WIDTH - 140);
            $cy = mt_rand(100, self::HEIGHT - 100);
            $rx = mt_rand(90, 200);
            $ry = mt_rand(60, 140);
            $pts = [$cx, $cy - $ry, $cx + $rx, $cy, $cx, $cy + $ry, $cx - $rx, $cy];
            imagefilledpolygon($img, $pts, $palette[mt_rand(0, count($palette) - 1)]);
        }
        imagefilledrectangle($img, 0, mt_rand(30, self::HEIGHT - 50), self::WIDTH, mt_rand(44, 58) + 30, $amber);
    }

    private static function paintDots($img, int $warm, int $tintBlue, int $navy, int $blue, int $amber): void
    {
        imagefilledrectangle($img, 0, 0, self::WIDTH, (int) (self::HEIGHT * 0.55), $warm);
        imagefilledrectangle($img, 0, (int) (self::HEIGHT * 0.55), self::WIDTH, self::HEIGHT, $tintBlue);
        for ($gy = 50; $gy < self::HEIGHT - 30; $gy += 56) {
            for ($gx = 50; $gx < self::WIDTH - 30; $gx += 56) {
                $r = mt_rand(4, 10);
                $color = (mt_rand(0, 9) === 0) ? $amber : ((mt_rand(0, 1) === 0) ? $navy : $blue);
                imagefilledellipse($img, $gx + mt_rand(-8, 8), $gy + mt_rand(-8, 8), $r * 2, $r * 2, $color);
            }
        }
        // One navy arc band across the wash.
        $cy = mt_rand(80, 200);
        imagefilledellipse($img, (int) (self::WIDTH / 2), $cy, 700, 220, $navy);
        imagefilledellipse($img, (int) (self::WIDTH / 2), $cy - 34, 640, 160, $warm);
    }

    /** @return int GD color identifier */
    private static function alloc($img, string $hex): int
    {
        $hex = ltrim($hex, '#');
        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));
        $color = imagecolorallocate($img, $r, $g, $b);
        if ($color === false) {
            throw new \RuntimeException("GD could not allocate {$hex}.");
        }

        return $color;
    }
}
