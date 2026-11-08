<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Bearer token for the agent content MCP server (owner request 2026-11-08).
 *
 * The plain token exists only in the `mcp:token issue` output; the database
 * stores its SHA-256 hash. A token is active only while it is neither
 * revoked nor expired; the route middleware additionally requires an
 * active staff owner. Abilities are additive so a read/write agent token
 * cannot publish unless it was issued with `content:publish`.
 */
#[Hidden(['token_hash'])]
class McpToken extends Model
{
    public const PREFIX = 'femcp_';

    public const ABILITY_READ = 'content:read';

    public const ABILITY_WRITE = 'content:write';

    public const ABILITY_PUBLISH = 'content:publish';

    /** @var list<string> */
    public const ABILITIES = [
        self::ABILITY_READ,
        self::ABILITY_WRITE,
        self::ABILITY_PUBLISH,
    ];

    protected $fillable = [
        'name',
        'token_hash',
        'user_id',
        'abilities',
        'last_used_at',
        'last_used_ip',
        'expires_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'abilities' => 'array',
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(?CarbonInterface $now = null): bool
    {
        if ($this->revoked_at !== null) {
            return false;
        }

        return $this->expires_at === null || $this->expires_at->greaterThan($now ?? now());
    }

    public function hasAbility(string $ability): bool
    {
        return in_array($ability, $this->abilities ?? [], true);
    }

    /**
     * Issue a token and return the model plus the one-time plain token.
     *
     * @param  list<string>  $abilities
     * @return array{0: self, 1: string}
     */
    public static function issue(User $user, string $name, array $abilities, ?CarbonInterface $expiresAt = null): array
    {
        $plain = self::PREFIX.bin2hex(random_bytes(32));

        $token = self::query()->create([
            'name' => trim($name),
            'token_hash' => hash('sha256', $plain),
            'user_id' => $user->id,
            'abilities' => array_values(array_unique($abilities)),
            'expires_at' => $expiresAt,
        ]);

        return [$token, $plain];
    }

    public static function findByPlainText(string $plain): ?self
    {
        if (! str_starts_with($plain, self::PREFIX) || strlen($plain) < 32) {
            return null;
        }

        return self::query()
            ->with('user')
            ->where('token_hash', hash('sha256', $plain))
            ->first();
    }

    /**
     * The token bound to the current MCP request by the route middleware.
     */
    public static function current(): ?self
    {
        if (! app()->bound('mcp.token')) {
            return null;
        }

        $token = app('mcp.token');

        return $token instanceof self ? $token : null;
    }
}
