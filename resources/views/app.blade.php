<!DOCTYPE html>
{{-- M0 Inertia root template (ADR-0002): the single entry point for every
     Inertia page. Permanent light theme only — no data-theme switching, no
     fe-theme storage, no pre-paint theme script. lang=fa dir=rtl is static
     so the document direction is correct before React mounts. --}}
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
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="apple-touch-icon" href="/icons/apple-touch-180.png">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    {{-- Canonical for the current URL; the S8 index discipline (PrivateNoStore
         noindex blanket + per-surface rules) is unchanged. --}}
    <link rel="canonical" href="{{ url()->current() }}">
    <title inertia>Fast English — انگلیسی را با داستان کوتاه و صوت هماهنگ یاد بگیر</title>
    @viteReactRefresh
    @vite(['resources/css/inertia.css', 'resources/js/app.tsx', 'resources/js/pwa.js'])
    <x-inertia::head />
</head>
<body>
    <x-inertia::app />
</body>
</html>
