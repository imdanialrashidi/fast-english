<?php

namespace App\Http\Responses;

/**
 * Privacy headers (scope §16): the single spelling of the private,
 * no-store reply shared by every JSON mutation, media route, and locked
 * page. Replaces the per-controller `noStore()` copies.
 */
final class NoStore
{
    /** @return array<string, string> */
    public static function headers(): array
    {
        return ['Cache-Control' => 'private, no-store'];
    }
}
