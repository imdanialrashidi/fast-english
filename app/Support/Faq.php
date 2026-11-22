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
     * Five concrete questions the buyer asks before paying. Owner
     * instruction 2026-11-22 removed every free-sample answer: the
     * product now sells one paid path, so the FAQ explains the library,
     * the level, the review loop, and the payment rather than a trial.
     *
     * @return list<array{q: string, a: string}>
     */
    public static function landing(): array
    {
        return [
            [
                'q' => 'برای چه سطحی مناسب است؟',
                'a' => 'از A1 تا C2. محتوا در شش سطح آماده شده و اگر سطحت را نمی‌دانی، آزمون تعیین سطح ۲۰ سؤالی پیشنهاد یک سطح می‌دهد. سطح فقط سختی محتوا را می‌گوید، نه میزان دسترسی را.',
            ],
            [
                'q' => 'داخل اشتراک دقیقاً چه چیزی هست؟',
                'a' => 'کتابخانهٔ متن و صدا، ۵۳ سخنرانی TED Talk با متن و واژه‌های کلیدی، شش کتاب American English File با ۶۶ یونیت و ۱٬۶۳۰ تمرین، مسیرهای داستان، آیلتس و Inside Reading، واژه‌نامهٔ شخصی و مرور زمان‌بندی‌شده.',
            ],
            [
                'q' => 'واژه‌ها چطور مرور می‌شوند؟',
                'a' => 'هر واژه‌ای که ذخیره کنی سر موعد با کارت مرور برمی‌گردد. با دوباره، سخت، خوب یا آسان زمان‌بندی بعدی را خودت تعیین می‌کنی و واژه از حافظه‌ات دور نمی‌ماند.',
            ],
            [
                'q' => 'خرید و فعال‌سازی چطور انجام می‌شود؟',
                'a' => 'حساب می‌سازی، پلن را انتخاب می‌کنی، مبلغ را کارت‌به‌کارت می‌کنی و تصویر رسید را در همان صفحه می‌فرستی. پس از بررسی و تأیید، اشتراک فعال می‌شود و دسترسی باز می‌شود.',
            ],
            [
                'q' => 'چطور روی گوشی نصب کنم و اگر سؤالی داشتم چه کنم؟',
                'a' => 'نسخهٔ وب روی مرورگر گوشی نصب می‌شود (PWA) و نسخهٔ اندروید از صفحهٔ دانلود در دسترس است. برای هر پرسشی در بله یا تلگرام به شمارهٔ ۰۹۹۲۴۹۳۰۶۶۷ پیام بده.',
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
    public static function trust(): array
    {
        return [
            [
                'q' => 'Fast English برای چه کسی ساخته شده است؟',
                'a' => 'برای بزرگسالانی که می‌خواهند انگلیسی واقعی را در سطح درست بخوانند و بشنوند؛ از A1 تا C2، با متن و صوت همان نسخه.',
            ],
            [
                'q' => 'سطح‌ها چه معنایی دارند؟',
                'a' => 'مطالب در سطح‌های A1 تا C2 ارائه می‌شوند. می‌توانید سطح را مستقیم انتخاب کنید یا از آزمون تعیین سطح ۲۰ سؤالی استفاده کنید.',
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
