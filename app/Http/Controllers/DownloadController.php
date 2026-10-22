<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

/**
 * S8 download page (scope §18.2): the APK is «هنوز منتشر نشده».
 *
 * No file, no link, no checksum is rendered until a real build fills the
 * release metadata (config/release.php, all null by default). The
 * metadata template (version, versionCode, date, size, SHA-256) renders
 * its rows only from those real values — never from invented ones.
 */
class DownloadController extends Controller
{
    public function index()
    {
        $release = [
            'version_name' => config('release.version_name'),
            'version_code' => config('release.version_code'),
            'release_date' => config('release.release_date'),
            'size_bytes' => config('release.size_bytes'),
            'sha256' => config('release.sha256'),
            'file_url' => config('release.file_url'),
        ];

        $published = collect($release)->except('file_url')->filter(
            fn ($value): bool => $value !== null && trim((string) $value) !== ''
        )->count() === 5 && $release['file_url'] !== null && trim((string) $release['file_url']) !== '';

        // Public-slice Inertia transport (ADR-0002): the same
        // «هنوز منتشر نشده» state until a real build fills the release
        // metadata. No file, link, or checksum renders from invented
        // values — rows come only from config/release.php.
        return Inertia::render('Download/Index', [
            'release' => [
                'version_name' => $release['version_name'],
                'version_code' => $release['version_code'],
                'release_date' => $release['release_date'],
                'size_bytes' => $release['size_bytes'],
                'sha256' => $release['sha256'],
                'file_url' => $release['file_url'],
            ],
            'published' => $published,
            'seo' => [
                'title' => 'دانلود Fast English',
                'description' => 'دانلود اپلیکیشن اندروید Fast English — وضعیت انتشار نسخه، مشخصات فایل نصب، و راه شروع با نمونه رایگان.',
                'canonical' => route('download'),
            ],
        ]);
    }
}
