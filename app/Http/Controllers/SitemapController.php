<?php

namespace App\Http\Controllers;

use App\Models\Lesson;

/**
 * S8 sitemap (scope §19.1): public marketing pages only. Auth, learner,
 * staff, and media routes never appear here.
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
            ['loc' => route('trust.refund'), 'lastmod' => null],
            ['loc' => route('download'), 'lastmod' => null],
            ['loc' => route('install'), 'lastmod' => null],
        ];

        // The public sample is the primary indexable content surface. It
        // joins the sitemap only while a published sample actually exists;
        // its real update time is the only trustworthy lastmod here.
        $sample = Lesson::query()
            ->where('is_public_sample', true)
            ->where('status', 'published')
            ->whereHas('topic', fn ($topics) => $topics->where('status', 'published'))
            ->orderBy('id')
            ->first();

        if ($sample !== null) {
            $urls[] = [
                'loc' => route('sample'),
                'lastmod' => $sample->updated_at?->toAtomString(),
            ];
        }

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
