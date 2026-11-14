<?php

namespace App\Http\Controllers;

use App\Support\Faq;
use App\Support\PublicSample;
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

    public function refund(): Response
    {
        return $this->trustPage('refund');
    }

    private function trustPage(string $page): Response
    {
        $support = SiteSettings::supportContacts();
        $faqs = $page === 'faq' ? Faq::trust(PublicSample::exists()) : [];

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
                'title' => 'درباره Fast English | خواندن و شنیدن انگلیسی',
                'description' => 'Fast English متن‌های کوتاه انگلیسی در شش سطح A1 تا C2 با صوت همان نسخه است. روش کار، دامنهٔ محصول و نمونهٔ رایگان را اینجا بشناس.',
            ],
            'cooperation' => [
                'title' => 'همکاری با Fast English',
                'description' => 'برای همکاری در تولید محتوا، معرفی محصول یا پشتیبانی با Fast English در تماس باش. کانال رسمی همکاری در این صفحه آمده است.',
            ],
            'faq' => [
                'title' => 'پرسش‌های پرتکرار Fast English',
                'description' => 'پاسخ پرسش‌های رایج دربارهٔ نمونهٔ رایگان، سطح‌ها، خرید اشتراک، تأیید پرداخت و فایل نصب Fast English.',
            ],
            'support' => [
                'title' => 'پشتیبانی Fast English',
                'description' => 'راه‌های تماس با پشتیبانی Fast English برای پیگیری پرداخت، مشکل ورود و پرسش‌های حساب؛ همراه با کانال رسمی پشتیبانی.',
            ],
            'terms' => [
                'title' => 'قوانین استفاده | Fast English',
                'description' => 'شرایط استفاده از Fast English: حساب کاربری، اشتراک، محتوای آموزشی و قواعد استفاده را در این صفحه بخوان.',
            ],
            'privacy' => [
                'title' => 'حریم خصوصی | Fast English',
                'description' => 'سیاست حریم خصوصی Fast English: چه داده‌هایی ذخیره می‌شود، چگونه نگهداری می‌شود و چه کسی به آن دسترسی دارد.',
            ],
            'refund' => [
                'title' => 'بازگشت وجه | Fast English',
                'description' => 'شرایط بازگشت وجه اشتراک Fast English و مسیر پیگیری درخواست بازگشت را در این صفحه ببین.',
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
