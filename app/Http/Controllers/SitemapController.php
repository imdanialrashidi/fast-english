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
            route('landing'),
            route('trust.about'),
            route('trust.cooperation'),
            route('trust.faq'),
            route('trust.support'),
            route('trust.terms'),
            route('trust.privacy'),
            route('download'),
        ];

        // The public sample is the primary indexable content surface. It
        // joins the sitemap only while a published sample actually exists.
        if (Lesson::query()
            ->where('is_public_sample', true)
            ->where('status', 'published')
            ->whereHas('topic', fn ($topics) => $topics->where('status', 'published'))
            ->exists()) {
            $urls[] = route('sample');
        }

        // The XML declaration cannot live in a Blade file (the embedded
        // close tag would end the compiled PHP block), so it is built here
        // from concatenated parts.
        $xml = '<'.'?xml version="1.0" encoding="UTF-8" ?'.'>'."\n"
            .view('sitemap.index', ['urls' => $urls])->render();

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=utf-8']);
    }
}
