<?php

namespace App\Http\Middleware;

use App\Http\Responses\NoStore;
use App\Models\McpToken;
use App\Support\Entitlement;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bearer-token gate for the content MCP server (owner request 2026-11-08).
 *
 * Tokens are staff-only, hashed at rest, revocable, and optionally
 * expiring. The middleware binds the token for tool-level ability checks
 * and records a coarse last-used audit; it never starts a session or
 * accepts a cookie as authority.
 */
class AuthenticateMcpToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plain = trim((string) $request->bearerToken());

        if (! is_string($plain) || $plain === '') {
            return $this->unauthorized('A bearer token is required.');
        }

        $token = McpToken::findByPlainText($plain);

        if ($token === null || ! $token->isActive()) {
            return $this->unauthorized('The MCP token is invalid, expired, or revoked.');
        }

        if (! Entitlement::staff($token->user)) {
            return response()->json([
                'message' => 'MCP tokens are limited to active staff accounts.',
            ], 403, NoStore::headers());
        }

        Auth::setUser($token->user);
        app()->instance('mcp.token', $token);

        $token->forceFill([
            'last_used_at' => now(),
            'last_used_ip' => $request->ip(),
        ])->saveQuietly();

        try {
            return $next($request);
        } finally {
            app()->forgetInstance('mcp.token');
        }
    }

    private function unauthorized(string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
        ], 401, [
            ...NoStore::headers(),
            'WWW-Authenticate' => 'Bearer realm="mcp", error="invalid_token"',
        ]);
    }
}
