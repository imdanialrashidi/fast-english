<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Profile photo pipeline.
 *
 * The owner asked for a personal photo on the account tab. Accepted bytes
 * are one JPEG/PNG/WebP image up to 4 MB and 4000 px per side, verified by
 * server MIME, magic bytes, decode and dimension checks. The image is
 * centre-cropped to a square, re-encoded through GD (all EXIF/metadata
 * dropped), and stored on the public disk under a random name. Replacing or
 * removing a photo deletes the previous file.
 */
final class ProfilePhoto
{
    public const MAX_BYTES = 4 * 1024 * 1024;

    public const MAX_DIMENSION = 4000;

    public const TARGET_SIZE = 512;

    public const MIME_MAP = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public static function problem(UploadedFile $file): ?string
    {
        if ($file->getSize() === false || $file->getSize() <= 0) {
            return 'فایل عکس خالی است.';
        }

        if ($file->getSize() > self::MAX_BYTES) {
            return 'حجم عکس بیشتر از ۴ مگابایت است.';
        }

        $realPath = $file->getRealPath();
        if ($realPath === false) {
            return 'فایل عکس قابل خواندن نیست.';
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($realPath);
        if (! isset(self::MIME_MAP[$mime])) {
            return 'عکس باید JPEG، PNG یا WebP باشد.';
        }

        $head = @file_get_contents($realPath, false, null, 0, 12);
        if ($head === false || strlen($head) < 4) {
            return 'فایل عکس خالی است.';
        }

        $signatureOk = match ($mime) {
            'image/jpeg' => str_starts_with($head, "\xFF\xD8\xFF"),
            'image/png' => str_starts_with($head, "\x89PNG"),
            'image/webp' => strlen($head) >= 12 && str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'WEBP',
            default => false,
        };

        if (! $signatureOk) {
            return 'امضای فایل با نوع عکس سازگار نیست.';
        }

        $size = @getimagesize($realPath);
        if ($size === false) {
            return 'عکس قابل رمزگشایی نیست.';
        }

        if ($size[0] > self::MAX_DIMENSION || $size[1] > self::MAX_DIMENSION) {
            return 'ابعاد عکس بیشتر از ۴۰۰۰ پیکسل است.';
        }

        return null;
    }

    /**
     * Store a square, metadata-free copy on the public disk and return the
     * relative path. The caller owns the old-path cleanup.
     */
    public static function store(UploadedFile $file): string
    {
        $problem = self::problem($file);
        if ($problem !== null) {
            throw ValidationException::withMessages(['avatar' => $problem]);
        }

        $realPath = $file->getRealPath();
        assert(is_string($realPath));

        $source = @imagecreatefromstring((string) @file_get_contents($realPath));
        if ($source === false) {
            throw ValidationException::withMessages(['avatar' => 'عکس قابل رمزگشایی نیست.']);
        }

        $width = imagesx($source);
        $height = imagesy($source);
        $side = min($width, $height);
        $srcX = (int) max(0, floor(($width - $side) / 2));
        $srcY = (int) max(0, floor(($height - $side) / 2));

        $target = imagecreatetruecolor(self::TARGET_SIZE, self::TARGET_SIZE);
        if ($target === false) {
            imagedestroy($source);
            throw ValidationException::withMessages(['avatar' => 'عکس قابل پردازش نیست.']);
        }

        // Flatten transparency to the warm paper colour so a PNG with an
        // alpha channel still looks right inside the round avatar.
        $paper = imagecolorallocate($target, 247, 245, 239);
        imagefilledrectangle($target, 0, 0, self::TARGET_SIZE, self::TARGET_SIZE, $paper);
        imagecopyresampled($target, $source, 0, 0, $srcX, $srcY, self::TARGET_SIZE, self::TARGET_SIZE, $side, $side);
        imagedestroy($source);

        $path = 'avatars/'.((string) Str::ulid()).'.jpg';
        $disk = Storage::disk('public');
        $disk->makeDirectory('avatars');
        $absolute = $disk->path($path);
        $tmp = $absolute.'.tmp';

        $ok = imagejpeg($target, $tmp, 86);
        imagedestroy($target);

        if ($ok !== true || ! is_file($tmp)) {
            @unlink($tmp);
            throw ValidationException::withMessages(['avatar' => 'ذخیرهٔ عکس ممکن نشد.']);
        }

        rename($tmp, $absolute);

        return $path;
    }

    public static function delete(?string $path): void
    {
        if (is_string($path) && $path !== '' && str_starts_with($path, 'avatars/')) {
            Storage::disk('public')->delete($path);
        }
    }
}
