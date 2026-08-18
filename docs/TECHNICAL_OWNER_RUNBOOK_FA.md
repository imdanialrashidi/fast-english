# راهنمای مسئول فنی — Fast English Podcast

> **مخاطب:** مسئول فنی / Technical Owner (مدیر سرور)
> **نسخه:** ۲٫۰ (دوران Coolify) — **آخرین به‌روزرسانی:** ۲۰۲۶-۰۸-۱۷
> این سند فقط برای شخصی است که به سرور، Coolify و ابزارهای استقرار دسترسی دارد. اپراتورهای عادی به دستورهای این سند نیاز ندارند و نباید آن‌ها را اجرا کنند — آن‌ها از پنل مدیریت (`admin.fastenglishpodcast.com`) کار می‌کنند.
> منبع اصلی انگلیسی/فنی: `docs/COOLIFY_DEPLOYMENT.md` (راهنمای رسمی و روزآمد استقرار). اسناد قدیمی `docs/DEPLOYMENT.md` و `deploy/deploy.sh` مربوط به معماری قبلی (Caddy + systemd) هستند و فقط به‌عنوان سابقهٔ تاریخی/بازگشت اضطراری نگهداری می‌شوند.

---

## فهرست

1. [نقش و مرزها](#۱-نقش-و-مرزها)
2. [توپولوژی تولید (Coolify)](#۲-توپولوژی-تولید-coolify)
3. [چیدمان سرور و دیتا](#۳-چیدمان-سرور-و-دیتا)
4. [چرا pb_data بیرون از کانتینر نگهداری می‌شود](#۴-چرا-pb_data-بیرون-از-کانتینر-نگهداری-میشود)
5. [نصب اول (تأمین سرور و اتصال به Coolify)](#۵-نصب-اول-تأمین-سرور-و-اتصال-به-coolify)
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

- به داشبورد Coolify و GitHub (محیط `production`) دسترسی دارد؛
- انتشارهای تولید را از طریق workflow دستی GitHub اجرا می‌کند؛
- پشتیبان‌گیری/بازیابی را تضمین می‌کند؛
- سوپریوزر PocketBase را فقط از طریق تانل SSH مدیریت می‌کند؛
- نسخهٔ اندروید را می‌سازد و منتشر می‌کند.

**خارج از دامنهٔ شما:** قیمت‌ها و تنظیمات کسب‌وکار (کار مالک در پنل مدیریت)، تصمیم‌های سیاستی (بازگشت وجه، نگهداشت رسید)، محتوای سرمقاله‌ای. اگر اپراتوری دستوری از این سند را می‌خواهد اجرا کند، این یک نشانهٔ خطر است.

---

## ۲. توپولوژی تولید (Coolify)

```text
توسعه‌دهنده                      مسئول فنی
   │  PR → merge → CI سبز          │  انتخاب exact commit
   ▼                               ▼
GitHub (گیت + کیفیت + بیلد ایمج)   │  workflow_dispatch دستی
   │  ایمج‌های تغییرناپذیر          │  (release-deploy)
   ▼  sha-<commit>                 ▼
GHCR (GitHub Container Registry) → Coolify Cloud (کنترل‌پلن)
                                     │  SSH به سرور خودتان
                                     ▼
                    سرور VPS شما (فقط 22/80/443 باز)
                    └─ Coolify-managed Traefik (یک لایهٔ پروکسی؛ TLS خودکار)
                         ├─ fastenglishpodcast.com       → Landing (nginx, ایمج)
                         ├─ www.fastenglishpodcast.com   → 308 به دامنهٔ اصلی
                         ├─ app.fastenglishpodcast.com   → Student App (nginx, ایمج)
                         │     └─ /api/* → PocketBase (مسیر داخلی)
                         ├─ admin.fastenglishpodcast.com → Admin Console (nginx, ایمج)
                         │     └─ /api/* → PocketBase (مسیر داخلی)
                         └─ PocketBase کانتینر (غیرroot، UID 10001)
                               ├─ /pb/pb_data  ← bind mount میزبان:
                               │      /opt/fast-english/shared/pb_data
                               ├─ مهاجرت‌ها + هوک‌ها + باینری داخل ایمج (تغییرناپذیر)
                               └─ دسترسی نگهداری: فقط 127.0.0.1:8090 (loopback)
```

نکته‌های حیاتی:

- **یک لایهٔ پروکسی:** Coolify-managed Traefik. Caddy بازنشسته شده است؛ نقش سرو کردن استاتیک داخل کانتینرهای nginx (`docker/*/nginx.conf`) است.
- PocketBase **هیچ پورت عمومی‌ای ندارد**؛ فقط شبکهٔ داخلی Coolify + نگاشت loopback `127.0.0.1:8090` برای اسکریپت‌های نگهداری.
- داشبورد سوپریوزر (`/_/`) روی همهٔ دامنه‌ها ۴۰۴ است.
- چهار سطح مستقل از هم استقرار می‌یابند؛ استقرار لندینگ/اپ/پنل **هیچ‌وقت** PocketBase را ری‌استارت نمی‌کند.
- CORS فقط برای دامنه‌های app/admin + منشأ Capacitor مجاز است.
- لاگ‌های nginx **بدون** کوئری‌استرینگ نوشته می‌شوند (توکن صوتی هرگز در لاگ نمی‌آید؛ اثبات: `bash deploy/test-nginx-log-redaction.sh`).

---

## ۳. چیدمان سرور و دیتا

```text
/opt/fast-english/
  shared/
    pb_data/        دادهٔ PocketBase (SQLite + فایل‌ها + پشتیبان‌های خودکار)
                    ← bind mount کانتینر؛ مالکیت UID/GID ثابت 10001
    backups/        کپی‌های تأییدشدهٔ پشتیبان (جدا از pb_data؛ ۱۴ نگهداری)
    releases/       APK عمومی + متادیتا (سرو می‌شود در /releases/* لندینگ)
    secrets/pocketbase.env   اسرار اپراتور — root:root 0600، هرگز در گیت
    scripts/fep-backup-copy.sh   (تایمر میزبان — مستقل از کانتینر)
```

- چهار ایمج تغییرناپذیر: `landing`، `app`، `admin`، `pocketbase` — همه از GHCR با تگ `sha-<commit>`؛ تگ `production` فقط یک نام مستعار مدیریت‌شده است و `latest` هرگز معتبر نیست.
- باینری PocketBase، مهاجرت‌ها و هوک‌ها **داخل ایمج** از همان commit ساخته می‌شوند (نسخه‌هماهنگ؛ `server/VERSION` = 0.39.9).
- کانتینر قبلی هرگز به‌طور خودکار `pb_data` را حذف/جایگزین نمی‌کند؛ Coolify فقط ایمج را عوض می‌کند.

---

## ۴. چرا pb_data بیرون از کانتینر نگهداری می‌شود

- کانتینرها دورریختنی‌اند: هر استقرار/بازگشت، کانتینر جدیدی می‌سازد. اگر داده داخل کانتینر بود، هر استقراری «دیتابیس دیگری» می‌ساخت.
- `pb_data` روی میزبان در `/opt/fast-english/shared/pb_data` با bind mount می‌ماند و مالکیت آن UID/GID ثابت 10001 است (ایمج با root اجرا نمی‌شود؛ خطای مالکیت با پیام واضح از ورود جلوگیری می‌کند).
- بازگشت فقط ایمج را عوض می‌کند و **هیچ‌وقت** `pb_data` را لمس نمی‌کند.
- پشتیبان‌های خودکار داخل `pb_data/backups` ساخته می‌شوند و کپی تأییدشده‌شان به `shared/backups` (بیرون از `pb_data`) می‌رود.

---

## ۵. نصب اول (تأمین سرور و اتصال به Coolify)

> جزئیات کامل و گام‌به‌گام: `docs/COOLIFY_DEPLOYMENT.md` §۵–§۹ (این بخش فقط خلاصهٔ اجرایی است).
> سرور واقعی هنوز تهیه نشده — این بخش برای فاز بعدی (Provisioning) است.

۱. **DNS:** چهار رکورد A به آی‌پی سرور (زمانی که سرور وجود دارد): `fastenglishpodcast.com`، `www`، `app`، `admin` (+ رکوردهای `staging*` برای محیط تست).
۲. **فایروال سرویس‌دهنده:** فقط ۲۲ (SSH محدود به آی‌پی‌های Coolify Cloud + آی‌پی شما)، ۸۰، ۴۴۳. پورت ۸۰۹۰ هرگز عمومی نیست.
۳. **Coolify Cloud → Servers → Connect:** سرور را با SSH متصل و تأیید کنید (Docker توسط Coolify نصب می‌شود).
۴. **آماده‌سازی میزبان (یک‌بار، به‌عنوان root):**

```bash
mkdir -p /opt/fast-english/shared/{pb_data,backups,releases,secrets}
chown -R 10001:10001 /opt/fast-english/shared/pb_data /opt/fast-english/shared/backups
chmod 700 /opt/fast-english/shared/secrets
# فایل اسرار: root:root 0600 (نام‌ها در deploy/env.production.example)
install -m 0600 /dev/stdin /opt/fast-english/shared/secrets/pocketbase.env <<'EOF'
FEP_SUPERUSER_EMAIL=<اینجا>
FEP_SUPERUSER_PASSWORD=<اینجا>
PB_ENCRYPTION_KEY=<اینجا>
EOF
```

۵. **چهار Application در Coolify بسازید** (نوع Docker Image؛ جزئیات دقیق هر اپ در `docs/COOLIFY_DEPLOYMENT.md` §۱۰): Landing، Student App، Admin، PocketBase — با دامنه‌ها، health checkها، mount ها و مقادیر env مطابق runbook. PocketBase فقط: storage bind mount + `PB_ENCRYPTION_KEY` در env اپ.
۶. **سوپریوزر:** بعد از اولین اجرای PocketBase: `docker exec <pb-container> /pb/pocketbase superuser upsert ... --encryptionEnv=PB_ENCRYPTION_KEY` (یا از طریق dashboard در تانل).
۷. `bash deploy/configure.sh` (تنظیمات رسمی: backups cron، hideControls، trustedProxy…) روی `127.0.0.1:8090` (loopback).
۸. `bash deploy/backup.sh` (پشتیبان اولیهٔ تأییدشده) + `bash deploy/restore-drill.sh`.
۹. دانه‌های کسب‌وکار (طرح‌ها، Staff Admin، مقصد کارت) — مطابق بخش ۵ سند قبلی و `docs/COOLIFY_DEPLOYMENT.md`.
۱۰. انتشار اول از طریق GitHub (بخش ۶).

> ⚠️ **الزام Gate:** مقصد پشتیبان خارج از سرور (S3 یا معادل تأییدشده) با آزمایش بازیابی تأیید شود.

---

## ۶. استقرار عادی نسخه‌های جدید

### جریان عادی (بدون SSH، از GitHub)

```text
کد → PR → CI سبز (quality) → merge → انتخاب exact commit در
GitHub → Actions → Deploy Production (release-deploy) →
بیلد ۴ ایمج در GHCR (sha-<commit>) → Coolify deploy → پایش وضعیت
→ health عمومی → smoke-prod → گزارش سبز/قرمز
```

مراحل دقیق برای مسئول فنی:

1. در GitHub: **Actions → Deploy Production (release-deploy) → Run workflow**.
2. ورودی `ref` = همان commit دلخواه (یا تگ)؛ سطوح (پیش‌فرض هر چهار)؛ حالت اسموک (`quick` = عمومی، `full` = با حساب‌های دورریختنی)؛ ورودی `environment` = `production` (پیش‌فرض) یا `staging` برای محیط تست.
   - در محیط `staging`، workflow اپ‌های Coolify استیجینگ را به تگ نامتغیر `sha-<commit>` پین می‌کند و **هرگز** alias تولید (`production`) را جابه‌جا نمی‌کند (ترکیب خطرناک همان‌جا رد می‌شود).
3. workflow ابتدا **وضعیت کیفیت** همان commit را چک می‌کند (quality سبز الزامی — CI قرمز هرگز تولید نمی‌شود)؛ سپس **گیت زیرساخت** (`pnpm test:infra:coolify`) را اجرا می‌کند (اثبات‌های persistence/بازیابی/مهاجرت/روتینگ/اسکن اسرار)؛ سپس ایمج‌ها را به GHCR می‌فرستد.
4. اگر تغییر، backend/مهاجرت باشد، **پشتیبان پیش از استقرار** به‌صورت خودکار روی سرور گرفته می‌شود (تنها موردی که SSH خودکار لازم است).
5. Coolify deploy + پایش تا `finished` + **health مستقل** + **smoke**؛ نتیجه در summary اعلام می‌شود.

> دستور محلی معادل گیت زیرساخت: `pnpm test:infra:coolify` (روی commit موردنظر).

### بازگشت سریع برای فرانت‌اند

فرانت‌اند خراب؟ همان workflow `rollback-deploy` با `image_sha` قبلی (فرانت‌اند = بدون ری‌استارت PocketBase).

---

## ۷. چه تغییری به چه نوع استقراری نیاز دارد

طبقه‌بندی خودکار در workflow از diff گیت استخراج می‌شود (A–E):

| نوع | معنی | رفتار استقرار |
|---|---|---|
| **A** | فقط Landing/Student/Admin (UI/CSS/JS) | بدون ری‌استارت PocketBase؛ بدون نیاز به پشتیبان صرفاً برای ظاهر |
| **B** | هوک‌های سرور/backend بدون مهاجرت | **پشتیبان پیش از استقرار** طبق سیاست؛ استقرار ایمج PocketBase؛ health + backend smoke |
| **C** | مهاجرت دیتابیس (فایل جدید در `pb_migrations`) | **پشتیبان تأییدشدهٔ پیش از استقرار اجباری**؛ هشدار سازگاری مهاجرت؛ بازگشت، مهاجرت را برنمی‌گرداند |
| **D** | پیکربندی/اسرار | به‌روزرسانی کنترل‌شدهٔ runtime؛ فقط سرویس مربوطه |
| **E** | اندروید | از طریق جریان کانتینر عادی مستقر نمی‌شود (بخش ۱۲) |

> اتوماسیون هرگز دربارهٔ مهاجرت‌های دیتابیس «فرض امن» نمی‌کند: هر تغییری در `server/pb_migrations` = نوع C.

---

## ۸. بازگشت به نسخهٔ قبل (Rollback)

### اصل اساسی

> **بازگشت اپلیکیشن ≠ بازگشت دیتابیس.**

- بازگشت نرم‌افزاری: ایمج قبلی (`sha-<commit>` شناخته‌شده) در Coolify → deploy → health → smoke. `pb_data` دست‌نخورده می‌ماند.
- بازگشت دیتابیس: مهاجرت‌های اجراشده **خودکار برنمی‌گردند** (ایمج قبلی شِما را برنمی‌گرداند؛ اثبات خودکار در `tests/infra/06-pb-migration.sh`). اگر release معیوب مهاجرت داشته باشد، مسیر درست **بازیابی از پشتیبان پیش از استقرار** است (بند ۹٫۵)، نه «مهاجرت معکوس» دستی.

### بازگشت خودکار در استقرار جدید

- Coolify فقط به کانتینر سالم مسیر می‌دهد (health check)؛ استقرار ناموفق در dashboard مشخص می‌شود.
- workflow «قرمز» می‌شود و راهنمای اقدام بعدی را می‌نویسد — **هرگز به‌طور خودکار بازیابی مخرب داده نمی‌کند.**

### بازگشت دستی

1. فرانت‌اند: GitHub → **rollback-deploy** → سطح + `image_sha` قبلی.
2. PocketBase بدون مهاجرت: همان workflow با سطح pocketbase (تأیید `confirm_migration_safe`).
3. PocketBase با مهاجرت: **ایست!** بازبینی سازگاری؛ در صورت نیاز بازیابی پشتیبان پیش از استقرار (بند ۹٫۵).

قوانین:

- `pb_data` در بازگشت دست‌نخورده می‌ماند؛ Coolify هرگز آن را حذف/جایگزین نمی‌کند.
- هرگز دیتابیس قدیمی را کورکورانه روی دادهٔ زنده بازیابی نکنید (بازیابی، تغییرات بعد از پشتیبان را از بین می‌برد).

---

## ۹. پشتیبان‌گیری و بازیابی

### ۹٫۱ سه لایهٔ پشتیبان (تغییر نکرده)

| لایه | کجا | نقش |
|---|---|---|
| دادهٔ زنده | `/opt/fast-english/shared/pb_data` | دیتابیس فعال — این «پشتیبان» نیست |
| پشتیبان محلی | `pb_data/backups` + کپی در `shared/backups` | محافظت در برابر خرابی/بازیابی اشتباه دایرکتوری زنده |
| پشتیبان خارج از سرور | S3 (پس از تأیید) یا معادل مصوب | محافظت در برابر از دست رفتن خود سرور — **الزام Gate** |

پشتیبان PocketBase «بومی» باقی می‌ماند (ZIP از `pb_data` شامل فایل‌های آپلودی/رسیدها)؛ پشتیبان عمومی Coolify برای دیتابیس‌هایش جایگزین آن نمی‌شود.

### ۹٫۲ پشتیبان خودکار

- PocketBase: روزانه ۰۲:۳۰ UTC (`backups.cron`)، نگهداری ۱۴ (`cronMaxKeep`) — داخل کانتینر.
- کپی تأییدشده: **تایمر میزبان** `fast-english-backup-copy` ساعت ۰۲:۴۰ UTC (systemd timer روی میزبان — مستقل از چرخهٔ زندگی کانتینرها؛ از هر استقراری جان به‌در می‌برد). جدیدترین ۱۴ فایل ZIP در `shared/backups`.
- خارج از سرور: از طریق تنظیمات S3 پاکت‌بیس (`configure.sh`).

### ۹٫۳ پشتیبان دستی (تأییدشده)

```bash
bash deploy/backup.sh                 # از طریق loopback 127.0.0.1:8090
bash deploy/backup.sh my-name
```

### ۹٫۴ آزمایش بازیابی (drill) — اثبات، نه ادعا

```bash
bash deploy/restore-drill.sh                # جدیدترین پشتیبان در shared/backups
bash deploy/restore-drill.sh <name-or-path>
```

drill روی دایرکتوری موقت اجرا می‌شود: بازیابی ZIP → همان باینری 0.39.9 با مهاجرت‌ها/هوک‌های **ریپو** (همان منابع ایمج) → سلامت → احراز سوپریوزر → شمارش مجموعه‌ها → پاک‌سازی. دادهٔ زنده هرگز لمس نمی‌شود.

اثبات سطح رکورد: `pnpm smoke:restore-proof` + `pnpm test:infra:coolify` (اثبات کامل «حذف کانتینر → ساخت دوباره» و «بازیابی در دایرکتوری کاملاً جدید»).

### ۹٫۵ بازیابی اضطراری تولید

```text
۱) از طریق Coolify کانتینر PocketBase را متوقف کن (یا scale به 0).
۲) دادهٔ زنده را کنار بگذار (حذف نکن):
     mv /opt/fast-english/shared/pb_data /opt/fast-english/shared/pb_data.broken-<ts>
۳) دایرکتوری تازه بساز و ZIP را بازیابی کن:
     mkdir /opt/fast-english/shared/pb_data
     unzip -q /opt/fast-english/shared/backups/<name>.zip -d /opt/fast-english/shared/pb_data
۴) مالکیت:                  chown -R 10001:10001 /opt/fast-english/shared/pb_data
۵) کانتینر را در Coolify دوباره شروع کن (همان ایمج).
۶) سلامت:                   curl -fsS http://127.0.0.1:8090/api/health
۷) اسموک:                   bash deploy/smoke-prod.sh --quick
```

> ⚠️ **هشدار مطلق:** هرگز بازیابی مخرب را روی تنها دیتابیس زندهٔ تولید آزمایش نکنید. فقط روی نمونهٔ جداگانه (drill) یا بعد از تأیید drill برای همان پشتیبان مشخص.
> **پشتیبانِ هرگز بازیابی‌نشده، شواهد کافی نیست.**

---

## ۱۰. نظارت و سلامت

### ۱۰٫۱ ops-check.sh

```bash
bash deploy/ops-check.sh      # خروجی: 0 = سالم، 1 = هشدار، 2 = بحرانی
```

چه چیزهایی را بررسی می‌کند (نسخهٔ Coolify): وضعیت کانتینر PocketBase (docker) + تعداد ری‌استارت، سلامت loopback و عمومی، گواهی هر چهار دامنه، فضای دیسک (≥۷۵٪ هشدار، ≥۹۰٪ بحرانی)، تازگی پشتیبان (>۲۶ ساعت = بحرانی) + خطاهای پشتیبان در لاگ کانتینر، دیدن 5xx در لاگ کانتینرهای فرانت‌اند، و (اختیاری) سطح API کولایفای.

### ۱۰٫۲ جدول «اگر این را دیدی → این کار را بکن»

| نشانه | معنی | اقدام (مسئول فنی) |
|---|---|---|
| `app/api/health` خطا | PocketBase پایین/مهاجرت خطا | داشبورد Coolify → وضعیت اپ PocketBase → لاگ کانتینر (`docker logs <pb-container>`) → علت را بیاب. اگر مهاجرت خطا داد: بازگشت ایمج ≠ رفع مهاجرت؛ بازیابی پشتیبان (۹٫۵). هرگز `pb_data` را حذف نکن |
| دامنه‌ها در دسترس نیستند | Traefik/Coolify | وضعیت پروکسی در Coolify؛ گواهی‌ها (DNS/پرت ۴۴۳)؛ `dig` هر چهار نام |
| هشدار گواهی | کمتر از ۱۴ روز مانده | Coolify/Traefik خودکار تمدید می‌کند؛ DNS و پرت ۴۴۳ را چک کن |
| هشدار دیسک ≥۷۵٪ / بحرانی ≥۹۰٪ | فضا کم است | چرخش `shared/backups` و لاگ‌ها؛ حجم docker را بررسی کن (`docker system df`) |
| پشتیبان کهنه (>۲۶h) | کرون/کپی از کار افتاده | `docker logs <pb-container> --since -48h \| grep -i backup` → `bash deploy/backup.sh` دستی → `systemctl list-timers fast-english-backup-copy` |
| 5xx در لاگ‌ها | خطای سرور | `docker logs <frontend-container> --tail 2000 \| grep '" 5'` → با زمان استقرارها همبستگی بده |
| ری‌استارت زیاد PocketBase | چرخهٔ crash | لاگ کانتینر را باز کن؛ علت را پیش از restart بیاب |

### ۱۰٫۳ ابزارهای فرمانی (فقط مسئول فنی)

```bash
docker ps | grep fast-english                 # وضعیت ۴ کانتینر
docker logs <pb-container> -n 100 --no-pager  # لاگ PocketBase
curl -fsS http://127.0.0.1:8090/api/health    # سلامت محلی (loopback)
curl -fsSI https://app.fastenglishpodcast.com/api/health   # سلامت عمومی
bash deploy/smoke-prod.sh [--quick]           # اسموک کامل/سریع
bash deploy/backup.sh && bash deploy/restore-drill.sh
bash deploy/ops-check.sh
bash deploy/test-nginx-log-redaction.sh       # اثبات حذف توکن از لاگ
```

**محدودیت صادقانه:** هیچ پلتفرم مانیتورینگ مستقر نشده است. دید = Coolify + لاگ‌های کانتینر + `ops-check.sh`؛ هشداردهی دستی یا کرون.

```cron
17 6 * * * root bash /opt/fast-english/shared/scripts/ops-check.sh >> /var/log/fep-ops.log 2>&1
```

### ۱۰٫۴ توکن‌های صوتی در لاگ‌ها

توکن فایل صوتی در پارامتر `token` سفر می‌کند. در معماری جدید: nginx فرانت‌اندها **هرگز کوئری‌استرینگ را لاگ نمی‌کند** (قوی‌تر از قبل)، لاگ دسترسی Traefik باید خاموش بماند (پیش‌فرض Coolify)، و لاگ داخلی PocketBase (فقط سوپریوزر، از طریق loopback، نگهداری ۳۰ روز) مانند گذشته است. اثبات: `bash deploy/test-nginx-log-redaction.sh`.

---

## ۱۱. ایمنی سوپریوزر PocketBase

- دسترسی سوپریوزر = دسترسی ممتاز زیرساخت. **هرگز** با اپراتورهای عادی به اشتراک گذاشته نمی‌شود.
- داشبورد `/_/` از هر دامنهٔ عمومی ۴۰۴ است.
- مسیر امن (فقط شما): تانل SSH به loopback سرور:

```bash
ssh -L 8090:127.0.0.1:8090 <user>@<server>
# سپس در مرورگر خودتان: http://127.0.0.1:8090/_/
```

- تغییرات schema در تولید قفل است (`meta.hideControls=true`). مسیر عادی تغییرات: **مهاجرت‌های بازبینی‌شده در یک release**.
- توصیه: whitelist آی‌پی سوپریوزر وقتی آی‌پی ثابت شما مشخص شد.
- اگر سوپریوزر به خطر افتاد: چرخش رمز `FEP_SUPERUSER_PASSWORD` در فایل اسرار + بازگشت‌دهی کانتینر PocketBase در Coolify + به‌روزرسانی اسرار GitHub.
- هرگز `pb_data` را در گیت یا خارج از سرور کپی نکنید؛ هرگز لاگ‌ها را عمومی نکنید.

---

## ۱۲. عملیات اندروید

(تغییر نکرده — جریان انتشار APK همان است؛ فقط انتشار فایل APK اکنون از طریق mount میزبان `shared/releases` در لندینگ انجام می‌شود، نه اسکریپت deploy قدیمی.)

### ۱۲٫۱ سطح کسب‌وکار (اپراتور/مالک)

| مورد | وضعیت فعلی (v1.0.0) |
|---|---|
| نام فایل | `fast-english-podcast-v1.0.0.apk` (تغییرناپذیر؛ نسخه‌های قبلی هرگز بازنویسی نمی‌شوند) |
| آدرس عمومی | `https://fastenglishpodcast.com/releases/fast-english-podcast-v1.0.0.apk` |
| متادیتا | `/releases/release-metadata.json` + `/releases/RELEASE-NOTES.md` |
| نسخهٔ لندینگ | باید با `VITE_ANDROID_APK_VERSION` هماهنگ باشد (چک خودکار) |
| گیت فیزیکی | **انجام نشده** — تست روی دستگاه فیزیکی هنوز باز است |

### ۱۲٫۲ سطح فنی

- هویت: `com.fastenglishpodcast.app`؛ `versionName`/`versionCode` فعلاً ۱٫۰٫۰/۱.
- امضا: APK امضاشده با کی‌استور تولید (RSA 4096، طرح v2). کلیدها در گیت نیستند؛ از محیط می‌آیند: `FEP_ANDROID_KEYSTORE_PATH`، `FEP_ANDROID_KEY_ALIAS`، `FEP_ANDROID_KEYSTORE_PASSWORD`، `FEP_ANDROID_KEY_PASSWORD`. بدون آن‌ها بیلد با خیال راحت شکست می‌خورد.
- منشأ API در APK: صریح `https://app.fastenglishpodcast.com`.

### ۱۲٫۳ ساخت نسخهٔ جدید

```bash
pnpm android:check:version
bash scripts/build-release-apk.sh       # نیاز به FEP_ANDROID_* (امضای تولید)
bash scripts/verify-release-apk.sh      # apksigner/zipalign/aapt/sha256sum + متادیتا
```

سپس فایل‌های APK + متادیتا را در `/opt/fast-english/shared/releases` میزبان قرار بده (نام فایل جدید و تغییرناپذیر) و لندینگ را با URL/نسخهٔ جدید از طریق جریان عادی (بخش ۶) منتشر کن. اسموک، چک‌سام و CTA لندینگ را تأیید می‌کند.

### ۱۲٫۴ چک‌لیست انتشار نسخهٔ اندروید

- [ ] versionCode افزایش یافته؛ versionName جدید؛ همان applicationId و گواهی
- [ ] `pnpm android:check:version` سبز
- [ ] بیلد امضاشده با کی‌استور تولید (نه دیباگ)
- [ ] `verify-release-apk.sh` سبز؛ متادیتا بازتولید شده
- [ ] نام فایل جدید و تغییرناپذیر؛ فایل قبلی دست‌نخورده
- [ ] لندینگ با URL/نسخهٔ جدید بیلد و منتشر شده (جریان Coolify)
- [ ] اسموک سبز (چک‌سام + انتشار + CTA)
- [ ] `sha256sum` فایل دانلودی با `release-metadata.json` یکی است
- [ ] تست دستگاه فیزیکی (گیت باز تا انجام)
- [ ] کی‌استور و رمزها فقط در اختیار امن

---

## ۱۳. متغیرهای محیطی و اسرار

نام‌ها (مقادیر هرگز در گیت/مستندات):

- فایل اسرار سرور (`shared/secrets/pocketbase.env`، root:root 0600): `FEP_SUPERUSER_EMAIL`، `FEP_SUPERUSER_PASSWORD`، `PB_ENCRYPTION_KEY`، `FEP_SMTP_*`، `FEP_BACKUP_S3_*`، `FEP_SMOKE_*`.
- اسرار GitHub Environment «production» (فقط نام‌ها در `deploy/env.production.example`): `COOLIFY_BASE_URL`، `COOLIFY_API_TOKEN` (محدود به deploy؛ چرخش با MFA)، `COOLIFY_APP_UUID_{LANDING,APP,ADMIN,POCKETBASE}`، `GHCR_PUBLISH_TOKEN` (اختیاری)، `FEP_SSH_HOST/USER/KEY` (فقط برای پشتیبان پیش از استقرار)، `FEP_SMOKE_STAFF_*`، `FEP_SUPERUSER_EMAIL/PASSWORD` (آینهٔ سرور).
- env اپ PocketBase در Coolify: `PB_ENCRYPTION_KEY` — **باید با فایل سرور یکی باشد** (هر دو را با هم بچرخان).
- `VITE_*` تنظیمات build-time: در GitHub Actions (یا پیش‌فرض‌های تولید)، هرگز در Coolify.
- `server/pb_data`، کی‌استورها و `releases/` در گیت نیستند.

---

## پیوست: وضعیت‌های باز (HUMAN INPUT REQUIRED)

این موارد هنوز انجام نشده‌اند و در هیچ‌کجای این مستندات «انجام‌شده» فرض نمی‌شوند:

- تهیهٔ سرور VPS (تولید + استقرار) + اتصال به Coolify Cloud + اجرای چک‌لیست پذیرش استیجینگ (`docs/STAGING.md`)؛
- ثبت DNS هر چهار نام (و دامنه‌های استیجینگ)؛
- مقصد کارت‌به‌کارت واقعی و متن راهنمای آن؛
- بانک سؤال تعیین سطح بازبینی‌شده (دمو هرگز در تولید)؛
- کتابخانهٔ نهایی محتوا (بسته‌های فعلی نمونه/دمو هستند)؛
- متن حقوقی حریم خصوصی/قوانین؛
- نگهداری امن کی‌استور اندروید + تست دستگاه فیزیکی؛
- اعتبار S3 و تأیید بازیابی خارج از سرور؛
- هویت اپراتورها و سیاست رد/بازگشت وجه؛
- تأیید زندهٔ نقاط باز Coolify (loopback mapping، path routing، rollback با ایمج GHCR) در استیجینگ — فهرست کامل در `docs/COOLIFY_DEPLOYMENT.md`.
