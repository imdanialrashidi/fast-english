<?php

namespace App\Http\Middleware;

use App\Http\Responses\NoStore;
use App\Models\McpToken;
use App\Support\Entitlement;
use App\Support\StagedUpload;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authorizes a staged upload PUT (owner request 2026-11-08).
 *
 * The payload token is encrypted and bound to the MCP token that created
 * it, so a leaked upload URL alone is useless after TTL/revocation and
 * cannot be reused once the file is consumed. Uploads never use a session
 * cookie or CSRF token: this is a machine bearer surface.
 */
class AuthenticateMcpUpload
{
    public function handle(Request $request, Closure $next): Response
    {
        $plain = trim((string) $request->header('X-Upload-Token', ''));

        if ($plain === '') {
            return $this->unauthorized('An X-Upload-Token header is required.');
        }

        $payload = StagedUpload::decodeToken($plain);

        if ($payload === null) {
            return $this->unauthorized('The upload token is invalid.');
        }

        if ($payload['exp'] <= now()->getTimestamp()) {
            return $this->unauthorized('The upload token has expired. Call begin-upload again.');
        }

        $routeId = (string) $request->route('upload', '');

        if ($routeId !== $payload['id']) {
            return response()->json([
                'message' => 'The upload token does not belong to this upload id.',
            ], 400, NoStore::headers());
        }

        $token = McpToken::query()->with('user')->find($payload['token_id']);

        if ($token === null || ! $token->isActive()) {
            return $this->unauthorized('The issuing MCP token is invalid, expired, or revoked.');
        }

        if (! Entitlement::staff($token->user)) {
            return response()->json([
                'message' => 'MCP tokens are limited to active staff accounts.',
            ], 403, NoStore::headers());
        }

        if (! $token->hasAbility(McpToken::ABILITY_WRITE)) {
            return response()->json([
                'message' => 'The issuing MCP token cannot write content.',
            ], 403, NoStore::headers());
        }

        $request->attributes->set('mcp_upload', $payload);

        return $next($request);
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
