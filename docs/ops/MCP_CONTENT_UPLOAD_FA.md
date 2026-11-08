# راهنمای آپلود محتوا با Agent (MCP)

این راهنما برای مالک/اپراتور است و توضیح می‌دهد چطور یک عامل هوش مصنوعی از طریق MCP دسته، مطلب، درس، صوت و کاور را داخل Fast English بسازد. مسیر اصلی و همهٔ محدودیت‌های محتوایی همان [راهنمای آپلود پنل](CONTENT_UPLOAD_FA.md) است؛ این سند فقط لایهٔ Agent را اضافه می‌کند.

- آدرس سرور: `POST https://fastenglishpodcast.ir/mcp/content`
- آدرس آپلود فایل: `PUT https://fastenglishpodcast.ir/mcp/uploads/{upload_id}`
- احراز هویت: توکن Bearer کارکنان، فقط با دسترسی شل سرور قابل صدور است.
- پیش‌نیاز: migration جدول `mcp_tokens` روی محیط مقصد اجرا شده باشد (`sh docker/release.sh`).

## ۱. چه چیزی امن است و چه چیزی نیست

- توکن MCP به‌اندازهٔ دسترسی محتوایی همان حساب کارکنان است. آن را در چت، ایمیل، اسکرین‌شات یا لاگ نگذارید.
- توکن به‌صورت hash ذخیره می‌شود؛ متن اصلی فقط یک بار هنگام صدور نشان داده می‌شود.
- 2FA تعاملی روی MCP اعمال نمی‌شود؛ توکن جای نشست مرورگر را نمی‌گیرد. برای همین فقط از طریق شل سرور صادر می‌شود و باید کوتاه‌عمر و قابل ابطال باشد.
- ابزارهای نوشتن فقط **draft** می‌سازند یا ویرایش می‌کنند. محتوای منتشرشده یا آرشیوشده از طریق MCP قابل ویرایش نیست؛ اول Archive، بعد Return to draft، بعد ویرایش و انتشار دوباره (نیازمند ability `content:publish`) — یا ویرایش در `/admin`.
- `content:publish` را فقط وقتی بدهید که می‌خواهید عامل بتواند وضعیت انتشار را عوض کند. پیش‌فرض صدور توکن بدون این ability است.
- انتشار هر درس **draft** با `confirm_review=true` یعنی «من، صاحب توکن، متن و صوت همین draft را بررسی کرده‌ام». این پرچم مالک توکن را به‌عنوان reviewer با زمان فعلی ثبت می‌کند و بدون آن انتشار draft رد می‌شود. publish تکراری یک درس منتشرشده no-op است و این پرچم را لازم ندارد. هر ویرایش محتوای draft، review قبلی را پاک می‌کند تا تأیید قدیمی روی متن/صوت تازه استفاده نشود.
- فایل‌های آپلودی روی دیسک خصوصی مرحله‌بندی می‌شوند، توکن آپلود یک‌بارمصرف است و فایل‌های رهاشده هر ۱۵ دقیقه پاک می‌شوند.

## ۲. ساخت حساب و توکن

اگر حساب اپراتور هنوز ساخته نشده:

```bash
php artisan staff:bootstrap ops@example.com \
  --name="Content Ops" --by="owner" --password="<strong-password>"
```

توکن فقط از داخل سرور/کانتینر صادر می‌شود:

```bash
# عامل فقط می‌خواند و draft می‌سازد/به‌روزرسانی می‌کند
php artisan mcp:token issue \
  --name="Content Agent" \
  --email="ops@example.com" \
  --abilities="content:read,content:write" \
  --days=90

# فقط وقتی می‌خواهید عامل publish/archive هم بکند
php artisan mcp:token issue \
  --name="Publisher Agent" \
  --email="ops@example.com" \
  --abilities="content:read,content:write,content:publish" \
  --days=30
```

خروجی یک خط `femcp_...` دارد. همان را در تنظیمات کلاینت بگذارید؛ دیگر نمایش داده نمی‌شود.

مدیریت توکن‌ها:

```bash
php artisan mcp:token list
php artisan mcp:token revoke --id=3
```

- `--days` بین ۱ تا ۳۶۵ است؛ پیش‌فرض ۹۰ روز.
- توکن ابطال‌شده در درخواست بعدی رد می‌شود؛ نیازی به ری‌استارت نیست.
- `mcp:token list` فقط metadata نشان می‌دهد، نه توکن.

## ۳. تنظیم کلاینت

سرور از MCP Streamable HTTP استفاده می‌کند. کلاینت باید دامنه را HTTPS صدا بزند و هدر `Authorization` را بفرستد. نمونهٔ عمومی:

```json
{
  "mcpServers": {
    "fast-english": {
      "type": "streamable-http",
      "url": "https://fastenglishpodcast.ir/mcp/content",
      "headers": {
        "Authorization": "Bearer femcp_<token>"
      }
    }
  }
}
```

نام کلید نوع در کلاینت‌ها متفاوت است (`type: "http"`، `type: "streamable-http"` یا فقط `url`). اگر کلاینت شما کلید `headers` را نمی‌پذیرد، از bridge محلی `mcp-remote` استفاده کنید:

```json
{
  "mcpServers": {
    "fast-english": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://fastenglishpodcast.ir/mcp/content",
        "--header", "Authorization: Bearer femcp_<token>"
      ]
    }
  }
}
```

برای بررسی سریع اتصال (بدون کلاینت):

```bash
curl -sS https://fastenglishpodcast.ir/mcp/content \
  -H "Authorization: Bearer femcp_<token>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
```

پاسخ باید `serverInfo.name` برابر `Fast English Content` داشته باشد. با `tools/list` باید هفت ابزار ببینید.

## ۴. ابزارها

| ابزار | کار | نیاز به ability | ورودی مهم |
|---|---|---|---|
| `list-content` | فهرست دسته‌ها، مطلب‌ها و درس‌ها + شمارش | `content:read` | `status`، `search`، `limit` |
| `get-content` | متن کامل یک مطلب/درس + وضعیت بررسی + مشکلات انتشار | `content:read` | `topic_slug`، `level` اختیاری |
| `save-category` | ساخت/به‌روزرسانی دسته با slug | `content:write` | `slug`، `name_fa`، `display_order`، `is_active` |
| `save-topic` | ساخت/به‌روزرسانی draft مطلب | `content:write` | `slug`، `title_en`، `summary_public`، `category_id/slug`، `cover_upload_id`، `source_note` |
| `save-lesson` | ساخت/به‌روزرسانی draft درس برای (topic, level) | `content:write` | `topic_slug`، `level`، متن، glossary، duration، `audio_upload_id` |
| `begin-upload` | ساخت توکن و URL آپلود یک‌بارمصرف | `content:write` | `kind` = `audio` یا `cover` |
| `transition-content` | publish / archive / to-draft | `content:publish` | `type`، `action`، `id` یا `topic_slug`+`level`، `confirm_review` |

`save-topic` و `save-lesson` idempotent هستند: فراخوانی دوباره با همان slug یا همان (topic, level) ردیف جدید نمی‌سازد.

### آپلود صوت/کاور

۱. ابزار `begin-upload` را با `kind: "audio"` یا `kind: "cover"` صدا بزنید. پاسخ شامل `upload_id`، `url`، هدر `X-Upload-Token` و محدودیت حجم است.

۲. فایل خام را با `PUT` بفرستید (نمونه برای صوت):

```bash
curl -X PUT \
  -H "X-Upload-Token: feup_..." \
  -H "Content-Type: application/octet-stream" \
  --data-binary @lesson.mp3 \
  "https://fastenglishpodcast.ir/mcp/uploads/<upload_id>"
```

۳. `upload_id` را به `save-lesson` (صوت) یا `save-topic` (کاور) بدهید.

نکته‌ها:

- MP3 حداکثر ۳۰ مگابایت؛ امضای واقعی فایل بررسی می‌شود، نه پسوند.
- کاور JPEG/PNG/WebP حداکثر ۲ مگابایت و حداکثر ۴۰۰۰ پیکسل در هر ضلع.
- توکن آپلود ۳۰ دقیقه اعتبار دارد، یک‌بارمصرف است و به توکن MCP صادرکننده بسته شده است. آپلود دوم همان `upload_id` پاسخ `409` می‌گیرد.
- کاور آپلودی نیاز به `source_note` چهارخطی دارد:
  ```
  Source: <منبع عکس>
  License: <نوع مجوز>
  Checked: 2026-11-08
  Notes: <توضیح استفاده>
  ```
  کاور تولیدشدهٔ خودکار (`covers/gd-*.jpg`) از این قاعده مستثناست. اگر کاور تولیدی را با کاور آپلودی جایگزین کنید، باید مجوز جدید بدهید؛ رکورد generated قابل ارث‌بری نیست.

## ۵. گردش کار پیشنهادی برای عامل

1. `list-content` و در صورت نیاز `get-content`؛ از ساخت تکراری دسته/مطلب/درس خودداری کند.
2. `save-category` فقط اگر دستهٔ لازم وجود ندارد.
3. `save-topic` با slug، عنوان، خلاصهٔ فارسی و دسته. اگر کاور ندارید، کاور خودکار ساخته می‌شود.
4. `begin-upload` برای صوت، سپس `PUT` فایل، سپس `save-lesson` با `audio_upload_id`.
5. `transition-content` برای publish مطلب؛ سپس انتشار درس با `confirm_review=true` بعد از بررسی انسانی.
6. `get-content` را دوباره بخوانید و `publish_problems` را خالی ببینید.
7. در اپ: `/app/topics/<slug>?level=<LEVEL>` و اگر نمونه است `/sample?topic=<slug>&level=<LEVEL>` را بررسی کنید.

ترتیب انتشار مهم است: اول Topic، بعد Lesson. متن/صوت باید واقعی و دارای مجوز باشد؛ محتوای تستی، tone خالی، Lorem ipsum و صوت بدون ارتباط ممنوع است (همان قواعد پنل).

## ۶. خطاهای رایج

| وضعیت/کد | معنی | کار |
|---|---|---|
| `401` | توکن Bearer نیست، نامعتبر/منقضی/ابطال‌شده است | توکن جدید با `mcp:token issue` بگیرید |
| `403` | حساب کارکنان فعال نیست یا ability لازم را ندارد | حساب/توکن را بررسی کنید؛ برای publish توکن با `content:publish` صادر کنید |
| `422` `file` | فایل خالی/غیر MP3/کاور غیرمجاز/بزرگ | فایل واقعی و در محدوده بفرستید |
| `409` | این `upload_id` قبلاً آپلود یا مصرف شده | `begin-upload` تازه بگیرید |
| `413` | حجم اعلام‌شده از سقف بیشتر است | فایل کوچک‌تر بفرستید |
| `review_required` | درس draft بدون `confirm_review` منتشر می‌شود | بعد از بررسی انسانی `confirm_review=true` بفرستید یا در پنل publish کنید |
| `source_note` | کاور آپلودی مجوز چهارخطی ندارد یا رکورد generated را دوباره استفاده کرده‌اید | مجوز واقعی را در `source_note` بدهید |
| `status` | می‌خواهید مطلب/درس منتشرشده یا آرشیوشده را با MCP ویرایش کنید | Archive → to-draft → ویرایش → publish (یا ویرایش در `/admin`) |
| `not_found` | slug/id اشتباه است | `list-content` را دوباره بخوانید |
| `ability_denied` | ابزار در سطح توکن مجاز نیست | توکن با ability درست صادر کنید |
| `The parent topic must be published first` | ترتیب انتشار | اول Topic را publish کنید |

## ۷. کارهای خارج از محدودهٔ این نسخه

- ساخت/حذف دسته، مطلب یا درس به‌صورت حذف واقعی؛ فقط archive و draft.
- تغییر slug بعد از انتشار، جابه‌جایی درس بین سطح‌ها، یا ویرایش مستقیم محتوای منتشرشده.
- تولید کاور با متن/تصویر دلخواه؛ کاور خودکار انتزاعی است و کاور واقعی باید آپلود شود.
- OAuth؛ کلاینت‌هایی که فقط OAuth می‌خواهند باید از bridge محلی استفاده کنند.
- آپلود چندفایلی هم‌زمان در یک درخواست؛ هر فایل یک `begin-upload` جدا دارد.

## ۸. عیب‌یابی سمت سرور

- جدول `mcp_tokens` و route ها بعد از release وجود دارند: `php artisan migrate:status`.
- توکن‌ها: `php artisan mcp:token list`.
- فایل‌های مرحله‌ای: `php artisan mcp:cleanup-uploads --dry-run` (پاک‌سازی خودکار هر ۱۵ دقیقه).
- لاگ ابزارها: خط `mcp.tool` با `tool`، `token_id`، `user_id` و `ok`؛ متن فایل یا آرگومان‌ها لاگ نمی‌شود.
- اگر `route('mcp.upload')` آدرس اشتباه ساخت، `APP_URL` محیط را بررسی کنید.
