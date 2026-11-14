<?php

namespace App\Support;

/**
 * One server source for the public FAQ copy. The landing and the FAQ
 * trust page both render these rows and emit the matching FAQPage
 * structured data, so the visible answer can never drift from the JSON-LD.
 */
final class Faq
{
    /**
     * @return list<array{q: string, a: string}>
     */
    public static function landing(bool $hasSample): array
    {
        return [
            [
                'q' => 'بدون اشتراک می‌توانم امتحان کنم؟',
                'a' => $hasSample
                    ? 'بله. نمونه واقعی همیشه رایگان است و بدون ثبت‌نام باز می‌شود.'
                    : 'نمونهٔ عمومی هنوز منتشر نشده است؛ پس از انتشار، بدون ثبت‌نام باز می‌شود.',
            ],
            [
                'q' => 'سطح‌ها یعنی چه؟',
                'a' => 'شش سطح از A1 تا C2. هر مطلب نسخه خودش را در هر سطح دارد و متن و صوت همیشه از یک نسخه‌اند.',
            ],
            [
                'q' => 'واژه‌ها چطور مرور می‌شوند؟',
                'a' => 'هر واژه‌ای که ذخیره کنی سر موعد با کارت مرور برمی‌گردد؛ دوباره، سخت، خوب یا آسان را خودت ثبت می‌کنی.',
            ],
        ];
    }

    /**
     * The four core questions rendered on /faq. The two support blocks
     * below them stay page-specific because they contain live contact
     * links; they are not part of this list.
     *
     * @return list<array{q: string, a: string}>
     */
    public static function trust(bool $hasSample): array
    {
        return [
            [
                'q' => 'آیا بدون حساب می‌توانم نمونه را ببینم؟',
                'a' => $hasSample
                    ? 'بله. یک نمونه واقعی از صفحه اصلی در دسترس است و نیازی به ثبت‌نام ندارد.'
                    : 'نمونهٔ عمومی هنوز منتشر نشده است؛ پس از انتشار، بدون ثبت‌نام باز می‌شود.',
            ],
            [
                'q' => 'سطح‌ها چه معنایی دارند؟',
                'a' => 'مطالب در سطح‌های A1 تا C2 ارائه می‌شوند. می‌توانید سطح را مستقیم انتخاب کنید یا از آزمون تعیین سطح استفاده کنید.',
            ],
            [
                'q' => 'خرید چگونه انجام می‌شود؟',
                'a' => 'پلن را انتخاب می‌کنی، مبلغ را به کارت مقصد واریز می‌کنی و تصویر رسید را در همان صفحه می‌فرستی. رسید بررسی می‌شود و بعد از تأیید، اشتراک فعال می‌شود و دسترسی باز می‌شود.',
            ],
            [
                'q' => 'بعد از پرداخت چه اتفاقی می‌افتد؟',
                'a' => 'رسیدت در صف بررسی قرار می‌گیرد. وضعیت را در همان صفحهٔ پرداخت می‌بینی. بعد از تأیید، اشتراک فعال می‌شود و اگر موبایلت تأیید شده باشد، یک پیامک تأیید فعال‌سازی هم می‌گیری.',
            ],
        ];
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
