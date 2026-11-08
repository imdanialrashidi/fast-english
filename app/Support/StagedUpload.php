<?php

namespace App\Support;

use App\Models\McpToken;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

/**
 * Staged binary uploads for the content MCP server (owner request 2026-11-08).
 *
 * MCP tool arguments are JSON, so audio and cover bytes never travel inside
 * a tools/call. `begin-upload` returns a short-lived, single-use URL token;
 * the agent PUTs the raw bytes there, then passes the returned upload id to
 * `save-lesson`/`save-topic`. The token is encrypted (tamper-proof and
 * bound to the issuing MCP token), expires after the configured TTL, and
 * the staged file is consumed exactly once (moved for audio, copied then
 * marked for covers) so a second save cannot reuse the same upload id.
 *
 * Validation matches the panel pipeline: MP3 signature for audio (30 MB)
 * and magic bytes/decodability/dimensions for covers (2 MB). The staged
 * file lives on the private disk; nothing here ever writes to a public URL.
 */
final class StagedUpload
{
    public const KIND_AUDIO = 'audio';

    public const KIND_COVER = 'cover';

    public const KINDS = [self::KIND_AUDIO, self::KIND_COVER];

    public const TOKEN_PREFIX = 'feup_';

    private const DISK = 'local';

    private const ID_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/';

    /**
     * Create the upload descriptor returned by the `begin-upload` tool.
     *
     * @return array{id: string, token: string, kind: string, max_bytes: int, expires_at: string, ttl_minutes: int}
     */
    public static function begin(McpToken $token, string $kind, ?int $declaredBytes = null): array
    {
        $max = self::maxBytes($kind);
        $ttl = max(1, (int) config('content_mcp.upload_ttl_minutes', 30));

        if ($declaredBytes !== null && ($declaredBytes < 1 || $declaredBytes > $max)) {
            throw ValidationException::withMessages([
                'size_bytes' => "A {$kind} upload must be between 1 byte and ".self::humanBytes($max).'.',
            ]);
        }

        $id = (string) Str::uuid();
        $expiresAt = now()->addMinutes($ttl);

        $payload = [
            'v' => 1,
            'id' => $id,
            'kind' => $kind,
            'max' => $max,
            'exp' => $expiresAt->getTimestamp(),
            'token_id' => (int) $token->id,
        ];

        $plain = self::TOKEN_PREFIX.Crypt::encryptString(json_encode($payload, JSON_THROW_ON_ERROR));

        return [
            'id' => $id,
            'token' => $plain,
            'kind' => $kind,
            'max_bytes' => $max,
            'expires_at' => $expiresAt->toIso8601String(),
            'ttl_minutes' => $ttl,
        ];
    }

    /**
     * Decode and shape-check an upload token. Null means tampered or
     * malformed; expiry and MCP-token state are checked by the middleware.
     *
     * @return array{id: string, kind: string, max: int, exp: int, token_id: int}|null
     */
    public static function decodeToken(string $plain): ?array
    {
        if (! str_starts_with($plain, self::TOKEN_PREFIX)) {
            return null;
        }

        try {
            $json = Crypt::decryptString(substr($plain, strlen(self::TOKEN_PREFIX)));
            $data = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return null;
        }

        if (! is_array($data)) {
            return null;
        }

        foreach (['id', 'kind', 'max', 'exp', 'token_id'] as $key) {
            if (! array_key_exists($key, $data)) {
                return null;
            }
        }

        if (! is_string($data['id']) || preg_match(self::ID_PATTERN, $data['id']) !== 1) {
            return null;
        }

        if (! in_array($data['kind'], self::KINDS, true)) {
            return null;
        }

        if (! is_int($data['max']) || $data['max'] < 1) {
            return null;
        }

        if (! is_int($data['exp']) || ! is_int($data['token_id'])) {
            return null;
        }

        return [
            'id' => $data['id'],
            'kind' => $data['kind'],
            'max' => $data['max'],
            'exp' => $data['exp'],
            'token_id' => $data['token_id'],
        ];
    }

    public static function exists(string $id): bool
    {
        $disk = Storage::disk(self::DISK);
        $path = self::path($id);

        return $disk->exists($path) || $disk->exists($path.'.done');
    }

    public static function path(string $id): string
    {
        self::assertId($id);

        return trim((string) config('content_mcp.staging_dir', 'staged'), '/').'/'.$id;
    }

    /**
     * Stream the request body to the private staging disk, enforce the byte
     * cap, validate the signature, and publish the final staging file.
     *
     * @param  resource  $stream
     * @return array{bytes: int, sha256: string}
     */
    public static function store(string $id, string $kind, int $maxBytes, mixed $stream, ?int $declaredBytes = null): array
    {
        self::assertId($id);

        if (! in_array($kind, self::KINDS, true)) {
            throw ValidationException::withMessages(['kind' => 'Unknown upload kind.']);
        }

        if (! is_resource($stream)) {
            throw ValidationException::withMessages(['file' => 'The upload body could not be read.']);
        }

        if ($declaredBytes !== null && $declaredBytes > $maxBytes) {
            throw ValidationException::withMessages([
                'file' => 'The upload exceeds the '.self::humanBytes($maxBytes).' limit.',
            ]);
        }

        $disk = Storage::disk(self::DISK);
        $directory = trim((string) config('content_mcp.staging_dir', 'staged'), '/');
        $disk->makeDirectory($directory);

        $finalPath = $directory.'/'.$id;
        if (self::exists($id)) {
            throw ValidationException::withMessages(['file' => 'This upload has already been received.']);
        }

        $absoluteFinal = $disk->path($finalPath);

        // Open exclusively so two concurrent PUTs cannot both claim the same
        // upload id. A partial file is deleted on any failure below.
        $handle = @fopen($absoluteFinal, 'xb');

        if ($handle === false) {
            if (file_exists($absoluteFinal)) {
                throw ValidationException::withMessages(['file' => 'This upload has already been received.']);
            }

            throw new RuntimeException('Could not open the staging file for writing.');
        }

        $bytes = 0;
        $hash = hash_init('sha256');

        try {
            while (! feof($stream)) {
                $chunk = fread($stream, 1024 * 1024);
                if ($chunk === false) {
                    throw new RuntimeException('Could not read the upload body.');
                }

                if ($chunk === '') {
                    if (feof($stream)) {
                        break;
                    }

                    throw new RuntimeException('The upload body ended unexpectedly.');
                }

                $bytes += strlen($chunk);
                if ($bytes > $maxBytes) {
                    throw ValidationException::withMessages([
                        'file' => 'The upload exceeds the '.self::humanBytes($maxBytes).' limit.',
                    ]);
                }

                if (fwrite($handle, $chunk) !== strlen($chunk)) {
                    throw new RuntimeException('Could not write the upload to the staging disk.');
                }

                hash_update($hash, $chunk);
            }
        } catch (Throwable $e) {
            fclose($handle);
            @unlink($absoluteFinal);

            throw $e;
        }

        fclose($handle);

        if ($bytes < 1) {
            @unlink($absoluteFinal);
            throw ValidationException::withMessages(['file' => 'The uploaded file is empty.']);
        }

        $problem = $kind === self::KIND_AUDIO
            ? (AudioFile::hasMp3Signature($absoluteFinal) ? null : 'The audio file is not a valid MP3.')
            : CoverImage::problem($absoluteFinal);

        if ($problem !== null) {
            @unlink($absoluteFinal);
            throw ValidationException::withMessages(['file' => $problem]);
        }

        return [
            'bytes' => $bytes,
            'sha256' => hash_final($hash),
        ];
    }

    /**
     * Move a staged, still-valid audio file to the private lesson store.
     *
     * @return array{path: string, bytes: int}
     */
    public static function consumeAudio(string $id): array
    {
        $disk = Storage::disk(self::DISK);
        $path = self::path($id);

        if (! $disk->exists($path)) {
            throw ValidationException::withMessages([
                'audio_upload_id' => 'The uploaded audio was not found or was already used.',
            ]);
        }

        $bytes = (int) $disk->size($path);
        $max = self::maxBytes(self::KIND_AUDIO);
        if ($bytes < 1 || $bytes > $max) {
            $disk->delete($path);
            throw ValidationException::withMessages([
                'audio_upload_id' => 'The uploaded audio is empty or too large.',
            ]);
        }

        if (! AudioFile::hasMp3Signature($disk->path($path))) {
            $disk->delete($path);
            throw ValidationException::withMessages([
                'audio_upload_id' => 'The uploaded audio is not a valid MP3.',
            ]);
        }

        $disk->makeDirectory('lessons');
        $destination = 'lessons/'.Str::ulid().'.mp3';

        if (! $disk->move($path, $destination)) {
            throw new RuntimeException('Could not attach the uploaded audio.');
        }

        if (! self::markConsumed($id)) {
            $disk->move($destination, $path);

            throw new RuntimeException('Could not record the upload as consumed.');
        }

        return ['path' => $destination, 'bytes' => $bytes];
    }

    /**
     * Move a staged, still-valid cover to the public cover store. The Topic
     * model hook re-encodes it on save and strips metadata.
     *
     * @return array{path: string, bytes: int}
     */
    public static function consumeCover(string $id): array
    {
        $local = Storage::disk(self::DISK);
        $path = self::path($id);

        if (! $local->exists($path)) {
            throw ValidationException::withMessages([
                'cover_upload_id' => 'The uploaded cover was not found or was already used.',
            ]);
        }

        $absolute = $local->path($path);
        $problem = CoverImage::problem($absolute);
        if ($problem !== null) {
            $local->delete($path);
            throw ValidationException::withMessages(['cover_upload_id' => $problem]);
        }

        $size = @getimagesize($absolute);
        $mime = is_array($size) ? ($size['mime'] ?? null) : null;
        $extension = is_string($mime) ? (CoverImage::MIME_MAP[$mime] ?? null) : null;

        if ($extension === null) {
            $local->delete($path);
            throw ValidationException::withMessages([
                'cover_upload_id' => 'The cover must be a JPEG, PNG, or WebP image.',
            ]);
        }

        $public = Storage::disk('public');
        $public->makeDirectory('covers');
        $destination = 'covers/'.Str::ulid().'.'.$extension;

        $stream = @fopen($absolute, 'rb');
        if ($stream === false) {
            throw new RuntimeException('Could not read the staged cover.');
        }

        try {
            $written = $public->writeStream($destination, $stream);
        } finally {
            fclose($stream);
        }

        if ($written !== true) {
            throw new RuntimeException('Could not attach the uploaded cover.');
        }

        if (! self::markConsumed($id)) {
            $public->delete($destination);

            throw new RuntimeException('Could not record the upload as consumed.');
        }

        $bytes = (int) $local->size($path);
        $local->delete($path);

        return ['path' => $destination, 'bytes' => $bytes];
    }

    /**
     * Delete staging files (including consumed markers) older than TTL.
     */
    public static function cleanup(int $ttlMinutes, bool $dryRun = false): int
    {
        $disk = Storage::disk(self::DISK);
        $directory = trim((string) config('content_mcp.staging_dir', 'staged'), '/');
        $cutoff = now()->subMinutes(max(1, $ttlMinutes))->getTimestamp();

        $removed = 0;

        foreach ($disk->files($directory) as $file) {
            if ($disk->lastModified($file) >= $cutoff) {
                continue;
            }

            if (! $dryRun) {
                $disk->delete($file);
            }

            $removed++;
        }

        return $removed;
    }

    public static function maxBytes(string $kind): int
    {
        $value = (int) config("content_mcp.max_upload_bytes.{$kind}", 0);

        if ($value < 1) {
            throw new RuntimeException("No upload limit is configured for [{$kind}].");
        }

        return $value;
    }

    public static function humanBytes(int $bytes): string
    {
        return $bytes >= 1024 * 1024
            ? round($bytes / (1024 * 1024), 1).' MB'
            : round($bytes / 1024, 1).' KB';
    }

    private static function assertId(string $id): void
    {
        if (preg_match(self::ID_PATTERN, $id) !== 1) {
            throw ValidationException::withMessages(['upload' => 'Unknown upload id.']);
        }
    }

    /**
     * A consumed marker makes the upload id single-use even after the
     * staged file itself has been moved/removed.
     */
    private static function markConsumed(string $id): bool
    {
        return Storage::disk(self::DISK)->put(self::path($id).'.done', (string) now()->getTimestamp());
    }
}
