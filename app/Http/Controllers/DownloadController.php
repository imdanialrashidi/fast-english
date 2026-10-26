<?php

namespace App\Http\Controllers;

use App\Support\Release;
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
        // Public-slice Inertia transport (ADR-0002): the same
        // «هنوز منتشر نشده» state until a real build fills the release
        // metadata. No file, link, or checksum renders from invented
        // values — rows come only from config/release.php.
        return Inertia::render('Download/Index', [
            'release' => Release::metadata(),
            'published' => Release::published(),
            'seo' => [
                'title' => 'دانلود Fast English',
                'description' => 'دانلود اپلیکیشن اندروید Fast English — وضعیت انتشار نسخه، مشخصات فایل نصب، و راه شروع با نمونه رایگان.',
                'canonical' => route('download'),
            ],
        ]);
    }
}
