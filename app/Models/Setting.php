<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Owner-editable operational settings (contact channels and legal copy).
 * Defaults live in `config/site.php`, so a missing row never blanks a
 * public page.
 *
 * Reads are resolved once per HTTP request, not cached across requests:
 * staff changes must take effect on the next request. Queue workers and
 * console commands bypass the request cache because their process outlives
 * one request.
 */
class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    public static function read(string $key, ?string $default = null): ?string
    {
        $request = app()->bound('request') ? app('request') : null;
        // A queue worker keeps one process (and one dummy request) alive
        // across jobs, so it must read fresh. Tests are allowed to use the
        // request-bound cache so the HTTP query budget is measurable.
        $memoize = $request !== null
            && (! app()->runningInConsole() || app()->runningUnitTests());

        if ($memoize) {
            if (! $request->attributes->has('fe.settings')) {
                $request->attributes->set(
                    'fe.settings',
                    static::query()->pluck('value', 'key')->all(),
                );
            }

            $value = $request->attributes->get('fe.settings')[$key] ?? null;
        } else {
            $value = static::query()->where('key', $key)->value('value');
        }

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
        $value = $value === null || $value === '' ? null : $value;

        static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value],
        );

        if (! app()->bound('request')) {
            return;
        }

        $request = app('request');

        // Only update a map that was already loaded; a write alone must not
        // pay for all settings rows.
        if (! $request->attributes->has('fe.settings')) {
            return;
        }

        $values = $request->attributes->get('fe.settings');
        $values[$key] = $value;
        $request->attributes->set('fe.settings', $values);
    }
}
