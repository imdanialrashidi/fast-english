<?php

namespace App\Http\Controllers;

/**
 * S8 sitemap (scope §19.1): public marketing pages only. Auth, learner,
 * staff, and media routes never appear here. Owner instruction
 * 2026-11-22 removed the public sample from the marketing surface, so it
 * is not advertised in the sitemap either.
 */
class SitemapController extends Controller
{
    public function index()
    {
        $urls = [
            ['loc' => route('landing'), 'lastmod' => null],
            ['loc' => route('trust.about'), 'lastmod' => null],
            ['loc' => route('trust.cooperation'), 'lastmod' => null],
            ['loc' => route('trust.faq'), 'lastmod' => null],
            ['loc' => route('trust.support'), 'lastmod' => null],
            ['loc' => route('trust.terms'), 'lastmod' => null],
            ['loc' => route('trust.privacy'), 'lastmod' => null],
            ['loc' => route('download'), 'lastmod' => null],
            ['loc' => route('install'), 'lastmod' => null],
        ];

        // The XML declaration cannot live in a Blade file (the embedded
        // close tag would end the compiled PHP block), so it is built here
        // from concatenated parts.
        $xml = '<'.'?xml version="1.0" encoding="UTF-8" ?'.'>'."\n"
            .view('sitemap.index', ['urls' => $urls])->render();

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
