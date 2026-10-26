# Staging Checklist — چک‌لیست استیجینگ (S9b, owner-run)

Owner executes every step in Coolify and on the staging host. The agent
does not call Coolify, the staging host, or any remote service.
This file contains names and placeholders only — no secrets, no real
values, no payment data. Fill real results in `STAGING_EVIDENCE.md`.

مالک همه مراحل را در Coolify و روی هاست استیجینگ اجرا می‌کند. ایجنت
هیچ تماسی با Coolify یا هاست نمی‌گیرد. این فایل فقط نام و placeholder
دارد — بدون secret و بدون مقدار واقعی. نتایج واقعی در
`STAGING_EVIDENCE.md` ثبت می‌شود.

Scope: scope §§18–19, AC-19/20/21/22. Plan: S9b-1…S9b-6 UNPROVEN until
the owner completes `STAGING_EVIDENCE.md`.

Conventions / قراردادها:
- `<STAGING_DOMAIN>` — owner HTTPS origin (e.g. staging host name).
- `<STAGING_URL>` — `https://<STAGING_DOMAIN>`.
- `<DB_ROLE>`, `<DB_NAME>`, `<BACKUP_PATH>`, `<DUMP_FILE>` — names only.
- `<LESSON_ID>`, `<REQUEST_ID>` — IDs observed on staging.
- `<OWNER_COOKIE>`, `<OTHER_COOKIE>` — session cookies of two staging
  accounts (obtained via real login in a browser, never pasted here).
- Placeholders look like `<LIKE_THIS>`. If a step shows a real value,
  stop and redact before continuing.

---

## A. Coolify staging deploy / استقرار استیجینگ در Coolify

> Deploy path — مسیر استقرار: the Compose stack (`compose.prod.yml`) replaces
> A1 (database resource) and A5 (mounts) with one Docker Compose resource
> (app + PostgreSQL 17 + named volumes). Every other check below still
> applies. مسیر Compose جای A1 و A5 را می‌گیرد؛ بقیه بررسی‌ها بدون تغییر است.

### A1. PostgreSQL 17 resource / منبع PostgreSQL 17
- EN: Create one PostgreSQL 17 service on the Coolify internal network.
  No public port. The application reaches it only via the internal
  hostname.
- FA: یک سرویس PostgreSQL 17 در شبکه داخلی Coolify بسازید. پورت عمومی
  ندهید. اپ فقط با hostname داخلی به آن وصل می‌شود.
- Expected / نتیجه موردانتظار: service status healthy; `pg_dump --version`
  inside the app container reports 17.x.
- Fail action / اقدام خرابی: do not continue; fix the service in Coolify
  and re-check. ادامه ندهید؛ سرویس را اصلاح و دوباره بررسی کنید.

### A2. Application from the Dockerfile at the chosen commit / اپ از Dockerfile در کامیت منتخب
- EN: Create a Coolify application of type Dockerfile at repository root
  (`Dockerfile`, not `Dockerfile.pi`). Deploy the exact commit recorded in
  `STAGING_EVIDENCE.md` (field: commit SHA). Rebuild on every commit
  change; never mix code from another revision.
- FA: یک اپلیکیشن Coolify از نوع Dockerfile در ریشه مخزن بسازید
  (`Dockerfile`، نه `Dockerfile.pi`). دقیقاً همان کامیتی را deploy کنید
  که در `STAGING_EVIDENCE.md` ثبت شده (فیلد commit SHA). با هر تغییر
  کامیت دوباره build بگیرید؛ کد revision دیگر را قاطی نکنید.
- Expected: build log shows stages `node:22.23.2`, `php:8.4.26-cli`,
  runtime `php:8.4.26-fpm`; container user `www-data`; port `8080`.
- Fail action: stop; compare the deployed SHA with the recorded SHA and
  rebuild from the recorded commit. توقف؛ SHA مستقر را با SHA ثبت‌شده
  مقایسه و از همان کامیت rebuild کنید.

### A3. Environment variables / متغیرهای محیطی
- EN: Set every name in `docs/ops/COOLIFY.md` §3 in the Coolify env /
  secret store. Staging values: `APP_ENV=staging`, `APP_DEBUG=false`,
  `SESSION_SECURE_COOKIE=true`, `LOG_CHANNEL=stderr`, `LOG_STACK=stderr`,
  `SALES_ENABLED=false` (keep off until §25 inputs exist),
  `DB_CONNECTION=pgsql`, `SESSION_DRIVER=database`,
  `QUEUE_CONNECTION=database`, `CACHE_STORE=database`,
  `FILESYSTEM_DISK=local`. `APP_URL` must equal `<STAGING_URL>`.
  Secrets (`APP_KEY`, `DB_PASSWORD`, SMTP password, TWA fingerprint) live
  only in the Coolify secret store, never in the repo.
- FA: همه نام‌های بخش ۳ `COOLIFY.md` را در env/secret store کوليفای
  بگذارید. مقادیر استیجینگ: `APP_ENV=staging`، `APP_DEBUG=false`،
  `SESSION_SECURE_COOKIE=true`، لاگ `stderr`، `SALES_ENABLED=false`
  (تا ورودی‌های §25 نیامده خاموش بماند). `APP_URL` باید دقیقاً
  `<STAGING_URL>` باشد. secretها فقط در secret store کوليفای‌اند، نه در مخزن.
- Expected: `php artisan about` inside the container shows
  Environment `staging`, Debug OFF; no secret printed by `ops:status`.
- Fail action: fix the variable in Coolify and redeploy. متغیر را اصلاح و
  redeploy کنید.

### A4. Persistent mounts / مانت‌های ماندگار
- EN: Mount `storage/app/private` (audio `lessons/*.mp3` + receipts
  `receipts/*`) and `storage/app/public` (covers `covers/*`)
  persistently. Logs go to `stderr` (no file mount needed).
- FA: مسیرهای `storage/app/private` (صوت و رسیدها) و
  `storage/app/public` (کاورها) را ماندگار mount کنید. لاگ‌ها به
  `stderr` می‌روند (mount فایل لازم نیست).
- Expected: upload one cover + one receipt on staging, restart the app,
  both files still served with identical bytes.
- Fail action: fix the mount paths in Coolify and re-test. مسیرها را
  اصلاح و دوباره تست کنید.

### A5. Domain and HTTPS / دامنه و HTTPS
- EN: Attach `<STAGING_DOMAIN>` in Coolify; let Coolify own TLS + HTTPS
  redirect. `APP_URL` must match the public HTTPS origin. Laravel trusts
  the proxy (`bootstrap/app.php`) so it sees HTTPS via `X-Forwarded-Proto`.
- FA: دامنه `<STAGING_DOMAIN>` را در Coolify وصل کنید؛ TLS و ریدایرکت
  HTTPS با Coolify است. `APP_URL` باید همان origin عمومی HTTPS باشد.
- Expected: `http://<STAGING_DOMAIN>` redirects to
  `https://<STAGING_DOMAIN>`; response header `Set-Cookie` contains
  `Secure`.
- Fail action: fix domain/TLS in Coolify; do not set
  `SESSION_SECURE_COOKIE=true` on plain HTTP. دامنه/TLS را اصلاح کنید.

### A6. Health check / بررسی سلامت
- EN: Coolify health check: `GET http://<host>:8080/up` expects 200 with
  a minimal body (status only, no version/env/secret/trace).
- FA: هلث‌چک Coolify: درخواست `GET` به `/up` باید ۲۰۰ با بدنه حداقلی
  بدهد (فقط status، بدون version/env/secret/trace).
- Command (staging host shell):
  `curl -i <STAGING_URL>/up`
- Expected: `200`, no `APP_KEY`/`DB_PASSWORD`/version/trace in body.
- Fail action: inspect container logs (stderr driver) and redeploy.
  لاگ کانتینر را ببینید و redeploy کنید.

### A7. Cron for schedule:work / کرون برای schedule:work
- EN: `schedule:work` and `queue:work` run under supervisord inside the
  image (no separate cron needed). Confirm both processes are alive and
  the retention jobs are scheduled.
- FA: فرایندهای `schedule:work` و `queue:work` داخل ایمیج با supervisord
  اجرا می‌شوند (کرون جدا لازم نیست). زنده‌بودن هر دو و زمان‌بندی
  jobهای retention را تأیید کنید.
- Commands:
  `php artisan schedule:list`
  `php artisan queue:work --help | head -n 5`
- Expected: `schedule:list` contains `receipts:retain-reviewed` and
  `receipts:cleanup` (daily); both worker processes appear in the
  container process list.
- Fail action: restart the app in Coolify; if still missing, redeploy
  from the recorded commit. اپ را restart کنید؛ اگر درست نشد redeploy.

### A8. Backup job / جاب بکاپ
- EN: Create one Coolify scheduled task (nightly) that runs the backup
  checklist in §C below (database `pg_dump -Fc` + private-files snapshot
  + minimal config with names, not values). Keep one encrypted copy off
  the host; rotation ≤ 30 days (proposal).
- FA: یک تسک زمان‌بندی‌شده شبانه در Coolify بسازید که چک‌لیست بکاپ بخش
  C را اجرا کند (بکاپ دیتابیس + فایل‌های private + کانفیگ حداقلی بدون
  مقدار). یک نسخه رمزنگاری‌شده خارج از هاست نگه دارید؛ چرخش حداکثر ۳۰ روز.
- Expected: the task runs once on demand with exit 0 and produces a
  timestamped dump + file snapshot (see §C pass criteria).
- Fail action: fix the task command/mount in Coolify and re-run on
  demand. دستور/mount تسک را اصلاح و دوباره اجرا کنید.

---

## B. Verification on the staging host / راستی‌آزمایی روی هاست استیجینگ

Run in order. Every command uses placeholders — replace only on the
staging host shell, never commit the filled values.
به‌ترتیب اجرا کنید. همه دستورها placeholder دارند — فقط در شل استیجینگ
جایگزین کنید و مقادیر پرشده را commit نکنید.

### B1. Migrate (once, after a fresh backup) / مایگریت (یک‌بار، پس از بکاپ تازه)
- EN: Migrations NEVER run on container start. Run one explicit migrate
  after the §C backup.
- FA: مایگریشن هرگز هنگام start کانتینر اجرا نمی‌شود. فقط یک‌بار پس از
  بکاپ بخش C اجرا کنید.
- Command: `php artisan migrate --force`
- Expected: exit 0; `php artisan migrate:status` shows all `Ran`.
- Fail action: restore the §C backup and investigate; do not retry blindly.
  بکاپ را restore و بررسی کنید؛ کورکورانه retry نکنید.

### B2. Staging-only seeders / سیدرهای مخصوص استیجینگ
- EN: Fixture seeders refuse `production` and allow `staging`
  (`APP_ENV=staging`). Seed labelled fixtures only.
- FA: سیدرهای fixture در `production` خطا می‌دهند و در `staging` مجازند.
  فقط fixtureهای برچسب‌دار را seed کنید.
- Commands (each separately, verify after each):
  `php artisan db:seed --class=S1SampleSeeder --force`
  `php artisan db:seed --class=S3SampleSeeder --force`
  `php artisan db:seed --class=S5PaymentFixtureSeeder --force`
  `php artisan db:seed --class=S7PlacementFixtureSeeder --force`
- Expected: each exits 0 on staging; the same commands with
  `APP_ENV=production` refuse with `refuses to run in production`.
  Never run seeders against the production database.
- Fail action: confirm `APP_ENV=staging`; if a seeder refuses, do not
  force it — record the message. `APP_ENV` را بررسی کنید؛ seed را force نکنید.

### B3. Audio Range and HEAD checks / بررسی Range و HEAD صوت
- EN: Private audio serves bytes with Range after the policy check.
- FA: صوت خصوصی پس از بررسی policy با Range سرو می‌شود.
- Commands:
  `curl -i <STAGING_URL>/media/lessons/<LESSON_ID>/audio`
  `curl -i -H "Range: bytes=0-99" <STAGING_URL>/media/lessons/<LESSON_ID>/audio`
  `curl -i -X HEAD <STAGING_URL>/media/lessons/<LESSON_ID>/audio`
  `curl -i -H "Range: bytes=999999999-1000000000" <STAGING_URL>/media/lessons/<LESSON_ID>/audio`
- Expected: `200` + `Accept-Ranges: bytes` + `Cache-Control: private, no-store`;
  `206` + exact `Content-Range: bytes 0-99/<SIZE>`; `HEAD 200` with
  headers and empty body; unsatisfiable range `416` +
  `Content-Range: bytes */<SIZE>`.
- Fail action: check app logs + nginx `/_private/` config; re-test one
  range at a time. لاگ و کانفیگ nginx را بررسی کنید.

### B4. X-Accel internal 404 check / بررسی 404 مسیر داخلی X-Accel
- EN: The nginx internal location must never serve externally.
- FA: مسیر داخلی nginx هرگز نباید مستقیم از بیرون سرو شود.
- Command: `curl -i <STAGING_URL>/_private/lessons/<FILE>.mp3`
- Expected: `404` (because of nginx `internal`).
- Fail action: fix `docker/nginx.conf` location block and redeploy.
  بلاک location را اصلاح و redeploy کنید.

### B5. Receipt owner vs other-student checks / بررسی رسید مالک در برابر دانش‌آموز دیگر
- EN: Owner gets bytes with no-store; another student gets 403; guests
  are redirected to login. No receipt path appears in public HTML.
- FA: مالک بایت‌ها را با no-store می‌گیرد؛ دانش‌آموز دیگر 403؛ مهمان به
  login هدایت می‌شود. هیچ مسیر رسیدی در HTML عمومی نیست.
- Commands (cookies from two real browser logins):
  `curl -i --cookie "<OWNER_COOKIE>" <STAGING_URL>/media/payment-requests/<REQUEST_ID>/receipt`
  `curl -i --cookie "<OTHER_COOKIE>" <STAGING_URL>/media/payment-requests/<REQUEST_ID>/receipt`
  `curl -i <STAGING_URL>/media/payment-requests/<REQUEST_ID>/receipt`
- Expected: owner `200` + `private, no-store`; other student `403`;
  guest redirect to login. Library HTML for both users contains no
  `receipt_path` / `receipts/` string.
- Fail action: check `PaymentRequestPolicy` + gateway; do not expose the
  file publicly. policy را بررسی کنید؛ فایل را عمومی نکنید.

### B6. Password-reset neutral response with SMTP unset / پاسخ خنثی بازیابی رمز با SMTP تنظیم‌نشده
- EN: With `MAIL_MAILER=log` (or any non-`smtp` / empty host) on staging
  rehearsing the production guard, both known and unknown emails get the
  byte-identical neutral Persian message, nothing is sent, no token row
  is stored, nothing is logged.
- FA: با SMTP تنظیم‌نشده، ایمیل معلوم و نامعلوم دقیقاً همان پیام خنثی
  فارسی را می‌گیرند؛ چیزی ارسال و ذخیره و لاگ نمی‌شود.
- Commands:
  `curl -i -X POST <STAGING_URL>/forgot-password --data "email=<KNOWN_EMAIL>"`
  `curl -i -X POST <STAGING_URL>/forgot-password --data "email=<UNKNOWN_EMAIL>"`
  then: `php artisan tinker --execute="echo DB::table('password_reset_tokens')->count();"`
- Expected: both responses carry the identical status message
  `اگر حسابی با این ایمیل وجود داشته باشد، پیوند بازیابی ارسال شد.`;
  token count unchanged (0 new rows); no reset email in logs.
- Fail action: confirm `MAIL_MAILER`/`MAIL_HOST` values; do not enable
  real SMTP without owner credentials. مقادیر SMTP را بررسی کنید.

### B7. Sales-off check / بررسی خاموش‌بودن فروش
- EN: `SALES_ENABLED=false` on staging until §25 inputs exist.
- FA: تا ورودی‌های §25 نیامده، `SALES_ENABLED=false` بماند.
- Commands:
  `curl -s <STAGING_URL>/ | grep -c "در دست آماده‌سازی"`
  `curl -i -X POST <STAGING_URL>/app/payments --cookie "<OWNER_COOKIE>" --data "plan_id=<PLAN_ID>"`
- Expected: landing shows `در دست آماده‌سازی`; creation is refused
  server-side with nothing stored (row count unchanged).
- Fail action: set `SALES_ENABLED=false` in Coolify and redeploy; never
  sell with fixture prices. در Coolify خاموش و redeploy کنید.

### B8. Health check (repeat after all above) / هلث‌چک (تکرار پس از همه موارد)
- Command: `curl -f <STAGING_URL>/up`
- Expected: `200`, minimal body, no secret/version/trace.
- Fail action: collect `ops:status` + container logs and report.
  خروجی `ops:status` و لاگ را جمع و گزارش کنید.

---

## C. Backup and restore checklist (Coolify, owner-run) / چک‌لیست بکاپ و restore

Do not run from the agent. Exact commands with pass criteria.
از ایجنت اجرا نشود. دستورهای دقیق با معیار قبولی.

### C1. One backup run / یک‌بار اجرای بکاپ
- Commands (staging host / Coolify task shell):
  `pg_dump -U <DB_ROLE> -Fc <DB_NAME> -f <BACKUP_PATH>/<DUMP_FILE>.dump`
  `tar -czf <BACKUP_PATH>/private-files-<DATE>.tar.gz -C storage/app/private .`
  `ls -lh <BACKUP_PATH>/`
- Expected: both artifacts exist, non-empty, timestamped; `pg_dump`
  exit 0. Record byte sizes in `STAGING_EVIDENCE.md`.
- Fail action: fix DB role/mount in the Coolify task and re-run on
  demand. role/mount را اصلاح و دوباره اجرا کنید.

### C2. Restore into an empty database / restore در دیتابیس خالی
- Commands:
  `createdb -U <DB_ROLE> <EMPTY_DB>`
  `pg_restore -U <DB_ROLE> -d <EMPTY_DB> <BACKUP_PATH>/<DUMP_FILE>.dump`
  then point a throwaway staging copy at `<EMPTY_DB>` (env override on a
  stopped review container, never the live staging DB) and run:
  `curl -i -X POST <COPY_URL>/login --data "email=<STAGING_USER>&password=<STAGING_PASSWORD>"`
  (expect `302`), then with that session cookie:
  `curl -i --cookie "<COPY_COOKIE>" <COPY_URL>/app/account` (expect `200`)
  `curl -i --cookie "<COPY_COOKIE>" <COPY_URL>/media/lessons/<LESSON_ID>/audio` (expect `200`, record byte size)
  `curl -i --cookie "<COPY_COOKIE>" <COPY_URL>/media/payment-requests/<REQUEST_ID>/receipt` (expect `200` with bytes, or `404` when `receipt_deleted_at` is set)
- Expected: counts match the source (`users`, `lessons`,
  `payment_requests`); login `302 → 200`; audio byte size equals the
  source size; receipt row + file present (or correctly `404` after
  retention). Record every number in `STAGING_EVIDENCE.md`.
- Fail action: keep the live staging untouched; drop `<EMPTY_DB>`,
  re-take the backup, and investigate. استیجینگ زنده را دست نزنید.

### C3. Retention after restore / retention پس از restore
- Command: `php artisan receipts:retain-reviewed --dry-run`
  then (only on the restored copy): `php artisan receipts:retain-reviewed`
- Expected: dry-run lists only > 90-day reviewed/cancelled files;
  pending receipts never listed; second run idempotent.
- Fail action: do not run on live staging until the copy behaves.
  تا رفتار روی کپی درست نشده، روی استیجینگ زنده اجرا نکنید.

---

## D. First three steps for the owner / سه قدم اول مالک

1. Deploy the recorded commit in Coolify (§A1–A6) and record commit SHA,
   image tag, domain, and `/up` result in `STAGING_EVIDENCE.md`.
   کامیت ثبت‌شده را در Coolify مستقر کنید (§A1–A6) و SHA، تگ ایمیج،
   دامنه و نتیجه `/up` را در `STAGING_EVIDENCE.md` ثبت کنید.
2. Run backup once + restore into an empty DB (§C) and record sizes and
   counts. بکاپ را یک‌بار اجرا و در دیتابیس خالی restore کنید (§C) و
   اندازه‌ها و تعدادها را ثبت کنید.
3. Complete the device matrix (`DEVICE_MATRIX.md`) on the three required
   devices and send back the filled `STAGING_EVIDENCE.md`.
   ماتریس دستگاه را روی سه دستگاه الزامی کامل کنید (`DEVICE_MATRIX.md`)
   و `STAGING_EVIDENCE.md` پرشده را برگردانید.

What to send back / چه چیزی برگردانید: the filled `STAGING_EVIDENCE.md`
(commit, image tag, host, domain, date, every check result) + the three
filled device rows + backup sizes/counts.
`STAGING_EVIDENCE.md` پرشده (کامیت، تگ ایمیج، هاست، دامنه، تاریخ، نتیجه
هر بررسی) + سه ردیف پرشده دستگاه + اندازه‌ها و تعدادهای بکاپ.
