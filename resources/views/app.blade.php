<!DOCTYPE html>
{{-- M0 Inertia root template (ADR-0002): the single entry point for every
     Inertia page. Permanent light theme only — no data-theme switching, no
     fe-theme storage, no pre-paint theme script. lang=fa dir=rtl is static
     so the document direction is correct before React mounts. --}}
@php
    // Server-rendered SEO for public marketing pages (landing/download):
    // crawlers see title, description, canonical, Open Graph, and JSON-LD
    // before React runs. Private pages carry no `seo` prop and keep the
    // generic title + noindex headers.
    $seo = $page['props']['seo'] ?? null;
    $seo = is_array($seo) ? $seo : null;
    $seoTitle = $seo['title'] ?? 'Fast English — انگلیسی را با داستان کوتاه بخوان و بشنو';
    $seoDescription = $seo['description'] ?? null;
    $seoCanonical = $seo['canonical'] ?? url()->current();
    // Bump the favicon URLs whenever the files change: browsers cache
    // /favicon.ico aggressively and ignore a plain overwrite.
    $faviconVersion = (int) filemtime(public_path('favicon.ico'));
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
    {{-- Canonical for the current URL; the S8 index discipline (PrivateNoStore
         noindex blanket + per-surface rules) is unchanged. --}}
    <link rel="canonical" href="{{ $seoCanonical }}">
    @if ($seoDescription !== null)
        <meta name="description" content="{{ $seoDescription }}">
        <meta property="og:site_name" content="Fast English">
        <meta property="og:locale" content="fa_IR">
        <meta property="og:type" content="website">
        <meta property="og:title" content="{{ $seoTitle }}">
        <meta property="og:description" content="{{ $seoDescription }}">
        <meta property="og:url" content="{{ $seoCanonical }}">
        <meta name="twitter:card" content="summary">
        <meta name="twitter:title" content="{{ $seoTitle }}">
        <meta name="twitter:description" content="{{ $seoDescription }}">
        @if (app()->environment('production'))
            <meta name="robots" content="index, follow">
        @endif
    @endif
    @if ($seo !== null && isset($seo['json_ld']) && is_array($seo['json_ld']))
        <script type="application/ld+json">{!! json_encode($seo['json_ld'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) !!}</script>
    @endif
    <title inertia>{{ $seoTitle }}</title>
    @viteReactRefresh
    @vite(['resources/css/inertia.css', 'resources/js/app.tsx', 'resources/js/pwa.js'])
    <x-inertia::head />
</head>
<body>
    <x-inertia::app />
</body>
</html>
