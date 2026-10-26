<!DOCTYPE html>
{{-- Standalone error shell: no route() lookups, no Vite manifest, no
     session props. A catastrophic boot failure must still render Persian
     copy instead of failing inside the error page itself. --}}
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>@yield('title', 'خطا') · Fast English</title>
    <style>
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100dvh;
            background: #F7F4EE;
            color: #101B33;
            font-family: Vazirmatn, system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif;
            line-height: 1.8;
        }
        header {
            border-bottom: 1px solid #E4DED2;
        }
        .brand {
            display: inline-flex;
            align-items: center;
            min-height: 56px;
            padding: 0 1rem;
            color: #101B33;
            font-weight: 800;
            text-decoration: none;
        }
        main {
            max-width: 680px;
            margin: 0 auto;
            padding: 3rem 1rem;
        }
        h1 { font-size: 1.6rem; line-height: 1.6; margin: 0 0 0.5rem; }
        p { margin: 0 0 1rem; color: #55607A; }
        .action {
            display: inline-flex;
            align-items: center;
            min-height: 44px;
            padding: 0.5rem 1.5rem;
            border-radius: 999px;
            background: #1F3B82;
            color: #FFFFFF;
            font-weight: 700;
            text-decoration: none;
        }
        .action:hover { background: #172F69; }
    </style>
</head>
<body>
    <header>
        <a class="brand" href="/" lang="en" dir="ltr">Fast English</a>
    </header>
    <main>
        @yield('content')
    </main>
</body>
</html>
