<!DOCTYPE html>
{{-- M0 Inertia root template (ADR-0002): the single entry point for every
     Inertia page. Permanent light theme only — no data-theme switching, no
     fe-theme storage, no pre-paint theme script. lang=fa dir=rtl is static
     so the document direction is correct before React mounts. --}}
@php
    // Server-rendered SEO for public pages: crawlers see the title,
    // description, canonical, social tags, and JSON-LD before React runs.
    // The partial owns the shared tag set; private pages carry no `seo`
    // prop and keep the generic title + noindex headers.
    $seo = $page['props']['seo'] ?? null;
    $seo = is_array($seo) ? $seo : null;
    $seoTitle = $seo['title'] ?? 'Fast English — انگلیسی را با داستان کوتاه بخوان و بشنو';
    // Bump the favicon URLs whenever the files change: browsers cache
    // /favicon.ico aggressively and ignore a plain overwrite.
    $faviconVersion = (int) filemtime(public_path('favicon.ico'));
    // The hero cover is React-rendered, so the browser discovers it only
    // after hydration. The server already has the same URL in the page
    // props; expose it here so the first paint can preload one image.
    $hero = data_get($page, 'props.sample.cover_url')
        ?? data_get($page, 'props.topic.cover_url');
@endphp
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#F7F4EE">
    {{-- Reader save actions (progress, bookmarks, vocabulary) POST to the
         existing JSON endpoints with this token; logout stays a native
         form POST. The token is per-session Laravel default, not a leak. --}}
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/favicon.ico?v={{ $faviconVersion }}" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png?v={{ $faviconVersion }}">
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png?v={{ $faviconVersion }}">
    <link rel="apple-touch-icon" href="/icons/apple-touch-180.png?v={{ $faviconVersion }}">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="Fast English">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    {{-- Canonical and the public metadata set. Private pages still get a
         canonical (current URL) and their noindex header. --}}
    @include('partials.seo', ['seo' => $seo])
    {{-- First-paint hints: the Persian UI font is otherwise discovered only
         after the blocking CSS parses, and the React-rendered hero cover is
         otherwise discovered only after hydration. One image only. --}}
    <link rel="preload" as="font" type="font/woff2"
          href="/fonts/vazirmatn/vazirmatn-arabic-variable.woff2" crossorigin>
    @if (is_string($hero) && $hero !== '')
        <link rel="preload" as="image" href="{{ $hero }}" fetchpriority="high">
    @endif
    @if (config('services.google.site_verification'))
        <meta name="google-site-verification" content="{{ config('services.google.site_verification') }}">
    @endif
    <title inertia>{{ $seoTitle }}</title>
    {{-- Boot resilience: a slow or blocked JS bundle must not leave a
         completely blank page. React replaces #app on mount; until then
         (or if the script never runs) this static message explains what is
         happening instead of showing an empty warm-paper screen. --}}
    <style>
        #app:empty::after {
            content: 'در حال بارگذاری Fast English…';
            display: block;
            padding: 4rem 1.25rem;
            color: #55607A;
            font-family: Vazirmatn, Tahoma, system-ui, sans-serif;
            font-size: 1rem;
            text-align: center;
        }
    </style>
    @viteReactRefresh
    @vite(['resources/css/inertia.css', 'resources/js/app.tsx', 'resources/js/pwa.js'])
    <x-inertia::head />
</head>
<body>
    <x-inertia::app />
    <noscript>
        <div style="max-width:40rem;margin:2rem auto;padding:1rem 1.25rem;border:1px solid #E4DED2;border-radius:1rem;background:#FFFFFF;color:#101B33;font-family:Tahoma,system-ui,sans-serif;line-height:1.8;text-align:center;">
            برای استفاده از Fast English باید جاوااسکریپت مرورگر را فعال کنید.
        </div>
    </noscript>
</body>
</html>
