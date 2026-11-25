<?php

namespace App\Http\Controllers;

use App\Support\Faq;
use App\Support\PublicSeo;
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

    private function trustPage(string $page): Response
    {
        $support = SiteSettings::supportContacts();
        $faqs = $page === 'faq' ? Faq::trust() : [];

        return Inertia::render('Trust/Show', [
            'page' => $page,
            'notice' => null,
            'contact' => [
                'support_channel' => SiteSettings::supportChannel(),
                'support_href' => SiteSettings::contactHref(SiteSettings::supportChannel()),
                'support_phone' => $support['phone'],
                'support_phone_href' => $support['phone_href'],
                'support_email' => $support['email'],
                'support_email_href' => $support['email_href'],
                'support_messenger' => $support['messenger'],
                'support_messenger_note' => $support['messenger_note'],
                'support_telegram_url' => $support['telegram_url'],
                'support_bale_url' => $support['bale_url'],
                'support_hours' => SiteSettings::supportHours(),
                'cooperation_channel' => SiteSettings::cooperationChannel(),
                'cooperation_href' => SiteSettings::contactHref(SiteSettings::cooperationChannel()),
            ],
            'legal' => SiteSettings::legal($page),
            'faqs' => $faqs,
            'seo' => $this->seo($page, $faqs),
        ]);
    }

    /**
     * Per-page crawler metadata. Before this, all seven trust pages shared
     * the generic root title and had no description or social tags.
     *
     * @param  list<array{q: string, a: string}>  $faqs
     * @return array<string, mixed>
     */
    private function seo(string $page, array $faqs): array
    {
        $copy = [
            'about' => [
                'title' => 'درباره ما | Fast English',
                'description' => 'فست انگلیش برای فارسی‌زبانانی ساخته شده که می‌خواهند انگلیسی را به‌صورت استاندارد و جذاب یاد بگیرند؛ پادکست در شش سطح، داستان، آیلتس، TED و تمرین.',
            ],
            'cooperation' => [
                'title' => 'همکاری با Fast English',
                'description' => 'اگر در آموزش زبان انگلیسی یا تولید محتوای آموزشی فعالیت می‌کنید، معرفی کوتاه، زمینهٔ همکاری و نمونه‌کارتان را برای فست انگلیش بفرستید.',
            ],
            'faq' => [
                'title' => 'پرسش‌های شما | Fast English',
                'description' => 'پاسخ پرسش‌های شما دربارهٔ مخاطب فست انگلیش، معنی سطح‌های A1 تا C2، روش خرید اشتراک و نصب اپلیکیشن روی اندروید و آیفون.',
            ],
            'support' => [
                'title' => 'پشتیبانی Fast English',
                'description' => 'برای پرسش‌های قبل از خرید، راهنمایی استفاده از برنامه، مشکل ورود یا پیگیری اشتراک، در بله یا تلگرام به ۰۹۹۳۶۹۰۸۶۳۳ پیام بدهید.',
            ],
            'terms' => [
                'title' => 'قوانین استفاده | Fast English',
                'description' => 'شرایط استفاده از Fast English: حساب کاربری، اشتراک، محتوای آموزشی و قواعد استفاده را در این صفحه بخوان.',
            ],
            'privacy' => [
                'title' => 'حریم خصوصی | Fast English',
                'description' => 'سیاست حریم خصوصی Fast English: چه داده‌هایی ذخیره می‌شود، چگونه نگهداری می‌شود و چه کسی به آن دسترسی دارد.',
            ],
        ];

        $row = $copy[$page] ?? $copy['about'];

        return PublicSeo::page(
            $row['title'],
            $row['description'],
            route('trust.'.$page),
            $page === 'faq' ? Faq::jsonLd($faqs) : null,
        );
    }
}
