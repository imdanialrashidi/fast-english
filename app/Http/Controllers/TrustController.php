<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

/**
 * S8 trust pages (scope §6, PUB-02): /about, /cooperation, /faq, /support,
 * /terms, /privacy.
 *
 * Every page labels its Persian copy as DRAFT (owner review required).
 * Where the owner must supply the contact, terms, or privacy text, the
 * page shows an explicit BLOCKED state and invents no details: no support
 * channel, no legal text, no names, no numbers.
 */
class TrustController extends Controller
{
    // Public-slice Inertia transport (ADR-0002): one Trust/Show page
    // per route with the same page key. DRAFT badges and BLOCKED states
    // travel as verbatim props (not just client-side copy) so the S8
    // placeholder scan keeps running against the encoded page: no
    // contact, legal text, names, or numbers are invented.
    public const DRAFT_BADGE = 'پیش‌نویس — DRAFT — نیازمند بازبینی صاحب محصول';

    /** @var array<string, string|null> */
    public const BLOCKED_NOTES = [
        'about' => null,
        'cooperation' => 'در انتظار اطلاعات صاحب محصول (BLOCKED) — کانال ارتباطی همکاری هنوز اعلام نشده است؛ از درج ایمیل یا شماره تماس خودداری شده تا اطلاعات واقعی تأمین شود.',
        'faq' => null,
        'support' => 'در انتظار اطلاعات صاحب محصول (BLOCKED) — کانال پشتیبانی (ایمیل، شناسه پیام‌رسان یا ساعات پاسخ‌گویی) هنوز اعلام نشده است. هیچ نشانی تماسی درج نشده تا اطلاعات واقعی تأمین شود.',
        'terms' => 'در انتظار متن مصوب صاحب محصول (BLOCKED) — متن حقوقی قوانین استفاده هنوز تأمین و تصویب نشده است. هیچ متن حقوقی پیش‌فرضی درج نشده است.',
        'privacy' => 'در انتظار متن مصوب صاحب محصول (BLOCKED) — متن سیاست حریم خصوصی هنوز تأمین و تصویب نشده است. هیچ متن حقوقی پیش‌فرضی درج نشده است.',
    ];

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
        return Inertia::render('Trust/Show', [
            'page' => $page,
            'badge' => self::DRAFT_BADGE,
            'blocked' => self::BLOCKED_NOTES[$page] ?? null,
        ]);
    }
}
