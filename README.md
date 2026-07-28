# Minimal Production Vibe Workflow for OpenCode Go

این قالب برای «تولید زیاد کد» ساخته نشده؛ برای ساخت **کوچک‌ترین تغییر قابل اتکا** با سرعت بالا ساخته شده است. هیچ Prompt یا Agentای به‌تنهایی امنیت و کیفیت شرکت‌های بزرگ را تضمین نمی‌کند. آن سطح از خروجی از ترکیب Scope روشن، معماری محدود، کنترل دسترسی، تست، CI، Review و عملیات درست به‌دست می‌آید.

## چرا فقط سه Agent؟

| Agent | مدل پیش‌فرض | کار درست | کار ممنوع |
|---|---|---|---|
| `fast` | MiMo 2.5 | جست‌وجو، کار مکانیکی، تست تکراری، مستندات، UI ایزوله | معماری، Auth، پرداخت، Schema، API، Deploy |
| `build` | MiniMax M3 | پیاده‌سازی اصلی، Integration، تست و رفع باگ | Deploy/Push مخفی، عملیات مخرب، حدس‌زدن تصمیم معماری |
| `plan` | Kimi K3 | معماری، مدل داده، ریسک، برنامه و Review بخش‌های حساس | نوشتن کد اپلیکیشن |

Agent چهارم معمولاً فقط Context، Token و محل شکست اضافه می‌کند. مدل اصلی می‌تواند کارهای ساده را به `fast` واگذار کند، اما مسئول نتیجه باقی می‌ماند.

## تغییر مدل‌ها از یک نقطه

فقط این فایل را ویرایش کن:

```bash
.opencode/models.env
```

```bash
export OC_FAST_MODEL="opencode-go/mimo-v2.5"
export OC_MAIN_MODEL="opencode-go/minimax-m3"
export OC_ARCH_MODEL="opencode-go/kimi-k3"
```

برای اینکه متغیرها همیشه بارگذاری شوند، OpenCode را از ریشه پروژه با این دستور اجرا کن:

```bash
./oc
```

اگر می‌خواهی مستقیم `opencode` اجرا کنی، ابتدا این فایل را در Shell بارگذاری کن:

```bash
source .opencode/models.env
opencode
```

کلید API را در `models.env` نگذار.

## راه‌اندازی

```bash
chmod +x oc scripts/*.sh
./oc
```

داخل OpenCode:

1. با `/connect` حساب OpenCode Go را وصل کن.
2. `docs/PRODUCT.md` را با نیازهای واقعی و Acceptance Criteria پر کن.
3. `docs/ARCHITECTURE.md` را فقط با تصمیم‌های پایدار پر کن.
4. برای کار معماری/حساس: `/plan شرح کار`
5. برای ساخت یک Slice: `/build شرح دقیق و معیار پذیرش`
6. قبل از تحویل بخش حساس: `/review`
7. Gate نهایی محلی: `/ship`

برای پروژه‌های کوچک و کم‌ریسک، مستقیم `/build` کافی است. `/plan` را برای هر دکمه و کامپوننت اجرا نکن.

## حلقه کاری پیشنهادی

```text
PRODUCT → PLAN (فقط در کار مهم) → BUILD → VERIFY → REVIEW (کار حساس) → SHIP
```

- هر Task باید یک خروجی قابل تست داشته باشد، نه «کل اپ را حرفه‌ای کن».
- هر Slice ترجیحاً یک جریان عمودی کوچک است: UI + منطق + داده + تست مربوط به همان قابلیت.
- `scripts/verify.sh` قرارداد واحد Agent و CI است.
- اگر استک پروژه با تشخیص خودکار سازگار نیست، `scripts/project-verify.sh` بساز و executable کن.

## قرارداد CI

برای Node حداقل Scriptهای واقعی پروژه را در `package.json` تعریف کن:

```json
{
  "scripts": {
    "format:check": "...",
    "typecheck": "...",
    "lint": "...",
    "test": "...",
    "build": "..."
  }
}
```

یا یک Script واحد `ci` تعریف کن. این Gate برای Node عمداً فقط npm، pnpm و Yarn را پشتیبانی می‌کند. پروژه Node بدون Lockfile Fail می‌شود؛ Build غیرقابل تکرار Production-ready نیست.

## سیاست Token

- `AGENTS.md` کوتاه و همیشه فعال است؛ جزئیات Review فقط هنگام `/review` به‌صورت Skill بارگذاری می‌شود.
- Agent سریع تنها برای Task بسته و کم‌ریسک است.
- خروجی Toolها محدود و Compaction/Pruning روشن است.
- اسناد دائم فقط سه عددند: Product، Architecture و Plan جاری.
- از Promptهای تکراری، چند Agent موازی، Memory عظیم و تولید مستندات نمایشی پرهیز شده است.

## چیزهایی که عمداً نصب نشده‌اند

- MCP عمومی یا مجموعه MCPهای تصادفی
- Framework چندعاملی پیچیده
- Ponytail به‌صورت Plugin جدا
- Vector DB/Memory دائمی
- سرویس Queue، Microservice، Docker/Kubernetes اجباری
- تست ۱۰۰٪، Scannerهای ناسازگار با هر استک، یا ده‌ها GitHub Action

قواعد پایدار YAGNI/Ponytail مستقیماً در `AGENTS.md` آمده‌اند؛ بنابراین برای چند خط Prompt، Plugin و Context اضافه مصرف نمی‌شود. ابزار جدید فقط وقتی اضافه شود که یک درد تکرارشونده و قابل اندازه‌گیری را حل کند.

## امنیت و «Production-level» واقعی

بخش‌های زیر همیشه High-risk هستند و باید با `plan` و سپس `review` عبور کنند:

- Auth و Authorization
- پرداخت، Callback، Subscription و Idempotency
- Secret، Upload، Crypto و داده حساس
- Schema/Migration و حذف داده
- Backup/Restore و Deploy
- Public API و تغییر Contract
- Concurrency یا Optimization مهم

Review باید Evidence و `file:line` داشته باشد. Checklist بدون ارتباط با Diff ارزش ندارد.

## استفاده برای پروژه‌های محرمانه

سند قرارداد، اطلاعات مشتری، Credential، داده واقعی و Specification خصوصی را در Repository عمومی نگذار. آن‌ها را در `docs/private/` نگه‌دار؛ این مسیر هم Ignore شده و هم دسترسی Agent به آن به‌صورت پیش‌فرض Deny است. فقط خلاصهٔ غیرمحرمانه و Acceptance Criteria لازم را وارد `docs/PRODUCT.md` کن.

## استفاده از Auto mode

`--auto` را فقط در Repository شخصی و قابل بازیابی استفاده کن. Denyهای صریح این قالب برای Push، Deploy، Secret و فرمان‌های مخرب باقی می‌مانند، اما Auto mode جای Review انسانی را نمی‌گیرد.

## اصل نهایی

وقتی خروجی ضعیف است، معمولاً راه‌حل «Agent و ابزار بیشتر» نیست. ابتدا این چهار مورد را درست کن:

1. Requirement و Acceptance Criteria دقیق
2. Scope کوچک و یک Slice قابل تست
3. Context درست و کم
4. Gate قابل اجرا برای Verification
