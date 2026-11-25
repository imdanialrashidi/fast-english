<?php

namespace App\Support;

/**
 * One server source for the public FAQ copy. The landing and the FAQ
 * trust page both render these rows and emit the matching FAQPage
 * structured data, so the visible answer can never drift from the JSON-LD.
 *
 * Owner instruction 2026-11-25 fixed the question set and wording:
 * audience, levels, purchase, and install. The two payment-support
 * questions that used to live on the FAQ page were removed; support is a
 * single Bale/Telegram number and receipts are uploaded only in the web
 * panel.
 */
final class Faq
{
    /**
     * The four owner-approved questions. Both the landing preview and the
     * FAQ page use this list.
     *
     * @return list<array{q: string, a: string}>
     */
    public static function landing(): array
    {
        return [
            [
                'q' => 'فست انگلیش برای چه کسی ساخته شده؟',
                'a' => 'برای افرادی که می‌خواهند انگلیسی را به‌صورت جذاب، اصولی و متناسب با سطح خودشان یاد بگیرند.',
            ],
            [
                'q' => 'سطح‌ها چه معنی دارند؟',
                'a' => 'مطالب در سطح‌های A1 تا C2 ارائه می‌شوند تا در هر سطحی که هستید، بتوانید سریع محتوای مناسب سطح خودتان را پیدا کنید و یاد بگیرید.',
            ],
            [
                'q' => 'خرید چگونه انجام می‌شود؟',
                'a' => 'وارد حساب کاربری شوید. پس از واریز مبلغ، تصویر رسید را در پنل کاربری وب‌سایت بارگذاری کنید. اشتراک شما پس از تأیید رسید فعال می‌شود.',
            ],
            [
                'q' => 'چگونه اپلیکیشن را نصب کنم؟',
                'a' => 'راهنمای روشن و مرحله‌به‌مرحلهٔ نصب روی اندروید و آیفون در صفحهٔ دانلود قرار دارد. نسخهٔ وب (PWA) روی مرورگر گوشی نصب می‌شود و نسخهٔ اندروید هم از همان صفحه در دسترس است.',
            ],
        ];
    }

    /**
     * The same four questions on /faq. Kept as a separate method so a page
     * can add its own live support block without changing the JSON-LD list.
     *
     * @return list<array{q: string, a: string}>
     */
    public static function trust(): array
    {
        return self::landing();
    }

    /**
     * FAQPage node without @context, ready for a @graph.
     *
     * @param  list<array{q: string, a: string}>  $rows
     * @return array<string, mixed>
     */
    public static function schema(array $rows): array
    {
        return [
            '@type' => 'FAQPage',
            'mainEntity' => array_map(fn (array $row): array => [
                '@type' => 'Question',
                'name' => $row['q'],
                'acceptedAnswer' => [
                    '@type' => 'Answer',
                    'text' => $row['a'],
                ],
            ], $rows),
        ];
    }

    /**
     * Standalone FAQPage document for pages with no other JSON-LD.
     *
     * @param  list<array{q: string, a: string}>  $rows
     * @return array<string, mixed>
     */
    public static function jsonLd(array $rows): array
    {
        return [
            '@context' => 'https://schema.org',
            ...self::schema($rows),
        ];
    }
}
