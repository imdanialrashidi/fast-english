<?php

namespace App\Support;

use Illuminate\Support\Facades\File;
use RuntimeException;

/**
 * One owner for the public-asset allowlist (scope §18.1).
 *
 * `resources/public-assets.json` is the single list: Vite reads its
 * `viteInputs` array through `vite.config.js`, and the service worker
 * reads the same entries filtered by `precache` plus `staticPrecache`.
 *
 * Renaming an entry cannot silently drop a built file from the precache:
 * a `precache: true` entry that is missing from the Vite manifest throws
 * instead of producing an offline shell with no JS/CSS. The server
 * stylesheet (`app.css`) stays a Vite input with `precache: false`.
 */
final class PublicAssets
{
    /**
     * @return array{
     *   viteInputs: list<array{path: string, precache: bool}>,
     *   staticPrecache: list<string>
     * }
     */
    public static function allowlist(): array
    {
        $decoded = json_decode((string) File::get(resource_path('public-assets.json')), true);
        if (! is_array($decoded)
            || ! is_array($decoded['viteInputs'] ?? null)
            || ! is_array($decoded['staticPrecache'] ?? null)) {
            throw new RuntimeException('resources/public-assets.json is missing or malformed.');
        }

        $inputs = [];
        foreach ($decoded['viteInputs'] as $entry) {
            if (! is_array($entry) || ! is_string($entry['path'] ?? null) || ! is_bool($entry['precache'] ?? null)) {
                throw new RuntimeException('resources/public-assets.json has an invalid viteInputs entry.');
            }
            $inputs[] = ['path' => $entry['path'], 'precache' => $entry['precache']];
        }

        $static = [];
        foreach ($decoded['staticPrecache'] as $entry) {
            if (! is_string($entry) || $entry === '') {
                throw new RuntimeException('resources/public-assets.json has an invalid staticPrecache entry.');
            }
            $static[] = $entry;
        }

        return ['viteInputs' => $inputs, 'staticPrecache' => $static];
    }

    /**
     * The service-worker precache: static public entries plus the built
     * files of every `precache: true` Vite input.
     *
     * @return list<string>
     */
    public static function precache(): array
    {
        $allowlist = self::allowlist();
        $paths = $allowlist['staticPrecache'];

        $manifestPath = public_path('build/manifest.json');
        if (! is_file($manifestPath)) {
            return array_values(array_unique($paths));
        }

        $manifest = json_decode((string) File::get($manifestPath), true);
        if (! is_array($manifest)) {
            throw new RuntimeException('The Vite build manifest is malformed.');
        }

        foreach ($allowlist['viteInputs'] as $entry) {
            if ($entry['precache'] !== true) {
                continue;
            }

            $built = $manifest[$entry['path']] ?? null;
            if (! is_array($built) || ! is_string($built['file'] ?? null)) {
                throw new RuntimeException("Public asset [{$entry['path']}] is missing from the Vite build manifest.");
            }

            $paths[] = '/build/'.$built['file'];
            foreach ($built['css'] ?? [] as $css) {
                if (is_string($css)) {
                    $paths[] = '/build/'.$css;
                }
            }
        }

        return array_values(array_unique($paths));
    }
}
