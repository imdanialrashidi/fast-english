<?php

namespace App\Console\Commands;

use App\Models\McpToken;
use App\Models\User;
use App\Support\Entitlement;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Issue, list, or revoke content MCP bearer tokens (owner request 2026-11-08).
 *
 * Tokens are staff-only and are shown exactly once. The command is the
 * only issuance path, so production token creation requires server shell
 * access and leaves a named token record tied to a real staff account.
 */
class McpTokenCommand extends Command
{
    protected $signature = 'mcp:token
        {action=issue : issue|list|revoke}
        {--name= : Human label for the token (required when issuing)}
        {--email= : Active staff account that owns the token (required when issuing)}
        {--abilities= : Comma-separated abilities (default: content:read,content:write)}
        {--days= : Expiry in days, 1-365 (default from config)}
        {--id= : Token id to revoke}';

    protected $description = 'Manage bearer tokens for the agent content MCP server.';

    public function handle(): int
    {
        return match ((string) $this->argument('action')) {
            'issue' => $this->issue(),
            'list' => $this->listTokens(),
            'revoke' => $this->revoke(),
            default => $this->unknownAction(),
        };
    }

    private function issue(): int
    {
        $name = trim((string) $this->option('name'));
        $email = strtolower(trim((string) $this->option('email')));

        if ($name === '') {
            $this->error('The --name option is required when issuing a token.');

            return 1;
        }

        if (mb_strlen($name) > 120) {
            $this->error('The --name option must not exceed 120 characters.');

            return 1;
        }

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('A valid --email is required when issuing a token.');

            return 1;
        }

        $user = User::query()->whereRaw('lower(email) = ?', [$email])->first();

        if (! Entitlement::staff($user)) {
            $this->error('The token owner must be an active staff account.');

            return 1;
        }

        $abilities = $this->resolveAbilities();

        if ($abilities === null) {
            return 1;
        }

        $days = $this->resolveDays();

        if ($days === null) {
            return 1;
        }

        $expiresAt = $days > 0 ? Carbon::now()->addDays($days) : null;

        [$token, $plain] = McpToken::issue($user, $name, $abilities, $expiresAt);

        try {
            Log::info('mcp.token.issue', [
                'token_id' => $token->id,
                'name' => $token->name,
                'user_id' => $user->id,
                'abilities' => $abilities,
                'expires_at' => $expiresAt?->toIso8601String(),
            ]);
        } catch (\Throwable) {
            // The token exists; do not lose the one-time plain token over
            // an unwritable log channel.
        }

        $this->info('MCP token issued. The plain token is shown once; store it in the client config and do not paste it into chats or logs.');
        $this->newLine();
        $this->line($plain);
        $this->newLine();
        $this->line("id={$token->id} name={$token->name} user={$user->email} abilities=".implode(',', $abilities));
        $this->line('expires_at='.($expiresAt?->toIso8601String() ?? 'never'));

        return 0;
    }

    private function listTokens(): int
    {
        $tokens = McpToken::query()->with('user')->orderBy('id')->get();

        if ($tokens->isEmpty()) {
            $this->info('No MCP tokens have been issued.');

            return 0;
        }

        $this->table(
            ['id', 'name', 'user', 'abilities', 'last used', 'expires', 'revoked'],
            $tokens->map(fn (McpToken $token): array => [
                $token->id,
                $token->name,
                $token->user?->email ?? '—',
                implode(',', $token->abilities ?? []),
                $token->last_used_at?->toDateTimeString() ?? '—',
                $token->expires_at?->toDateTimeString() ?? 'never',
                $token->revoked_at?->toDateTimeString() ?? 'no',
            ])->all(),
        );

        return 0;
    }

    private function revoke(): int
    {
        $id = (int) $this->option('id');

        if ($id < 1) {
            $this->error('The --id option is required when revoking a token.');

            return 1;
        }

        $token = McpToken::query()->find($id);

        if ($token === null) {
            $this->error("No MCP token with id [{$id}].");

            return 1;
        }

        if ($token->revoked_at !== null) {
            $this->info("Token [{$id}] is already revoked.");

            return 0;
        }

        $token->forceFill(['revoked_at' => now()])->save();

        try {
            Log::info('mcp.token.revoke', [
                'token_id' => $token->id,
                'user_id' => $token->user_id,
            ]);
        } catch (\Throwable) {
            // The revocation is already committed.
        }

        $this->info("Token [{$id}] is revoked. Existing requests fail immediately.");

        return 0;
    }

    private function unknownAction(): int
    {
        $this->error('Unknown action. Use issue, list, or revoke.');

        return 1;
    }

    /** @return list<string>|null */
    private function resolveAbilities(): ?array
    {
        $raw = trim((string) $this->option('abilities'));

        if ($raw === '') {
            $abilities = (array) config('content_mcp.default_abilities', [
                McpToken::ABILITY_READ,
                McpToken::ABILITY_WRITE,
            ]);
        } else {
            $abilities = array_values(array_filter(array_map('trim', explode(',', $raw))));
        }

        $unknown = array_diff($abilities, McpToken::ABILITIES);

        if ($unknown !== []) {
            $this->error('Unknown abilities: '.implode(', ', $unknown).'. Allowed: '.implode(', ', McpToken::ABILITIES).'.');

            return null;
        }

        if ($abilities === []) {
            $this->error('At least one ability is required.');

            return null;
        }

        return array_values(array_unique($abilities));
    }

    private function resolveDays(): ?int
    {
        $default = (int) config('content_mcp.token_days', 90);
        $raw = trim((string) $this->option('days'));

        if ($raw === '') {
            return max(1, min(365, $default));
        }

        if (! ctype_digit($raw)) {
            $this->error('The --days option must be a whole number between 1 and 365.');

            return null;
        }

        $days = (int) $raw;

        if ($days < 1 || $days > 365) {
            $this->error('The --days option must be between 1 and 365.');

            return null;
        }

        return $days;
    }
}
