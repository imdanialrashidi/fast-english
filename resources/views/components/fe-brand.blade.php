@props(['height' => 36])

@php
    // Owner-supplied header lockup (Logo/fastenglish_header_logo.png for
    // light surfaces). Permanent light theme only (ADR-0002): exactly one
    // image renders — no dark variant, no data-theme switching.
    $height = max(20, min(72, (int) $height));
    $width = (int) round($height * 697 / 197);
@endphp
<span {{ $attributes->merge(['class' => 'fe-brand-logo']) }} role="img" aria-label="Fast English"><img
        class="fe-logo-img" src="/images/brand/fastenglish-header-logo.png" alt="" width="{{ $width }}"
        height="{{ $height }}" loading="eager" fetchpriority="high"></span>
