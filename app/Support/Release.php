<?php

namespace App\Support;

/**
 * Release metadata (scope §18.2). One owner for the "is there a real
 * published APK?" question so the landing never makes the download page
 * its primary conversion while /download still says «هنوز منتشر نشده».
 *
 * Values come only from config/release.php (env). Nothing is invented;
 * partial metadata keeps the unpublished state.
 */
final class Release
{
    /** @return array{version_name: string|null, version_code: string|null, release_date: string|null, size_bytes: string|null, sha256: string|null, file_url: string|null} */
    public static function metadata(): array
    {
        return [
            'version_name' => config('release.version_name'),
            'version_code' => config('release.version_code'),
            'release_date' => config('release.release_date'),
            'size_bytes' => config('release.size_bytes'),
            'sha256' => config('release.sha256'),
            'file_url' => config('release.file_url'),
        ];
    }

    public static function published(): bool
    {
        $release = self::metadata();

        $complete = collect($release)->except('file_url')->filter(
            fn ($value): bool => $value !== null && trim((string) $value) !== ''
        )->count() === 5;
        $url = $release['file_url'];

        return $complete && $url !== null && trim((string) $url) !== '';
    }
}
