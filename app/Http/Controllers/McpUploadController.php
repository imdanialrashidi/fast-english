<?php

namespace App\Http\Controllers;

use App\Http\Responses\NoStore;
use App\Support\StagedUpload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Receives the raw bytes for a staged agent upload (owner request 2026-11-08).
 *
 * The route is outside the web stack: no session, no CSRF, only the
 * short-lived X-Upload-Token bound to an active MCP token. The body is
 * streamed to the private staging disk, capped before/while writing, and
 * validated with the same MP3/cover rules as the staff panel.
 */
class McpUploadController extends Controller
{
    public function __invoke(Request $request, string $upload): JsonResponse
    {
        $payload = $request->attributes->get('mcp_upload');

        if (! is_array($payload)) {
            return response()->json(['message' => 'Missing upload context.'], 401, NoStore::headers());
        }

        if (StagedUpload::exists($upload)) {
            return response()->json([
                'message' => 'This upload has already been received. Start a new upload with begin-upload.',
            ], 409, NoStore::headers());
        }

        $maxBytes = (int) ($payload['max'] ?? 0);
        $declared = $request->headers->get('Content-Length');

        if ($maxBytes < 1) {
            return response()->json(['message' => 'The upload limit is misconfigured.'], 500, NoStore::headers());
        }

        if (is_numeric($declared) && (int) $declared > $maxBytes) {
            return response()->json([
                'message' => 'The upload exceeds the '.StagedUpload::humanBytes($maxBytes).' limit.',
            ], 413, NoStore::headers());
        }

        $stream = $request->getContent(true);

        if (is_string($stream)) {
            $handle = fopen('php://temp', 'r+b');

            if ($handle === false) {
                return response()->json(['message' => 'The upload could not be buffered.'], 500, NoStore::headers());
            }

            fwrite($handle, $stream);
            rewind($handle);
            $stream = $handle;
        }

        try {
            $stored = StagedUpload::store(
                $upload,
                (string) $payload['kind'],
                $maxBytes,
                $stream,
                is_numeric($declared) ? (int) $declared : null,
            );
        } catch (ValidationException $e) {
            $message = (string) (collect($e->errors())->flatten()->first() ?? 'The upload was rejected.');

            return response()->json([
                'message' => $message,
                'errors' => $e->errors(),
            ], 422, NoStore::headers());
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => config('app.debug') ? $e->getMessage() : 'The upload could not be stored.',
            ], 500, NoStore::headers());
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        return response()->json([
            'upload_id' => $upload,
            'kind' => (string) $payload['kind'],
            'bytes' => $stored['bytes'],
            'sha256' => $stored['sha256'],
            'next_step' => 'Pass upload_id to save-lesson (audio) or save-topic (cover). The file cannot be uploaded twice.',
        ], 200, NoStore::headers());
    }
}
