@php
    // Server-rendered public metadata. Every tag that the client SeoHead
    // can replace carries the same data-inertia key as its React
    // `head-key`, so an Inertia visit updates instead of duplicating tags.
    $seo = is_array($seo ?? null) ? $seo : null;
    $canonical = is_array($seo) ? ($seo['canonical'] ?? url()->current()) : url()->current();
    $description = is_array($seo) ? ($seo['description'] ?? null) : null;
    $image = is_array($seo) ? ($seo['image'] ?? null) : null;
    $imageAlt = is_array($seo) ? ($seo['image_alt'] ?? null) : null;
    $imageWidth = is_array($seo) ? ($seo['image_width'] ?? null) : null;
    $imageHeight = is_array($seo) ? ($seo['image_height'] ?? null) : null;
    $type = is_array($seo) ? ($seo['type'] ?? 'website') : 'website';
    $robots = is_array($seo) ? ($seo['robots'] ?? null) : null;
    $title = is_array($seo) ? ($seo['title'] ?? null) : null;
@endphp
<link rel="canonical" data-inertia="canonical" href="{{ $canonical }}">
@if (is_array($seo))
    @if ($description !== null && $description !== '')
        <meta name="description" data-inertia="description" content="{{ $description }}">
    @endif
    <meta property="og:site_name" data-inertia="og:site_name" content="Fast English">
    <meta property="og:locale" data-inertia="og:locale" content="fa_IR">
    <meta property="og:type" data-inertia="og:type" content="{{ $type }}">
    <meta property="og:title" data-inertia="og:title" content="{{ $title }}">
    @if ($description !== null && $description !== '')
        <meta property="og:description" data-inertia="og:description" content="{{ $description }}">
    @endif
    <meta property="og:url" data-inertia="og:url" content="{{ $canonical }}">
    @if ($image !== null && $image !== '')
        <meta property="og:image" data-inertia="og:image" content="{{ $image }}">
        <meta property="og:image:alt" data-inertia="og:image:alt" content="{{ $imageAlt }}">
        @if ($imageWidth !== null)
            <meta property="og:image:width" data-inertia="og:image:width" content="{{ $imageWidth }}">
        @endif
        @if ($imageHeight !== null)
            <meta property="og:image:height" data-inertia="og:image:height" content="{{ $imageHeight }}">
        @endif
    @endif
    <meta name="twitter:card" data-inertia="twitter:card" content="{{ $image !== null && $image !== '' ? 'summary_large_image' : 'summary' }}">
    <meta name="twitter:title" data-inertia="twitter:title" content="{{ $title }}">
    @if ($description !== null && $description !== '')
        <meta name="twitter:description" data-inertia="twitter:description" content="{{ $description }}">
    @endif
    @if ($image !== null && $image !== '')
        <meta name="twitter:image" data-inertia="twitter:image" content="{{ $image }}">
        <meta name="twitter:image:alt" data-inertia="twitter:image:alt" content="{{ $imageAlt }}">
    @endif
    @if ($robots !== null && $robots !== '')
        <meta name="robots" data-inertia="robots" content="{{ $robots }}">
    @endif
    @if (isset($seo['json_ld']) && is_array($seo['json_ld']) && $seo['json_ld'] !== [])
        <script type="application/ld+json" data-inertia="json-ld">{!! json_encode($seo['json_ld'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) !!}</script>
    @endif
@endif
