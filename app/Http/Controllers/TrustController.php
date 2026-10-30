<?php

namespace App\Http\Controllers;

use App\Support\SiteSettings;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Public trust pages (PUB-02).
 *
 * Owner instruction 2026-10-25: no internal workflow labels ever reach a
 * visitor, and contact/legal copy comes from owner-editable settings
 * (database) with config defaults. Since 2026-10-26 the default support and
 * cooperation channel is the product-domain address
 * (info@fastenglishpodcast.ir), not the former @test placeholder; the
 * legal pages publish the standard Persian copy the owner asked for.
 */
class TrustController extends Controller
{
    public function about(): Response
    {
        return $this->trustPage('about');
    }

    public function cooperation(): Response
    {
        return $this->trustPage('cooperation');
    }

    public function faq(): Response
    {
        return $this->trustPage('faq');
    }

    public function support(): Response
    {
        return $this->trustPage('support');
    }

    public function terms(): Response
    {
        return $this->trustPage('terms');
    }

    public function privacy(): Response
    {
        return $this->trustPage('privacy');
    }

    public function refund(): Response
    {
        return $this->trustPage('refund');
    }

    private function trustPage(string $page): Response
    {
        return Inertia::render('Trust/Show', [
            'page' => $page,
            'notice' => null,
            'contact' => [
                'support_channel' => SiteSettings::supportChannel(),
                'support_href' => SiteSettings::contactHref(SiteSettings::supportChannel()),
                'support_hours' => SiteSettings::supportHours(),
                'cooperation_channel' => SiteSettings::cooperationChannel(),
                'cooperation_href' => SiteSettings::contactHref(SiteSettings::cooperationChannel()),
            ],
            'legal' => SiteSettings::legal($page),
        ]);
    }
}
