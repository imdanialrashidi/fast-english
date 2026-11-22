# خط تولید بخش TED Talk (مسیر عامل → پک → ایمپورت)

این سند مالکِ قرارداد «بخش هفتم» است: یک TED Talk برای هر مطلب پادکست، با صوت خصوصی، کوی رسمی جمله‌به‌جمله، متن پاک‌شده، ده واژه و کاور مجوزدار. مقدار مرجع همان کد است؛ این سند فقط ترتیب، کیفیت و مرزهای انتشار را می‌گوید.

- وضعیت پک: ۵۳ تاک (۴۹ تاک مچ‌شده با ۴۹ موضوع + ۴ تاک در استخر)، مجموع ۵۴۲ دقیقه، ۷۵٬۸۲۹ واژه، کوتاه‌ترین ۵٫۰ دقیقه و بلندترین ۱۴٫۹ دقیقه.
- میانگین حذف متن ۲٫۷٪ و بیشترین ۱۳٫۵٪ (سقف قرارداد ۳۰٪).
- هر تاک دقیقاً ۱۰ واژه دارد؛ فارسی فقط برای واژه‌های تخصصی.
- منبع کوی‌ها خود TED است (نه ASR) و زمان‌ها میلی‌ثانیه‌ای‌اند.

## ۰. مرز حقوقی (قبل از انتشار)

TED تاک‌ها را با **CC BY-NC-ND 4.0** منتشر می‌کند: استفادهٔ غیرتجاری، بدون اثر مشتق. این محصول متن را ویرایش می‌کند و دسترسی می‌فروشد؛ پس **انتشار عمومی روی سایت تجاری بدون اجازهٔ کتبی TED مجاز نیست**. به همین دلیل:

- `ted:import` پیش‌فرض **draft** است و بدون `--publish --reviewer=...` منتشر نمی‌کند.
- هر ردیف `source_license` و `license_note` دارد و مسیر منبع را نگه می‌دارد.
- در ۲۰۲۶-۱۱-۲۲ مالک اجازهٔ انتشار تجاری را در `license_note` پک ثبت کرد و همان پک با `--publish --reviewer=admin@fastenglishpodcast.ir` روی production منتشر شد: ۵۳ تاک (۴۹ مچ‌شده + ۴ استخر). تا زمانی که سند بیرونیِ این اجازه در جای دیگری نگه‌داری نشود، `license_note` هر ردیف مرجع ثبت‌شده است.

## ۱. ورودی و پک

```
dist/
  manifest.json
  QA.md
  talks/<slug>/audio.mp3       # mono 44.1k, 96kbps, -16 LUFS
  talks/<slug>/cover.jpg       # 1600×900, CC0/PD, license record in data/covers/records
  talks/<slug>/final.json      # {"paragraphs": [[{"t", "text"}]], "words": [...]}
```

`manifest.json` برای هر تاک: `slug`, `topic_slug` (خالی = استخر), `area`, `title_en`, `speaker`, `duration_seconds`, مسیر سه فایل، `source_url`, `source_license`, `license_note`.

## ۲. تولید (پوشهٔ `~/Documents/Projects/ted-talks`)

```sh
python3 pipeline/discover.py        # کاندیدهای ۵–۱۵ دقیقه از topic pageهای TED
# curation.json: انتخاب ۵۳ تاک و مچ ۴۹ موضوع
python3 pipeline/fetch_talks.py     # متن رسمی + کوی میلی‌ثانیه‌ای
python3 pipeline/download_audio.py  # صدا + loudnorm دوپاسه، MP3 مونو ۹۶k
python3 pipeline/build_text.py      # ادغام کوی‌ها در جمله، حذف تشویق/فیلر
# edits.json + words.json: بازبینی انسانی/مدل (حذف بیربط، حداکثر ۱۵٪، ۱۰ واژه)
python3 pipeline/apply_edits.py     # final.json + اعتبارسنجی سقف ۳۰٪
python3 pipeline/polish_final.py    # حذف براکت‌های ویرایشی/برچسب گوینده
python3 pipeline/trim_outliers.py   # حذف سکوت/اجرای موسیقی بعد از آخرین جمله
python3 pipeline/covers.py       # کاور CC0/PD بدون تکرار + رکورد مجوز
python3 pipeline/build_pack.py      # ساخت dist/
```

## ۳. کیفیت‌سنجی پک

- زمان آخرین جمله باید داخل مدت صوت باشد و زمان‌ها هرگز عقب نروند (`TedContent` همین را در مدل هم اعمال می‌کند).
- هر تاک ۸ تا ۱۰ واژه، بدون تکرار، با gloss انگلیسی ≤ ۸ واژه.
- کاور ۱۶:۹، ≥ ۱۲۰۰×۶۰۰ منبع، CC0/PD، بدون متن سوخته و بدون تکرار در دو صفحه.
- صدا با `ebur128` بین ‎-16.5 تا ‎-16.3 LUFS و بدون کلیپ.

## ۴. ایمپورت

```sh
# فقط ساخت draft (پیش‌فرض امن)
php artisan ted:import dist

# انتشار پس از ثبت بررسی مالک (ایمیل کارکنان فعال)
php artisan ted:import dist --publish --reviewer=ops@example.com
```

- ایمپورت idempotent است: کلید `slug` است و فایل‌ها با هش محتوا نام‌گذاری می‌شوند؛ تعویض صوت خودش `audio_revision` را بالا می‌برد.
- اگر موضوعی از قبل تاک دیگری داشته باشد، ایمپورت خطا می‌دهد و چیزی را جابه‌جا نمی‌کند.
- پوشش کاور عمومی است (`/storage/ted/...`)، صوت خصوصی (`storage/app/private/ted/...`) و فقط از مسیر policy-checked سرو می‌شود.
- ایمپورت مجدد یک تاک منتشرشده بدون `--publish` آن را به draft برمی‌گرداند تا تأیید قدیمی روی متن تازه استفاده نشود.

## ۵. انتشار تولید

Artisan روی میزبان نیست؛ داخل کانتینر اجرا می‌شود. پس از انتقال `dist/` به سرور:

```sh
docker exec <app-container> php artisan ted:import /path/to/dist
# و فقط بعد از اجازهٔ حقوقی:
docker exec <app-container> php artisan ted:import /path/to/dist --publish --reviewer=...
```

انتشار این بخش روی production در ۲۰۲۶-۱۱-۲۲ پس از ثبت اجازهٔ مالک در `license_note` انجام شد (۵۳ تاک published، ۰ خطا). آرشیو یا انتشار دوباره فقط با همان مسیر `ted:import --publish --reviewer=...` و بازبینی تازه انجام می‌شود.
