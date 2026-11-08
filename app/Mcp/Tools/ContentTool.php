<?php

namespace App\Mcp\Tools;

use App\Models\McpToken;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tool;
use Throwable;

/**
 * Shared guard and response shaping for every content MCP tool.
 *
 * The route middleware has already authenticated the bearer token, but the
 * tool still checks its ability so a read/write token cannot publish by
 * calling the transition tool directly. Failures become MCP tool errors
 * with a machine-readable `errors` map; unexpected exceptions are reported
 * and never leak a stack trace or filesystem path to the client.
 */
abstract class ContentTool extends Tool
{
    protected string $ability = McpToken::ABILITY_READ;

    final public function handle(Request $request): mixed
    {
        $token = McpToken::current();

        if ($token === null) {
            return $this->failure('This request has no MCP token context.');
        }

        if (! $token->hasAbility($this->ability)) {
            $this->audit($token, false);

            return $this->failure("This token lacks the [{$this->ability}] ability.", [
                'code' => 'ability_denied',
            ]);
        }

        try {
            $response = $this->execute($request, $token);
            $this->audit($token, true);

            return $response;
        } catch (ValidationException $e) {
            $this->audit($token, false);
            $errors = $e->errors();
            $message = (string) (collect($errors)->flatten()->first() ?? 'The request did not pass content validation.');

            return $this->failure($message, ['errors' => $errors]);
        } catch (Throwable $e) {
            $this->audit($token, false);
            report($e);

            return $this->failure(
                config('app.debug') ? $e->getMessage() : 'The content server could not complete the request.',
                ['code' => 'internal_error'],
            );
        }
    }

    abstract protected function execute(Request $request, McpToken $token): mixed;

    /** @param array<string, mixed> $data */
    protected function ok(array $data): ResponseFactory
    {
        return Response::structured(['ok' => true, ...$data]);
    }

    /** @param array<string, mixed> $details */
    protected function failure(string $message, array $details = []): ResponseFactory
    {
        return Response::make(Response::error($message))->withStructuredContent([
            'ok' => false,
            'message' => $message,
            ...$details,
        ]);
    }

    private function audit(McpToken $token, bool $ok): void
    {
        // Coarse audit only: no arguments, content, or upload tokens enter
        // the log. Per-record review fields carry the content audit trail.
        // A logging failure must never fail a content operation.
        try {
            Log::info('mcp.tool', [
                'tool' => $this->name(),
                'token_id' => $token->id,
                'user_id' => $token->user_id,
                'ok' => $ok,
            ]);
        } catch (Throwable) {
            // The operation already succeeded or failed on its own.
        }
    }
}
