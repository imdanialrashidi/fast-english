<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Owner-editable operational settings (contact channels, legal copy,
 * payment gateway metadata, card fallback). Defaults live in
 * `config/site.php`, so a missing row never blanks a public page.
 *
 * Reads are uncached on purpose: staff changes must take effect on the
 * next request, and the volume is one small row per key.
 */
class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    public static function read(string $key, ?string $default = null): ?string
    {
        $value = static::query()->where('key', $key)->value('value');

        return $value === null ? $default : (string) $value;
    }

    public static function flag(string $key, bool $default = false): bool
    {
        $value = static::read($key);

        if ($value === null || $value === '') {
            return $default;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    public static function put(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value === null || $value === '' ? null : $value],
        );
    }
}
