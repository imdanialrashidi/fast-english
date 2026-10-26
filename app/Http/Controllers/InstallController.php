<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

/**
 * Install guide (owner 2026-10-26): one public page for adding Fast
 * English to the home screen.
 *
 * iOS Safari never fires `beforeinstallprompt`, so a fake install button
 * would be a dead end on iPhone; this page walks through the browser's own
 * «Add to Home Screen» instead. It stays public (not inside marketing.guest)
 * because signed-in learners reach it from Account, where the Chromium
 * install card is unavailable on iOS.
 */
class InstallController extends Controller
{
    public function index()
    {
        return Inertia::render('Install/Index', [
            'seo' => [
                'title' => 'نصب Fast English روی گوشی و کامپیوتر',
                'description' => 'راهنمای گام‌به‌گام افزودن Fast English به صفحهٔ اصلی iPhone، iPad، اندروید و مرورگر کامپیوتر؛ بدون فروشگاه برنامه.',
                'canonical' => route('install'),
            ],
        ]);
    }
}
