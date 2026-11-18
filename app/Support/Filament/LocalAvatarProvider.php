<?php

namespace App\Support\Filament;

use Filament\AvatarProviders\Contracts\AvatarProvider;
use Filament\Facades\Filament;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;

/**
 * Local initials avatar: the panel never calls ui-avatars.com (or any other
 * third party) just to draw a staff name. The SVG is a data URI, so the CSP
 * needs no external image host and the name never leaves the server.
 */
class LocalAvatarProvider implements AvatarProvider
{
    public function get(Model|Authenticatable $record): string
    {
        $name = trim((string) Filament::getNameForDefaultAvatar($record));
        $initials = collect(preg_split('/\s+/u', $name) ?: [])
            ->filter()
            ->take(2)
            ->map(fn (string $part): string => mb_substr($part, 0, 1))
            ->implode(' ');

        if ($initials === '') {
            $initials = 'FE';
        }

        $safe = htmlspecialchars($initials, ENT_QUOTES | ENT_XML1, 'UTF-8');
        $svg = sprintf(
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
            .'<rect width="64" height="64" rx="32" fill="#101B33"/>'
            .'<text x="32" y="41" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#FFFFFF">%s</text>'
            .'</svg>',
            $safe,
        );

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }
}
