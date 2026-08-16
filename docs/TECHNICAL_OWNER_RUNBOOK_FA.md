# راهنمای مسئول فنی — Fast English Podcast

> **مخاطب:** مسئول فنی / Technical Owner (مدیر سرور)
> **نسخه:** ۱٫۰ — **آخرین به‌روزرسانی:** ۲۰۲۶-۰۸-۱۶
> این سند فقط برای شخصی است که به سرور و ابزارهای استقرار دسترسی دارد. اپراتورهای عادی به دستورهای این سند نیاز ندارند و نباید آن‌ها را اجرا کنند.
> منابع انگلیسی/فنی مرتبط: `docs/DEPLOYMENT.md`، `docs/OPERATIONS.md`، `docs/BACKUP_RESTORE.md`، `docs/INCIDENT_RUNBOOK.md`، `docs/ANDROID_RELEASE.md`.

---

## فهرست

1. [نقش و مرزها](#۱-نقش-و-مرزها)
2. [توپولوژی تولید](#۲-توپولوژی-تولید)
3. [چیدمان سرور](#۳-چیدمان-سرور)
4. [چرا pb_data بیرون از release نگهداری می‌شود](#۴-چرا-pb_data-بیرون-از-release-نگهداری-میشود)
5. [نصب اول سرور](#۵-نصب-اول-سرور)
6. [استقرار عادی نسخه‌های جدید](#۶-استقرار-عادی-نسخههای-جدید)
7. [چه تغییری به چه نوع استقراری نیاز دارد](#۷-چه-تغییری-به-چه-نوع-استقراری-نیاز-دارد)
8. [بازگشت به نسخهٔ قبل (Rollback)](#۸-بازگشت-به-نسخه-قبل-rollback)
9. [پشتیبان‌گیری و بازیابی](#۹-پشتیبانگیری-و-بازیابی)
10. [نظارت و سلامت](#۱۰-نظارت-و-سلامت)
11. [ایمنی سوپریوزر PocketBase](#۱۱-ایمنی-سوپریوزر-pocketbase)
12. [عملیات اندروید](#۱۲-عملیات-اندروید)
13. [متغیرهای محیطی و اسرار](#۱۳-متغیرهای-محیطی-و-اسرار)

---

## ۱. نقش و مرزها

مسئول فنی تنها شخصی است که:

- به سرور (SSH) دسترسی دارد؛
- استقرارها و بازگشت‌ها را اجرا می‌کند؛
- پشتیبان‌گیری/بازیابی را تضمین می‌کند؛
- سوپریوزر PocketBase را فقط از طریق تانل SSH مدیریت می‌کند؛
- نسخهٔ اندروید را می‌سازد و منتشر می‌کند.

**خارج از دامنهٔ شما:** قیمت‌ها و تنظیمات کسب‌وکار (کار مالک در پنل مدیریت)، تصمیم‌های سیاستی (بازگشت وجه، نگهداشت رسید)، محتوای سرمقاله‌ای. اگر اپراتوری دستوری از این سند را می‌خواهد اجرا کند، این یک نشانهٔ خطر است.

---

## ۲. توپولوژی تولید

```text
کاربر (مرورگر / اپ اندروید)
        │  HTTPS (443)
        ▼
      DNS:  fastenglishpodcast.com
            www.fastenglishpodcast.com   → 308 به دامنهٔ اصلی
            app.fastenglishpodcast.com
            admin.fastenglishpodcast.com
        │
        ▼
      Caddy (سرور، پرت 80/443، گواهی خودکار TLS)
        │
        ├── fastenglishpodcast.com  →  /opt/fast-english/current/landing
        │                             + /releases/* از shared/releases (APK)
        ├── app.fastenglishpodcast.com → current/app
        │      └── /api/*  →  پروکسی به PocketBase 127.0.0.1:8090
        ├── admin.fastenglishpodcast.com → current/admin
        │      └── /api/*  →  پروکسی به PocketBase 127.0.0.1:8090
        │
        ▼
      PocketBase 0.39.9 (سرویس systemd، فقط 127.0.0.1:8090، کاربر غیرroot)
        │
        ├── /opt/fast-english/shared/pb_data   (SQLite + فایل‌ها — ذخیرهٔ دائمی)
        ├── مهاجرت‌ها و هوک‌ها از release فعلی (current/server)
        └── پشتیبان‌های خودکار داخل pb_data/backups
```

نکته‌های حیاتی:

- PocketBase **فقط روی loopback** گوش می‌دهد؛ هیچ راه عمومی‌ای به آن وجود ندارد. همهٔ درخواست‌های API از طریق Caddy می‌آیند.
- داشبورد سوپریوزر (`/_/`) روی دامنه‌های عمومی ۴۰۴ می‌دهد.
- Caddy حجم بدنهٔ `/api/*` را به ۶ مگابایت محدود می‌کند (رسید ۵ مگابایت + حاشیهٔ مستند).
- CORS فقط برای سه دامنهٔ عمومی + منشأ Capacitor مجاز است.
- توکن‌های فایل صوتی (پارامتر `token`) در لاگ‌های Caddy با `[REDACTED]` جایگزین می‌شوند (اثبات: `bash deploy/test-log-redaction.sh`).

---

## ۳. چیدمان سرور

```text
/opt/fast-english/
  releases/<release-id>/
    landing/        خروجی built لندینگ
    app/            خروجی built اپ دانشجو
    admin/          خروجی built پنل مدیریت
    server/         pb_migrations/ + pb_hooks/ + VERSION
    android/        APK امضاشده + release-metadata.json + RELEASE-NOTES.md
  current -> releases/<release-id>      ← لینک نمادین اتمیک (توسط deploy.sh جابه‌جا می‌شود)
  shared/
    pb_data/        دادهٔ PocketBase (دیتابیس + فایل‌ها + پشتیبان‌های خودکار)
    backups/        کپی‌های تأییدشدهٔ پشتیبان (جدا از pb_data؛ ۱۴ نگهداری)
    releases/       APK عمومی + متادیتا (فایل‌های تغییرناپذیر نسخه‌بندی‌شده)
    logs/           لاگ‌های دسترسی Caddy (چرخش ۱۰×۱۰MiB، ۳۰ روز)
    secrets/pocketbase.env   اسرار — root:root 0600، هرگز در گیت
    scripts/fep-backup-copy.sh
  bin/pocketbase    باینری PocketBase 0.39.9 (root-owned، read-only)
  .current.previous شناسهٔ release قبلی (برای بازگشت)
```

- Releaseها پس از نصب **تغییرناپذیر** می‌شوند (`chmod -R a-w`).
- `current` با «لینک موقت + rename اتمیک» جابه‌جا می‌شود: `ln -sfn … current.tmp && mv -Tf … current`.
- release قبلی **هرگز حذف نمی‌شود** (بازگشت به آن وابسته است).

---

## ۴. چرا pb_data بیرون از release نگهداری می‌شود

- release یک «نسخهٔ بی‌حال» است: هر استقرار، پوشهٔ جدیدی می‌سازد و `current` را عوض می‌کند. اگر داده داخل release بود، هر استقرار یا بازگشتی به یک «دیتابیس دیگر» می‌افتاد — یعنی دانشجویان، رسیدها و اشتراک‌ها از بین می‌رفتند یا کپی‌های گمراه‌کننده ساخته می‌شد.
- بازگشت (rollback) فقط لینک را برمی‌گرداند و **هیچ‌وقت** `pb_data` را لمس نمی‌کند؛ داده باید مستقل از نسخه‌ها زندگی کند.
- پشتیبان‌های خودکار PocketBase داخل `pb_data/backups` ساخته می‌شوند و سپس کپی تأییدشده‌شان به `shared/backups` (بیرون از `pb_data`) منتقل می‌شود تا خرابی/بازیابی اشتباهِ `pb_data` تنها نسخه‌ها را نابود نکند.

---

## ۵. نصب اول سرور

> پیش‌نیازها: سرور Debian/Ubuntu/Arch با `curl`، `python3`، `unzip`؛ پکیج Caddy نصب؛ DNS هر چهار نام به سرور؛ پرت‌های ۸۰/۴۴۳ باز.

```bash
# ۱) فایل اسرار FIRST (فقط نام‌ها — نمونه: deploy/env.production.example)
install -d -m 0700 /opt/fast-english/shared/secrets
install -m 0600 /dev/stdin /opt/fast-english/shared/secrets/pocketbase.env <<'EOF'
FEP_SUPERUSER_EMAIL=<اینجا>
FEP_SUPERUSER_PASSWORD=<اینجا>
EOF

# ۲) بوت‌استرپ + پیکربندی + اولین نسخه
bash deploy/install.sh
systemd-analyze verify /etc/systemd/system/fast-english-pocketbase.service
caddy validate --config /etc/caddy/Caddyfile && caddy fmt --overwrite /etc/caddy/Caddyfile
bash deploy/configure.sh          # تنظیمات تولید (backups cron، hideControls، …)
bash deploy/backup.sh             # پشتیبان اولیهٔ تأییدشده BEFORE اولین استقرار
bash deploy/deploy.sh /path/to/release-bundle
systemctl enable --now caddy
bash deploy/smoke-prod.sh         # اسموک کامل HTTPS (حساب‌های دورریختنی)
bash deploy/restore-drill.sh      # آزمایش بازیابی روی نمونهٔ جداگانه
```

بعد از استقرار اول، داده‌های کسب‌وکار:

```bash
# طرح‌های رسمی (ماهانه/سه‌ماهه — بدون سالانه):
export FEP_PB_URL=https://app.fastenglishpodcast.com
export FEP_PB_SUPERUSER_EMAIL=... FEP_PB_SUPERUSER_PASSWORD=...
pnpm seed:plans --target=production --confirm-production --yes

# بانک سؤال تعیین سطح: دمو هرگز در تولید؛ بانک بازبینی‌شده (در صورت تأمین):
#   pnpm seed:placement --file seeds/placement/reviewed-bank.v1.json \
#     --replace --target=production --confirm-production --yes
```

و در پنل مدیریت (`admin.fastenglishpodcast.com` → تنظیمات → تنظیمات کسب‌وکار): مقصد کارت‌به‌کارت و کانال پشتیبانی/همکاری. اولین Staff Admin: `pnpm staff:bootstrap`.

> ⚠️ **الزام Gate پیش از اولین استقرار واقعی:** مقصد پشتیبان خارج از سرور (S3 یا معادل تأییدشده) با آزمایش بازیابی تأیید شود؛ کپی فقط روی سرور «پشتیبان خارج از سرور» محسوب نمی‌شود.

---

## ۶. استقرار عادی نسخه‌های جدید

### ساخت باندل روی ماشین بیلد

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm check && pnpm test
VITE_WEB_APP_URL=https://app.fastenglishpodcast.com \
VITE_ANDROID_APK_URL=https://fastenglishpodcast.com/releases/fast-english-podcast-v1.0.0.apk \
VITE_ANDROID_APK_VERSION=1.0.0 \
pnpm build:landing && pnpm build:app && pnpm build:admin && node scripts/prerender-landing.mjs
bash scripts/verify.sh
bash scripts/check-production-bundle.sh dist-landing dist-app dist-admin
```

سپس باندل `<id>/{landing,app,admin,server,android}` را بچینید و به سرور کپی کنید.

### استقرار (روی سرور، root)

```bash
bash deploy/deploy.sh /opt/release-bundles/<release-id>
```

کاری که `deploy.sh` می‌کند، به ترتیب:

1. اعتبارسنجی باندل + چک‌سام APK (در صورت وجود)؛
2. بررسی فضای دیسک؛
3. **پشتیبان پیش از استقرار** (`fep-backup-predeploy-*`)؛
4. نصب release به‌صورت تغییرناپذیر؛
5. جابه‌جایی اتمیک لینک `current` (قبلی در `.current.previous` ثبت می‌شود)؛
6. ری‌استارت PocketBase (**مهاجرت‌ها هنگام راه‌اندازی اجرا می‌شوند**)؛
7. چک سلامت؛
8. `systemctl reload caddy`؛
9. انتشار APK + متادیتا در `shared/releases`؛
10. `smoke-prod.sh --quick` (نبود متادیتا = FAIL سخت).

کدهای خروج: `0` موفق · `1` اعتبارسنجی ناموفق (قبل از جابه‌جایی) · `2` استقرار شد ولی بازگشت خودکار انجام شد · `3` بازگشت خودکار هم ناموفق (مداخلهٔ دستی لازم).

گزینه‌ها: `--dry-run`، `--skip-backup`، `--skip-smoke`.

> بعد از راه‌اندازی اولیه، استقرار ویژگی‌های عادی دقیقاً همین یک دستور است: باندل بساز → کپی کن → `deploy.sh` → اسموک خودکار. اگر اسموک شکست بخورد، خودش برمی‌گردد (بخش ۸).

---

## ۷. چه تغییری به چه نوع استقراری نیاز دارد

| نوع تغییر | مسیر | نکته |
|---|---|---|
| متن/ظاهر لندینگ، اپ یا پنل (کد سمت کاربر) | بیلد + استقرار عادی (باندل جدید) | نیاز به بازگشت مهاجرت ندارد |
| هوک‌های سرور (منطق API) | باندل جدید شامل `server/pb_hooks` + ری‌استارت | با استقرار عادی انجام می‌شود |
| **مهاجرت دیتابیس** (فایل جدید در `pb_migrations`) | باندل جدید — مهاجرت هنگام ری‌استارت اجرا می‌شود | **این یک استقرار عادی و بی‌خطر نیست**: مهاجرت‌ها برگشت‌پذیر نیستند؛ قبل از استقرار، پشتیبان `fep-backup-predeploy-*` گرفته می‌شود و برنامهٔ بازگشت باید مشخص باشد (بخش ۸) |
| متغیر محیطی/تنظیمات سرور (مثلاً SMTP، S3، encryption key) | ویرایش `shared/secrets/pocketbase.env` + ری‌استارت سرویس | `configure.sh` برای بازنویسی تنظیمات رسمی |
| پیکربندی Caddy | ویرایش `/etc/caddy/Caddyfile` + `systemctl reload caddy` | `caddy validate` قبل از reload |
| تغییر تنظیمات کسب‌وکار (قیمت/کارت/پشتیبانی) | **بدون استقرار** — از پنل مدیریت | در لحظه از سرور خوانده می‌شود |
| نسخهٔ جدید اندروید | بیلد + امضا + باندل + به‌روزرسانی لندینگ (بخش ۱۲) | APK قبلی هرگز بازنویسی نمی‌شود |

---

## ۸. بازگشت به نسخهٔ قبل (Rollback)

### اصل اساسی

> **بازگشت اپلیکیشن ≠ بازگشت دیتابیس.**

- بازگشت نرم‌افزاری: لینک `current` به release قبلی برمی‌گردد + ری‌استارت PocketBase + reload کادی. `pb_data` دست‌نخورده می‌ماند.
- بازگشت دیتابیس: مهاجرت‌های اجراشده **خودکار برنمی‌گردند**. اگر release معیوب مهاجرت داشته باشد، هوک‌های نسخهٔ قدیمی ممکن است با شمای جدید سازگار نباشند؛ در آن صورت مسیر درست، بازیابی از پشتیبان پیش از استقرار است (نه «مهاجرت معکوس» دستی).

### بازگشت خودکار

هر شکستی **بعد از** جابه‌جایی لینک (ری‌استارت، سلامت، reload کادی، یا اسموک اجباری) بازگشت خودکار را فعال می‌کند (خروجی ۲). شکست قبل از جابه‌جایی، بدون دست‌زدن به چیزی متوقف می‌شود (خروجی ۱).

### بازگشت دستی (در صورت لزوم)

```bash
cd /opt/fast-english
OLD=$(cat .current.previous)             # target قبل از آخرین استقرار
ln -sfn "$OLD" current.tmp && mv -Tf current.tmp current
systemctl restart fast-english-pocketbase
curl -fsS http://127.0.0.1:8090/api/health
systemctl reload caddy
bash deploy/smoke-prod.sh --quick
```

قوانین:

- release قبلی هرگز حذف نمی‌شود؛
- `pb_data` در بازگشت دست‌نخورده می‌ماند؛
- اگر بخواهید از روی **پشتیبان پیش از استقرار** برگردید، بند ۹٫۵ را بخوانید و **هرگز** دیتابیس قدیمی را کورکورانه روی دادهٔ زنده بازیابی نکنید (بازیابی، تغییرات بعد از پشتیبان را از بین می‌برد).

---

## ۹. پشتیبان‌گیری و بازیابی

### ۹٫۱ سه لایهٔ پشتیبان

| لایه | کجا | نقش |
|---|---|---|
| دادهٔ زنده | `shared/pb_data` | دیتابیس فعال — این «پشتیبان» نیست |
| پشتیبان محلی | `pb_data/backups` + کپی در `shared/backups` | محافظت در برابر خرابی/بازیابی اشتباه دایرکتوری زنده |
| پشتیبان خارج از سرور | S3 (در صورت تأیید اعتبار) یا معادل مصوب | محافظت در برابر از دست رفتن خود سرور — **الزام Gate** |

### ۹٫۲ پشتیبان خودکار

- PocketBase: روزانه ۰۲:۳۰ UTC (`backups.cron`)، نگهداری ۱۴ (`cronMaxKeep`).
- کپی تأییدشده: تایمر `fast-english-backup-copy` ساعت ۰۲:۴۰ UTC — جدیدترین ۱۴ فایل ZIP در `shared/backups` (جدا از `pb_data`).
- یک ZIP پشتیبان = عکس فوری از `pb_data` (SQLite + فایل‌های آپلودی؛ پشتیبان‌ها و S3 خودکاراً حذف می‌شوند).

### ۹٫۳ پشتیبان دستی (تأییدشده)

```bash
bash deploy/backup.sh                 # نام پیش‌فرض fep-backup-<UTC>.zip
bash deploy/backup.sh my-name         # [a-z0-9_-]، .zip خودکار اضافه می‌شود
```

اسکریپت: اعتبارسنجی → ساخت پشتیبان از طریق API → بررسی وجود/غیرخالی بودن → بررسی وجود درخت `storage/` داخل ZIP → کپی به `shared/backups` + نگهداری ۱۴.

### ۹٫۴ آزمایش بازیابی (drill) — اثبات، نه ادعا

```bash
bash deploy/restore-drill.sh                # جدیدترین پشتیبان در shared/backups
bash deploy/restore-drill.sh <name-or-path> # پشتیبان مشخص
```

drill روی یک دایرکتوری موقت/دورریختنی اجرا می‌شود: بازیابی ZIP → اجرای همان باینری (۰٫۳۹٫۹) با مهاجرت‌ها و هوک‌های release فعلی → چک سلامت → احراز هویت سوپریوزر (باید موفق شود) → شمارش همهٔ مجموعه‌ها (فقط عدد، هرگز مقدار رکورد) → پاک‌سازی. **دادهٔ زنده هرگز لمس نمی‌شود.**

اثبات سطح رکورد (گیت): `pnpm smoke:restore-proof` — در محیط دورریختنی، زنجیرهٔ کامل (ثبت‌نام → درخواست پرداخت با فایل رسید → تأیید Staff → اشتراک → پیشرفت → تنظیمات) را ساخته، پشتیبان می‌گیرد، دایرکتوری را پاک می‌کند و بعد از بازیابی همان رکوردها/فایل رسید (sha256 یکسان) را تأیید می‌کند.

### ۹٫۵ بازیابی اضطراری تولید

```text
۱) توقف نوشتن‌ها:            systemctl stop fast-english-pocketbase
۲) کنار گذاشتن دادهٔ زنده (حذف نکنید):
     mv /opt/fast-english/shared/pb_data /opt/fast-english/shared/pb_data.broken-<ts>
۳) بازیابی ZIP در دایرکتوری تازه:
     mkdir /opt/fast-english/shared/pb_data
     unzip -q /opt/fast-english/shared/backups/<name>.zip -d /opt/fast-english/shared/pb_data
۴) مالکیت:                  chown -R fastenglish:fastenglish /opt/fast-english/shared/pb_data
۵) شروع:                    systemctl start fast-english-pocketbase
۶) سلامت:                   curl -fsS http://127.0.0.1:8090/api/health
۷) اسموک:                   bash deploy/smoke-prod.sh --quick
```

> ⚠️ **هشدار مطلق:** هرگز بازیابی مخرب را روی تنها دیتابیس زندهٔ تولید آزمایش نکنید. فقط روی نمونهٔ جداگانه (drill) یا بعد از تأیید drill برای همان پشتیبان مشخص.

> **پشتیبانِ هرگز بازیابی‌نشده، شواهد کافی نیست.** پشتیبان باید دوره‌ای (حداقل ماهانه) با `restore-drill.sh` اثبات شود.

---

## ۱۰. نظارت و سلامت

### ۱۰٫۱ ops-check.sh

```bash
bash deploy/ops-check.sh      # خروجی: 0 = سالم، 1 = هشدار، 2 = بحرانی
```

چه چیزهایی را بررسی می‌کند: فعال بودن سرویس‌های PocketBase و Caddy، تعداد ری‌استارت‌های PocketBase (بیش از ۱۰ = هشدار)، انقضای گواهی هر چهار دامنه (کمتر از ۱۴ روز = هشدار)، فضای دیسک (≥۷۵٪ هشدار، ≥۹۰٪ بحرانی)، تازگی پشتیبان (بیش از ۲۶ ساعت = بحرانی) و خطاهای پشتیبان در ژورنال ۴۸ ساعت، دیدن 5xx در لاگ‌های دسترسی، و سلامت `http://127.0.0.1:8090/api/health`.

### ۱۰٫۲ جدول «اگر این را دیدی → این کار را بکن»

| نشانه | معنی | اقدام (مسئول فنی) |
|---|---|---|
| PocketBase down | سرویس مرده/خطا | `journalctl -u fast-english-pocketbase -n 100` → علت را بیاب → `systemctl restart fast-english-pocketbase` → سلامت. اگر مهاجرت خطا داد: **قبل از شروع، لینک را rollback کن** (هرگز `pb_data` را حذف نکن) |
| Caddy down | سایت‌ها در دسترس نیستند | `systemctl status caddy` + `journalctl -u caddy -n 100` → `systemctl reload caddy`/restart |
| هشدار گواهی | کمتر از ۱۴ روز مانده | Caddy خودکار تمدید می‌کند؛ DNS و باز بودن پرت ۴۴۳ را چک کن (`dig`، `ss -tlnp`)؛ دایرکتوری `/var/lib/caddy` را هرگز حذف نکن |
| هشدار دیسک ≥۷۵٪ / بحرانی ≥۹۰٪ | فضا کم است | releaseهای قدیمی را حذف کن (فقط با حفظ قبلی برای rollback)، چرخش `shared/backups` و لاگ‌ها را بررسی کن |
| پشتیبان کهنه (>۲۶h) یا خطای پشتیبان | کرون/کپی از کار افتاده | `journalctl -u fast-english-pocketbase --since -48h \| grep -i backup` → `bash deploy/backup.sh` دستی → تایمر `systemctl list-timers fast-english-backup-copy` |
| 5xx در لاگ‌ها | خطای سرور | `grep '"status":5' shared/logs/access-*.log \| tail -50` → با زمان استقرارها همبستگی بده |
| شکست health endpoint | PocketBase پاسخ نمی‌دهد | `curl -fsS http://127.0.0.1:8090/api/health` → ژورنال → طبق بند «PocketBase down» |
| هشدار ری‌استارت زیاد | چرخهٔ crash | ژورنال را باز کن؛ علت را پیش از restart بیاب |

### ۱۰٫۳ ابزارهای فرمانی (فقط مسئول فنی)

```bash
systemctl status fast-english-pocketbase caddy
journalctl -u fast-english-pocketbase -n 100 --no-pager
journalctl -u caddy -n 100 --no-pager
curl -fsS http://127.0.0.1:8090/api/health          # سلامت محلی
curl -fsSI https://app.fastenglishpodcast.com/api/health   # سلامت عمومی
bash deploy/smoke-prod.sh [--quick]                 # اسموک کامل/سریع
bash deploy/backup.sh && bash deploy/restore-drill.sh
bash deploy/ops-check.sh
```

**محدودیت صادقانه:** هیچ پلتفرم مانیتورینگ مستقر نشده است (مصوب نشده). دید = systemd + journald + لاگ‌های چرخشی Caddy + `ops-check.sh`؛ هشداردهی دستی یا کرون است. کرون پیشنهادی:

```cron
17 6 * * * root bash /opt/fast-english/shared/scripts/ops-check.sh >> /var/log/fep-ops.log 2>&1
```

### ۱۰٫۴ توکن‌های صوتی در لاگ‌ها

توکن فایل صوتی در پارامتر `token` سفر می‌کند؛ هر بلوک لاگ دامنه، آن را با `[REDACTED]` جایگزین می‌کند و `log_credentials` روشن نیست. اثبات: `bash deploy/test-log-redaction.sh` + بررسی زندهٔ سرور (جستجوی مقدار جعلی در `shared/logs/access-app.log` باید صفر باشد).

---

## ۱۱. ایمنی سوپریوزر PocketBase

- دسترسی سوپریوزر = دسترسی ممتاز زیرساخت. **هرگز** با اپراتورهای عادی به اشتراک گذاشته نمی‌شود.
- داشبورد `/_/` از هر دامنهٔ عمومی ۴۰۴ می‌دهد (Caddy + اتصال loopback).
- مسیر امن (فقط شما):

```bash
ssh -L 8090:127.0.0.1:8090 <user>@<server>
# سپس در مرورگر خودتان: http://127.0.0.1:8090/_/
```

- تغییرات schema در تولید قفل است (`meta.hideControls=true` توسط `configure.sh`). مسیر عادی تغییرات: **مهاجرت‌های بازبینی‌شده در یک release**، نه ویرایش پراکنده در داشبورد.
- توصیه: whitelist آی‌پی سوپریوزر وقتی آی‌پی ثابت شما مشخص شد: `./pocketbase superuser ips <ip> --dir=…`.
- اگر سوپریوزر به خطر افتاد: چرخش رمز `FEP_SUPERUSER_PASSWORD` در فایل اسرار + ری‌استارت PocketBase.
- هرگز `pb_data` را در گیت یا خارج از سرور کپی نکنید؛ هرگز لاگ‌ها را عمومی نکنید.

---

## ۱۲. عملیات اندروید

### ۱۲٫۱ سطح کسب‌وکار (اپراتور/مالک)

| مورد | وضعیت فعلی (v1.0.0) |
|---|---|
| نام فایل | `fast-english-podcast-v1.0.0.apk` (تغییرناپذیر؛ نسخه‌های قبلی هرگز بازنویسی نمی‌شوند) |
| آدرس عمومی | `https://fastenglishpodcast.com/releases/fast-english-podcast-v1.0.0.apk` |
| متادیتا | `/releases/release-metadata.json` + `/releases/RELEASE-NOTES.md` |
| نسخهٔ لندینگ | باید با `VITE_ANDROID_APK_VERSION` هماهنگ باشد (چک خودکار) |
| گیت فیزیکی | **انجام نشده** — تست روی دستگاه فیزیکی (نصب، ورود، بارگذاری رسید، تعیین سطح، پخش/جستجو، حفظ پیشرفت پس از ری‌استارت) هنوز باز است |

### ۱۲٫۲ سطح فنی

- هویت: `com.fastenglishpodcast.app`؛ `versionName`/`versionCode` فعلاً ۱٫۰٫۰/۱ (در `android/app/build.gradle`).
- امضا: APK امضاشده با **کی‌استور تولید** (RSA 4096، طرح v2). کلیدها در گیت نیستند؛ از محیط می‌آیند: `FEP_ANDROID_KEYSTORE_PATH`، `FEP_ANDROID_KEY_ALIAS`، `FEP_ANDROID_KEYSTORE_PASSWORD`، `FEP_ANDROID_KEY_PASSWORD`. بدون آن‌ها بیلد با پیام «Production signing material: REQUIRED» **با خیال راحت شکست می‌خورد** — کی‌استور دیباگ هرگز منتشر نمی‌شود.
- منشأ API در APK: صریح `https://app.fastenglishpodcast.com` (نه `window.location.origin`).
- APK/AAB: خروجی توزیع APK است (فایل تغییرناپذیر با نام نسخه).

### ۱۲٫۳ ساخت نسخهٔ جدید

```bash
pnpm android:check:version        # هماهنگی gradle ↔ Capacitor ↔ نام APK ↔ نسخهٔ لندینگ
bash scripts/build-release-apk.sh       # نیاز به FEP_ANDROID_* (امضای تولید)
bash scripts/verify-release-apk.sh      # apksigner/zipalign/aapt/sha256sum + بازتولید متادیتا
```

روال نسخهٔ بعدی: `versionCode` (حداقل ۱+)/`versionName` را در gradle و `VITE_ANDROID_APK_VERSION` لندینگ زیاد کن → بیلد/تأیید (همان applicationId و همان گواهی امضا) → **نام فایل جدید** (مثلاً `v1.1.0.apk`) → APK + متادیتا در باندل بعدی → استقرار (`deploy.sh` چک‌سام APK و انتشار در `shared/releases` را خودکار انجام می‌دهد) → اسموک (طول محتوا + sha256 + CTA لندینگ) → تست دستگاه فیزیکی.

### ۱۲٫۴ چک‌لیست انتشار نسخهٔ اندروید

- [ ] versionCode افزایش یافته؛ versionName جدید؛ همان applicationId و گواهی
- [ ] `pnpm android:check:version` سبز
- [ ] بیلد امضاشده با کی‌استور تولید (نه دیباگ)
- [ ] `verify-release-apk.sh` سبز؛ متادیتا بازتولید شده
- [ ] نام فایل جدید و تغییرناپذیر؛ فایل قبلی دست‌نخورده
- [ ] لندینگ با URL/نسخهٔ جدید بیلد شده
- [ ] `deploy.sh` سبز (چک‌سام + انتشار + اسموک)
- [ ] `sha256sum` فایل دانلودی با `release-metadata.json` یکی است
- [ ] تست دستگاه فیزیکی (گیت باز تا انجام)
- [ ] کی‌استور و رمزها فقط در اختیار امن (هیچ‌وقت در گیت/لاگ/مستندات)

---

## ۱۳. متغیرهای محیطی و اسرار

نام‌ها (مقادیر فقط در `shared/secrets/pocketbase.env` یا محیط CI، هرگز در گیت/مستندات):

`FEP_SUPERUSER_EMAIL`، `FEP_SUPERUSER_PASSWORD`، `PB_ENCRYPTION_KEY`، `FEP_SMTP_HOST/PORT/USERNAME/PASSWORD/TLS`، `FEP_BACKUP_S3_*`، `FEP_SMOKE_STUDENT_*`، `FEP_SMOKE_OPERATOR_*`، `FEP_ANDROID_KEYSTORE_PATH`، `FEP_ANDROID_KEY_ALIAS`، `FEP_ANDROID_KEYSTORE_PASSWORD`، `FEP_ANDROID_KEY_PASSWORD`.

- فایل اسرار: root:root 0600؛ فقط root می‌خواند.
- `server/pb_data`، کی‌استورها و `releases/` در گیت نیستند.
- لاگ‌های دسترسی فقط root/Caddy می‌خوانند (`shared/logs` 0750).

---

## پیوست: وضعیت‌های باز (HUMAN INPUT REQUIRED)

این موارد هنوز انجام نشده‌اند و در هیچ‌کجای این مستندات «انجام‌شده» فرض نمی‌شوند:

- تهیهٔ سرور (VPS) + ثبت DNS هر چهار نام؛
- مقصد کارت‌به‌کارت واقعی و متن راهنمای آن؛
- بانک سؤال تعیین سطح بازبینی‌شده (دمو هرگز در تولید)؛
- کتابخانهٔ نهایی محتوا (بسته‌های فعلی نمونه/دمو هستند)؛
- متن حقوقی حریم خصوصی/قوانین؛
- نگهداری امن کی‌استور اندروید + تست دستگاه فیزیکی؛
- اعتبار S3 و تأیید بازیابی خارج از سرور؛
- هویت اپراتورها و سیاست رد/بازگشت وجه.
