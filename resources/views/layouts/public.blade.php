<!DOCTYPE html>
{{-- Preserved server layout (staff 2FA + error pages): Persian RTL, permanent
     light theme only — no data-theme switching, no fe-theme storage, no
     pre-paint theme script. Learner/public product surfaces render through
     the Inertia root (views/app.blade.php); this layout serves classic
     server-rendered pages only. --}}
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#F7F4EE">
    <link rel="icon" href="/favicon.ico?v={{ filemtime(public_path('favicon.ico')) }}" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png?v={{ filemtime(public_path('favicon.ico')) }}">
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png?v={{ filemtime(public_path('favicon.ico')) }}">
    <link rel="apple-touch-icon" href="/icons/apple-touch-180.png?v={{ filemtime(public_path('favicon.ico')) }}">
    <meta name="description" content="@yield('meta_description', 'Fast English — خواندن و شنیدن متن‌های انگلیسی کوتاه در سطح مناسب')">
    @hasSection('noindex')
        <meta name="robots" content="noindex, nofollow">
    @endif
    @hasSection('canonical')
        <link rel="canonical" href="@yield('canonical')">
    @endif
    <title>@yield('title', 'Fast English')</title>
    @vite(['resources/css/app.css'])
</head>
<body class="fe-learner">
<a class="fe-skip" href="#fe-content">پرش به محتوا</a>
<header class="fe-topnav fe-topnav-public">
    <nav aria-label="ناوبری اصلی">
        <a class="fe-brand" href="{{ route('landing') }}" aria-label="Fast English"><x-fe-brand :height="32" /></a>
        <a class="fe-nav-link" href="{{ route('app.home') }}"><x-fe-icon name="compass" size="20" />مطالب</a>
        <a class="fe-nav-link" href="{{ route('download') }}"><x-fe-icon name="file-text" size="20" />دانلود</a>
        <a class="fe-nav-link" href="{{ route('trust.faq') }}"><x-fe-icon name="info" size="20" />پرسش‌ها</a>
        <a class="fe-nav-link" href="{{ route('login') }}"><x-fe-icon name="log-in" size="20" />ورود</a>
    </nav>
</header>
<main id="fe-content" class="fe-measure fe-public">
    @yield('content')
</main>
<footer class="fe-footer">
    <nav aria-label="پیوندهای اعتماد">
        <a href="{{ route('trust.about') }}">درباره</a>
        <a href="{{ route('trust.cooperation') }}">همکاری</a>
        <a href="{{ route('trust.support') }}">پشتیبانی</a>
        <a href="{{ route('trust.terms') }}">قوانین</a>
        <a href="{{ route('trust.privacy') }}">حریم خصوصی</a>
        <a href="{{ route('trust.refund') }}">بازگشت وجه</a>
    </nav>
</footer>
</body>
</html>
