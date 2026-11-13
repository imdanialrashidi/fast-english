# راهنمای پیاده‌سازی ملی پیامک برای عامل‌های کدنویسی

> این فایل مرجع فنی ملی‌پیامک است (نسخهٔ ۲۰۲۶-۱۱-۱۳). نام متغیرهای env در نمونهٔ Node با این پروژه یکی نیست؛ قرارداد این پروژه در `.env.production.example` و گام‌های عملی پنل در `docs/ops/SMS_PANEL_FA.md` است. این پروژه فقط از «پترن خدماتی» برای دو پیام استفاده می‌کند.

بازبینی منابع در **۲۰۲۶-۱۱-۱۳**. نمونهٔ اجرایی با Node.js 24 نوشته و با پاسخ‌های شبیه‌سازی‌شده بررسی شده است. قراردادهای HTTP برای سایر زبان‌های بک‌اند هم قابل استفاده‌اند. ارسال واقعی و دسترسی‌های هر حساب باید از محیط استقرار همان پروژه بررسی شوند.

## ۱. شروع سریع

1. نوع پیام را مشخص کنید. کد ورود، اطلاع‌رسانی سفارش، پیام متنی آزاد، تبلیغات و دریافت پیامک هرکدام انتخاب متفاوتی دارند.
2. در تنظیمات پروژه ببینید اتصال فعلی از کدام خانواده است. برای پروژهٔ جدید، REST پنل نمونهٔ عمومی برای ارسال، پترن، اعتبار و دلیوری دارد. اگر حساب از کنسول استفاده می‌کند، نمونهٔ همان متد را از بخش «وب‌سرویس‌ها»ی کنسول بردارید.
3. در پنل، دسترسی وب‌سرویس، اعتبار، خط فرستندهٔ مجاز برای متن آزاد، IP خروجی مجاز و کد پترن تأییدشده را متناسب با قابلیت انتخابی بررسی کنید.
4. اتصال را در بک‌اند و پشت یک رابط با عملیات مشخص مانند ارسال متن، ارسال پترن و استعلام دلیوری پیاده کنید. محیط توسعه و CI را به فرستندهٔ شبیه‌سازی‌شده وصل کنید.
5. در محیط آزمایشی، با شمارهٔ کنترل‌شده یک ارسال انجام دهید. شناسهٔ پذیرش ارسال را ذخیره کنید و وضعیت تحویل را از همان سرویس یا پنل پیگیری کنید. [مستندات رسمی API][api] · [ورود به کنسول][console]

## ۲. انتخاب خانوادهٔ API

| خانواده | مقصد و قالب | احراز هویت | موارد استفاده |
| --- | --- | --- | --- |
| REST پنل | `https://rest.payamak-panel.com/api/SendSMS/` با `POST` و `application/x-www-form-urlencoded` | `username` و فیلد `password` در فرم. کلید وب‌سرویس پنل را طبق تنظیمات حساب در `password` بگذارید. | متن آزاد، پترن، OTP با متن ثابت، اعتبار، دلیوری و صندوق پیامک |
| REST کنسول | `https://console.melipayamak.com/api/` با `POST` و JSON برای متدهای ارسال این راهنما | کلید کنسول در مسیر URL متد | ارسال تکی، چندگیرنده و پترن. قرارداد قابلیت‌های دیگر از بخش «وب‌سرویس‌ها»ی حساب خوانده می‌شود. |
| SOAP پنل | سرویس‌های ASMX و قرارداد XML/WSDL روی دامنهٔ `api.payamak-panel.com` | پارامترهای احراز هویت مطابق همان WSDL و تنظیمات حساب | نگهداری اتصال موجود یا استفاده از متدهای پیشرفتهٔ موردنیاز پروژه |

کلید پنل و کلید کنسول را با نام‌های مجزا در تنظیمات نگه دارید. کد `-110` در REST پنل یعنی استفاده از API Key به‌جای رمز ورود الزامی است. برای SOAP، دامنه و مسیر HTTPS را از مستندات متد و پنل بگیرید و مقصد واقعی درخواست در WSDL را هم بررسی کنید. در اتصال عملی از HTTPS با اعتبارسنجی TLS فعال استفاده کنید. [ارسال سادهٔ پنل][send] · [اطلاعیهٔ دامنهٔ SOAP][soap-domain] · [کنسول][console]

### آماده‌سازی پنل و خط

- **متن آزاد** با خط اختصاصی مجاز حساب ارسال می‌شود. برای اعلان‌های تراکنشی، امکان ارسال از خط خدماتی اختصاصی را در حساب بررسی کنید.
- **پترن خدماتی اشتراکی** برای پیام‌های تراکنشی مثل ورود، ثبت سفارش و نوبت است. این مسیر طبق مستندات برای مخاطبانی که دریافت تبلیغات را مسدود کرده‌اند هم کاربرد دارد. تبلیغات را از مسیر مجاز تبلیغاتی و طبق تنظیمات رضایت و لغو دریافت پروژه ارسال کنید.
- **پترن** را در بخش «وب‌سرویس خدماتی» پنل درج کنید. متن الگو و متغیرهای ترتیبی `{0}`، `{1}` و مانند آن را مشخص کنید. الزامات درج متن و دامنه را از فرم فعلی پنل بگیرید. پس از تأیید، برای هر کاربرد مثل ورود یا ثبت سفارش، `bodyId`، نام متغیرها و ترتیبشان را در تنظیمات بک‌اند ثبت کنید. تعداد و نوع مقادیر را پیش از ارسال با تعریف همان پترن تطبیق دهید.
- **IP خروجی** همان IP عمومی درخواستِ سرور یا NAT است. برای هر محیط، آن را با فهرست مجاز حساب تطبیق دهید. ملی پیامک در یک اطلاعیه محدودیت دسترسی API از IP خارج ایران را اعلام کرده بود. برای استقرار جدید، وضعیت فعلی را با پشتیبانی و یک درخواست خواندنی از محیط مقصد بررسی کنید. [راهنمای رسمی پترن][pattern-blog] · [متد پترن][pattern] · [اطلاعیهٔ IP][ip-notice]

### تنظیمات نمونهٔ پروژه

فایل `.env.example` را با مقادیر خالی نگه دارید. مقادیر واقعی را از secret manager یا تنظیمات محرمانهٔ سرویس تزریق کنید. فقط کلید مربوط به خانوادهٔ انتخابی لازم است. شمارهٔ فرستنده و گیرنده را رشته نگه دارید.

~~~dotenv
MELIPAYAMAK_TRANSPORT=legacy
MELIPAYAMAK_USERNAME=
MELIPAYAMAK_LEGACY_API_KEY=
MELIPAYAMAK_CONSOLE_KEY=
MELIPAYAMAK_SENDER=
MELIPAYAMAK_OTP_BODY_ID=
MELIPAYAMAK_TEST_TO=
~~~

در نمونهٔ Node.js مقدار `MELIPAYAMAK_TRANSPORT` یکی از `legacy` برای REST پنل و `console` برای REST کنسول است. نمونه، شمارهٔ موبایل ایران را به قالب `09xxxxxxxxx` تبدیل می‌کند. سرشمارهٔ اختصاصی را با همان قالبی که پنل نشان می‌دهد در `MELIPAYAMAK_SENDER` بگذارید.

## ۳. قرارداد REST پنل

همهٔ مسیرهای این جدول به `https://rest.payamak-panel.com/api/SendSMS/` اضافه می‌شوند. در هر `POST`، `username` و `password` را همراه فیلدهای متد در بدنهٔ فرم بفرستید. در Node.js، `URLSearchParams` کدگذاری UTF-8 و جداکننده‌ها را مدیریت می‌کند.

| متد | فیلدهای اختصاصی | نتیجه و نکتهٔ اجرایی |
| --- | --- | --- |
| `SendSMS` | `to`، `from`، `text`، `isFlash=false` | پذیرش با `recId` در `Value`. نمونهٔ REST برای چند مخاطب، شماره‌های جداشده با ویرگول در `to` دارد. قبل از استفادهٔ گروهی، قالب `Value` و نحوهٔ تطبیق شناسه با گیرنده را با پاسخ واقعی حساب ثبت کنید. [مستندات][send] |
| `BaseServiceNumber` | `to`، `bodyId`، `text` | هر درخواست یک گیرنده. `text` شامل مقدار متغیرها به‌ترتیب و جداشده با `;` است. خط را پترن تعیین می‌کند. [مستندات][pattern] |
| `SendOtp` | `to`، `from`، `code` | برنامه کد را می‌سازد. `code` طبق مستندات عدد صحیح است و در متن ثابت سرویس قرار می‌گیرد. [مستندات][otp] |
| `GetDeliveries2` | `recId` | استعلام یک شناسه. کد وضعیت تحویل را از `Value` بخوانید. [مستندات][delivery] |
| `GetCredit` | فقط فیلدهای احراز هویت | `Value` اعتبار پنل را برحسب تعداد پیامک برمی‌گرداند. صفر مقدار معتبر است. [مستندات][credit] |
| `GetMessages` | `location`، `index`، `count`، `from` اختیاری | `location=1` دریافتی، `2` ارسالی و `-1` همه. از `index=0` شروع کنید و صفحه‌بندی را با پاسخ حساب تطبیق دهید. [مستندات][messages] |
| `GetBasePrice` / `GetUserNumbers` | فقط فیلدهای احراز هویت | تعرفهٔ پایه و فهرست خطوط حساب. برای برآورد هزینهٔ ارسال واقعی، متن، خط و تعرفهٔ فعال حساب را لحاظ کنید. [تعرفه][price] · [کد Node.js][node-rest] |

در پترنی با متن فرضی «{0} عزیز، سفارش {1} ثبت شد»، برای نام `سارا` و سفارش `A-1042` مقدار `text` در REST پنل `سارا;A-1042` است. مقادیر را به ترتیب جایگاه الگو تولید کنید. اگر یک مقدار خودش `;` دارد، آن را مطابق قواعد ورودی پروژه اعتبارسنجی کنید. نمونهٔ زیر چنین مقداری را رد می‌کند تا تعداد جایگاه‌ها عوض نشود. برای پترن ثابت، قالب `text` بدون متغیر را با پترن واقعی حساب بررسی کنید. [مستندات پترن][pattern] · [راهنمای تعریف الگو][pattern-blog]

### خواندن پاسخ و عیب‌یابی

در REST پنل، پاسخ JSON معمولاً سه فیلد `Value`، `RetStatus` و `StrRetStatus` دارد. ابتدا HTTP و شکل پاسخ را بررسی کنید. سپس `RetStatus` و معنای `Value` را طبق متد بررسی کنید. برای نمونه، `Value="2"` در پاسخ ارسال یعنی کمبود اعتبار و در پاسخ دلیوری یعنی پیام به گوشی نرسیده است. شناسهٔ `recId` را از لحظهٔ خواندن پاسخ تا پایگاه داده و استعلام به صورت **رشته** نگه دارید. تبدیل شناسهٔ بزرگ به `Number` می‌تواند رقم‌های آن را تغییر دهد. [نمونهٔ پاسخ رسمی اعتبار][credit] · [کلاس پاسخ در مخزن رسمی دات‌نت][dotnet] · [دقت JSON در JavaScript][json-parse]

نمونهٔ پاسخ شبیه‌سازی‌شده برای پذیرش ارسال در REST پنل.

~~~json
{"Value":"9007199254740993","RetStatus":1,"StrRetStatus":"Ok"}
~~~

| کد | عملیات مرتبط | اقدام |
| --- | --- | --- |
| `-111`، `-109`، `-108` | احراز هویت/IP، بسته به متد | به‌ترتیب IP نامعتبر، الزام تنظیم IP مجاز و مسدودی IP بعد از تلاش‌های ناموفق. تنظیمات حساب و IP خروجی واقعی را بررسی کنید. |
| `-110`، `0` | ارسال پنل | به‌ترتیب الزام API Key و اطلاعات ورود نامعتبر. نام کاربری و کلید وب‌سرویس پنل را بررسی کنید. |
| `2`، `3`، `4`، `19` | ارسال، بسته به متد | به‌ترتیب اعتبار ناکافی، محدودیت روزانه، محدودیت حجم و محدودیت ساعتی. گزارش پنل و سهمیهٔ خط/حساب را بررسی کنید. |
| `5`، `9`، `10`، `12` | ارسال پنل، بسته به متد | خط فرستنده نامعتبر، خط عمومی غیرمجاز در وب‌سرویس، حساب غیرفعال یا مدارک ناقص. وضعیت حساب و خط را بررسی کنید. |
| `7`، `14`، `15` | ارسال ساده | فیلتر متن، محدودیت لینک یا الزام عبارت لغو در ارسال چندگیرنده. قرارداد همان خط، متد و متن را بررسی کنید. |
| `16`، `17`، `18`، `35` | ارسال پنل، بسته به متد | گیرنده پیدا نشد، متن خالی، شماره نامعتبر یا لیست سیاه. `35` را در جدول همان متد بخوانید و برای اعلان تراکنشی مسیر خدماتی تأییدشده را از ابتدا انتخاب کنید. |
| `-1`، `-2`، `-3`، `-4`، `-5`، `-10` | `BaseServiceNumber` / `SendByBaseNumber2` | دسترسی غیرفعال، بیش از یک گیرنده، خط تعریف‌نشده، پترن نامعتبر/تأییدنشده، مغایرت متغیرها یا وجود لینک در متغیرها. |

مقادیر منفی مخصوص پترن بین متدهای SOAP شمارهٔ ۲ و ۳ تفاوت دارند. جدول خطای متد دقیق را برای دسته‌بندی استفاده کنید. خطای احراز هویت، ورودی یا پترن با اصلاح تنظیمات رفع می‌شود. تلاش‌های ناموفق مکررِ احراز هویت می‌توانند به مسدودی IP منجر شوند. [خطاهای ارسال ساده][send] · [خطاهای متد دوم پترن][pattern] · [متد سوم پترن][pattern-v3]

## ۴. قرارداد REST کنسول

مسیرهای جدول نسبت به `https://console.melipayamak.com` هستند. `{key}` قطعه‌ای از مسیر URL است. آن را با کلید کنسول جایگزین کنید و در لاگ، APM و گزارش خطا کل URL را به مسیر بدون کلید یا نام عملیات تبدیل کنید. نمونه‌های ارسال تکی، چندگیرنده و پترن از یک پیاده‌سازی عمومی تکمیلی بررسی شده‌اند. هنگام استقرار، نمونهٔ متد و شکل پاسخ را با نسخهٔ داخل حساب خود تطبیق دهید. [کنسول ملی پیامک][console] · [پیاده‌سازی تکمیلی و فیکسچرهای کنسول][console-sdk]

| قابلیت | مسیر `POST` | بدنهٔ JSON | نشانهٔ پذیرش |
| --- | --- | --- | --- |
| متن برای یک مخاطب | `/api/send/simple/{key}` | `{"from":"<خط پنل>","to":"<موبایل>","text":"<متن>"}` | `recId` |
| یک متن برای چند مخاطب | `/api/send/advanced/{key}` | `{"from":"<خط پنل>","to":["<موبایل۱>","<موبایل۲>"],"text":"<متن>"}` | `recIds` |
| پترن برای یک مخاطب | `/api/send/shared/{key}` | `{"bodyId":12345,"to":"<موبایل>","args":["سارا","A-1042"]}` | `recId` |
| متد OTP کنسول | `/api/send/otp/{key}` | در نمونهٔ عمومی `{"to":"<موبایل>"}` | شکل خروجی، نحوهٔ دریافت یا بررسی کد و تنظیم سرویس را از مستندات داخل حساب بگیرید. [نمونهٔ عمومی][console-otp] |

- برای متدهای `simple` و `shared`، پاسخ موفق HTTP همراه با `recId` معتبر را پذیرش محسوب کنید. `status` ممکن است توضیح رد درخواست باشد. در خطای اعتبارسنجی ممکن است ساختار شامل `title` و `errors` باشد. نگاشت عددی REST پنل را روی پاسخ‌های همان پنل اعمال کنید.
- در ارسال چندگیرنده، `recIds` را با قرارداد تأییدشدهٔ حساب به گیرنده‌ها نسبت دهید. اگر تعداد یا ترتیب قابل تأیید نبود، موارد نامشخص را در وضعیت مبهم ثبت کنید و از گزارش کنسول برای تطبیق استفاده کنید.
- پاسخ HTML با HTTP 200 نشانه‌ای برای بررسی مسیر، روش HTTP و دسترسی است. برای استعلام دلیوری، اعتبار یا دریافت پیامک از کنسول، آدرس و قالب همان عملیات را از نمونهٔ داخل کنسول بردارید و با دادهٔ آزمایشی ثبت کنید. [راهنمای بخش وب‌سرویس‌های کنسول][console-guide] · [نمونهٔ تکمیلی و آزمون‌ها][console-sdk]

## ۵. نمونهٔ اجرایی Node.js

این ماژول برای سرور Node.js 24 است و پکیج اضافی لازم ندارد. ارسال تکی و پترن برای هر دو خانواده و اعتبار و دلیوری برای REST پنل پیاده شده‌اند. `fetchImpl` را در تست جایگزین کنید. نتیجهٔ ارسال موفق `{ recId }` است. در خطا، `rejected` یعنی درخواست صریحاً رد شده و `unknown` یعنی وضعیت به بررسی نیاز دارد. خطا فقط عملیات، وضعیت HTTP و کد عددی شناخته‌شدهٔ پنل را نگه می‌دارد. برای شرح خطاهای کنسول از گزارش همان حساب استفاده کنید.

در REST پنل، نمونه برای پذیرش ارسال `RetStatus=1` و شناسهٔ عددی با دست‌کم ۱۶ رقم را بررسی می‌کند. مستندات پترن این طول را ذکر کرده‌اند. نمونه برای ارسال ساده هم همین شرط محافظه‌کارانه را اعمال می‌کند. اگر پاسخ معتبر حساب برای ارسال ساده قالب دیگری دارد، قاعدهٔ همان متد را با فیکسچر واقعی اصلاح کنید. [متد پترن][pattern] · [متد ارسال ساده][send] · [fetch در Node.js][node-fetch]

محتوای زیر را در `melipayamak.mjs` بگذارید.

~~~javascript
const REST = 'https://rest.payamak-panel.com/api/SendSMS/';
const CONSOLE = 'https://console.melipayamak.com/api/send/';
const authErrors = new Set(['-111', '-110', '-109', '-108']);
const sendErrors = new Set([
  ...authErrors, '0', '2', '3', '4', '5', '6', '7', '9', '10', '11',
  '12', '14', '15', '16', '17', '18', '19', '35',
]);
const patternErrors = new Set(['-1', '-2', '-3', '-4', '-5', '-6', '-7', '-10']);
const deliveryErrors = new Set([...authErrors, '-2', '-3', '-10']);
const rejectedHttpStatuses = new Set([400, 401, 403, 404, 405, 413, 415, 422]);
const deliveryStates = {
  '-1': 'failed', 0: 'submitted', 1: 'delivered', 2: 'failed', 3: 'failed',
  5: 'unknown', 8: 'submitted', 16: 'failed', 35: 'blocked', 100: 'unknown',
  200: 'sent', 300: 'filtered', 400: 'queued', 500: 'failed',
};

export class MelipayamakError extends Error {
  constructor(operation, kind, { httpStatus, providerCode } = {}) {
    super('Melipayamak ' + operation + ' ' + kind);
    this.name = 'MelipayamakError';
    this.operation = operation;
    this.kind = kind;
    this.httpStatus = httpStatus;
    this.providerCode = providerCode;
  }
}

export function normalizeIranMobile(input) {
  if (typeof input !== 'string') throw new TypeError('Mobile must be a string');
  const digits = input
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\s()-]/g, '');
  const match = /^(?:0|\+98|0098|98)?(9[0-9]{9})$/.exec(digits);
  if (!match) throw new TypeError('Invalid Iranian mobile number');
  return '0' + match[1];
}

function parseResponse(raw) {
  return JSON.parse(raw, (_key, value, context) => {
    if (typeof value === 'number' && !Number.isSafeInteger(value) &&
        /^-?[0-9]+$/.test(context?.source ?? '')) {
      return context.source;
    }
    return value;
  });
}

function integerText(value) {
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value)) return value;
  return Number.isSafeInteger(value) ? String(value) : null;
}

function positiveId(value) {
  const id = integerText(value);
  return id && /^[1-9][0-9]*$/.test(id) ? id : null;
}

function legacyOk(payload) {
  return payload.RetStatus === 1 || payload.RetStatus === '1';
}

export function createMelipayamak({
  transport, apiKey, username, sender, timeoutMs = 8_000,
  fetchImpl = globalThis.fetch,
}) {
  const legacy = transport === 'legacy';
  if (!legacy && transport !== 'console') throw new TypeError('Unknown SMS transport');
  const key = apiKey?.trim();
  const user = username?.trim();
  if (!key || (legacy && !user)) throw new TypeError('Missing SMS credentials');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new TypeError('Invalid SMS timeout');
  }

  async function post(operation, fields) {
    const url = legacy
      ? REST + operation
      : CONSOLE + operation + '/' + encodeURIComponent(key);
    const body = legacy
      ? new URLSearchParams({ username: user, password: key, ...fields })
      : JSON.stringify(fields);
    let httpStatus;
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': legacy
            ? 'application/x-www-form-urlencoded; charset=UTF-8'
            : 'application/json',
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
      });
      httpStatus = response.status;
      const raw = await response.text();

      if (!response.ok) {
        const rejected = rejectedHttpStatuses.has(httpStatus);
        throw new MelipayamakError(operation, rejected ? 'rejected' : 'unknown', { httpStatus });
      }

      const payload = parseResponse(raw);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new MelipayamakError(operation, 'unknown', { httpStatus });
      }
      return payload;
    } catch (error) {
      if (error instanceof MelipayamakError) throw error;
      throw new MelipayamakError(operation, 'unknown', { httpStatus });
    }
  }

  async function send(operation, fields) {
    const payload = await post(operation, fields);
    if (legacy) {
      const value = integerText(payload.Value);
      if (sendErrors.has(value) ||
          (operation === 'BaseServiceNumber' && patternErrors.has(value))) {
        throw new MelipayamakError(operation, 'rejected', { providerCode: value });
      }
      if (legacyOk(payload) && /^[1-9][0-9]{15,}$/.test(value ?? '')) {
        return { recId: value };
      }
    } else {
      const recId = positiveId(payload.recId);
      if (recId) return { recId };
    }
    throw new MelipayamakError(operation, 'unknown');
  }

  async function sendSms({ to, text }) {
    const from = sender?.trim();
    if (!from || !/^[0-9]+$/.test(from)) throw new TypeError('Missing or invalid SMS sender');
    if (typeof text !== 'string' || !text.trim()) throw new TypeError('SMS text is required');
    const fields = { to: normalizeIranMobile(to), from, text };
    return legacy
      ? send('SendSMS', { ...fields, isFlash: 'false' })
      : send('simple', fields);
  }

  async function sendPattern({ to, bodyId, args }) {
    if (!Number.isInteger(bodyId) || bodyId < 1 || bodyId > 2_147_483_647) {
      throw new TypeError('Invalid SMS pattern ID');
    }
    if (!Array.isArray(args) || Array.from(args).some(arg => typeof arg !== 'string')) {
      throw new TypeError('Pattern arguments must be an array of strings');
    }
    if (legacy && args.some(arg => arg.includes(';'))) {
      throw new TypeError('Legacy pattern arguments cannot contain semicolons');
    }
    const mobile = normalizeIranMobile(to);
    return legacy
      ? send('BaseServiceNumber', { to: mobile, bodyId, text: args.join(';') })
      : send('shared', { to: mobile, bodyId, args });
  }

  if (!legacy) return { sendSms, sendPattern };

  return {
    sendSms,
    sendPattern,
    async getCredit() {
      const payload = await post('GetCredit', {});
      const value = payload.Value;
      const credit = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
      if (authErrors.has(credit)) {
        throw new MelipayamakError('GetCredit', 'rejected', { providerCode: credit });
      }
      if (legacyOk(payload) && /^[0-9]+(?:\.[0-9]+)?$/.test(credit)) return credit;
      throw new MelipayamakError('GetCredit', 'unknown');
    },
    async getDelivery(recId) {
      const id = positiveId(recId);
      if (!id) throw new TypeError('Invalid SMS record ID');
      const payload = await post('GetDeliveries2', { recId: id });
      const code = integerText(payload.Value);
      if (deliveryErrors.has(code)) {
        throw new MelipayamakError('GetDeliveries2', 'rejected', { providerCode: code });
      }
      if (!legacyOk(payload) || code === null) {
        throw new MelipayamakError('GetDeliveries2', 'unknown');
      }
      return { recId: id, code, status: deliveryStates[code] ?? 'unknown' };
    },
  };
}
~~~

برای ساخت کلاینت از تنظیمات سرور، محتوای زیر را در `sms-client.mjs` بگذارید.

~~~javascript
import { createMelipayamak } from './melipayamak.mjs';

const transport = process.env.MELIPAYAMAK_TRANSPORT;
export const sms = createMelipayamak({
  transport,
  username: process.env.MELIPAYAMAK_USERNAME,
  apiKey: transport === 'legacy'
    ? process.env.MELIPAYAMAK_LEGACY_API_KEY
    : process.env.MELIPAYAMAK_CONSOLE_KEY,
  sender: process.env.MELIPAYAMAK_SENDER,
});
~~~

برای تست خواندنی اعتبار REST پنل، بعد از تنظیم فایل `.env`، از ریشهٔ پوشهٔ مثال اجرا کنید.

~~~bash
node --env-file=.env --input-type=module -e \
  'import { sms } from "./sms-client.mjs"; console.log({ credit: await sms.getCredit() });'
~~~

برای آزمون ارسال پترن، کد زیر را در `send-test.mjs` قرار دهید و با `node --env-file=.env send-test.mjs` اجرا کنید. `MELIPAYAMAK_TEST_TO` باید شمارهٔ آزمایشی خودتان باشد و پترن آزمایشی باید یک متغیر داشته باشد. برای متن آزاد، در کد سرور از `sms.sendSms({ to, text })` با خط فرستندهٔ تنظیم‌شده استفاده کنید.

~~~javascript
import { sms } from './sms-client.mjs';

const result = await sms.sendPattern({
  to: process.env.MELIPAYAMAK_TEST_TO,
  bodyId: Number(process.env.MELIPAYAMAK_OTP_BODY_ID),
  args: ['123456'],
});
console.log({ recId: result.recId });
~~~

برای آزمون آفلاین، این نمونه را در `melipayamak.test.mjs` بگذارید و با `node --test melipayamak.test.mjs` اجرا کنید. این تست قالب پترن کنسول و حفظ شناسهٔ بزرگ را بررسی می‌کند.

~~~javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMelipayamak } from './melipayamak.mjs';

test('sends ordered pattern arguments and preserves the record ID', async () => {
  let request;
  const sms = createMelipayamak({
    transport: 'console',
    apiKey: 'fake-key',
    fetchImpl: async (url, options) => {
      request = { url, body: JSON.parse(options.body) };
      return new Response('{"recId":9007199254740993}');
    },
  });
  const result = await sms.sendPattern({ to: '+98 912 000 0000', bodyId: 12345, args: ['012345'] });
  assert.deepEqual(request, {
    url: 'https://console.melipayamak.com/api/send/shared/fake-key',
    body: { to: '09120000000', bodyId: 12345, args: ['012345'] },
  });
  assert.deepEqual(result, { recId: '9007199254740993' });
});
~~~

### پروژه‌ای که از SDK رسمی Node.js استفاده می‌کند

مخزن `Melipayamak/melipayamak-node` در کامیت `378e2c47e4b45e8ae699f93744a1e95acde6de5b` بررسی شد. `package.json` نام `melipayamak-api` را اعلام می‌کند. README برای نصب از `melipayamak` و در نمونهٔ `require` از `melipayamak-api` استفاده کرده است. اگر پروژه به همین سورس وابسته است، نسخهٔ lockfile را بررسی کنید. برای نصب مستقیم سورس، می‌توانید همان کامیت را مشخص کنید و نصب و وابستگی‌های آن را در نسخهٔ Node پروژه بررسی کنید. [README مخزن][node-repo] · [package.json کامیت][node-package] · [قالب پکیج Git در npm][npm-spec]

~~~bash
npm install 'github:Melipayamak/melipayamak-node#378e2c47e4b45e8ae699f93744a1e95acde6de5b'
~~~

~~~javascript
const MelipayamakApi = require('melipayamak-api');
const api = new MelipayamakApi(
  process.env.MELIPAYAMAK_USERNAME,
  process.env.MELIPAYAMAK_LEGACY_API_KEY
);
const sms = api.sms('rest', 'async'); // api.sms() هم همین حالت را انتخاب می‌کند
~~~

| فراخوانی SDK | مسیر و رفتار در کامیت بررسی‌شده |
| --- | --- |
| `sms.send(to, from, text, isFlash)` | `SendSMS`. Promise پاسخ REST را برمی‌گرداند. |
| `sms.sendByBaseNumber(text, to, bodyId)` | `BaseServiceNumber`. ترتیب آرگومان‌ها متن، گیرنده و شناسهٔ الگو است. |
| `sms.isDelivered(recId)` | `GetDeliveries2`. نتیجهٔ خام برای خواندن کد وضعیت برمی‌گردد. |
| `sms.getMessages(location, index, count, from)` | پیاده‌سازی REST فیلد `from` را ارسال نمی‌کند. برای فیلتر خط، درخواست مستقیم بسازید. |
| `sms.getCredit()` / `sms.getBasePrice()` / `sms.getNumbers()` | اعتبار، تعرفهٔ پایه و خطوط. |
| `api.sms('soap', 'async')` | کلاینت SOAP. برای دلیوری تکی `GetDelivery2` و برای آرایه `GetDeliveries3` را انتخاب می‌کند. برای ارسال، شمارهٔ تکی به `SendSimpleSMS2` و آرایه به `SendSimpleSMS` می‌رود. |

REST ناهمگام SDK پاسخ را هنگام دریافت هر تکهٔ داده parse می‌کند. timeout و بررسی HTTP در این پیاده‌سازی دیده نمی‌شوند. حالت REST موسوم به `sync` نتیجه را در کنسول چاپ می‌کند. سازندهٔ WSDL در همان کامیت از HTTP استفاده می‌کند. نمونهٔ `fetch` بالا timeout و پردازش کامل بدنه دارد. برای پروژهٔ SOAP، متد و نشانی HTTPS را بر اساس WSDL فعال همان حساب مشخص کنید. [سورس REST ناهمگام][node-rest] · [سورس REST موسوم به sync][node-rest-sync] · [سورس SOAP][node-soap] · [سازندهٔ WSDL][node-wsdl]

در SOAP، متد `SendByBaseNumber` آرایهٔ متغیرها، `SendByBaseNumber2` مقادیر جداشده با `;` و `SendByBaseNumber3` شناسه و متغیرها را در قالب `@bodyId@arg1;arg2` می‌گیرد. فایل `soapAsync.js` در کامیت بررسی‌شده برای پترن متد ندارد. برای فراخوانی مستقیم، ورودی‌ها و نام پاسخ XML را از WSDL همان متد بگیرید. برای نمونه، صفحهٔ درج الگو نشانی `https://api.payamak-panel.com/post/SharedService.asmx?wsdl` را مستند کرده است. [متد اول][pattern-v1] · [متد دوم][pattern] · [متد سوم][pattern-v3] · [درج الگو][pattern-add]

## ۶. الگوی ورود با OTP

برای کد تحت کنترل برنامه، یک پترن تأییدشده با متغیر کد تعریف کنید و آن را با `sendPattern` بفرستید. متد `SendOtp` در REST پنل کد صحیح عددی می‌گیرد و آن را در متن ثابت می‌گذارد. تولید کد در بازهٔ `100000` تا `999999`، شش‌رقمی بودن را در این متد حفظ می‌کند. برای پترن، کد را رشته نگه دارید و می‌توانید از `randomInt(0, 1_000_000).toString().padStart(6, '0')` از `node:crypto` استفاده کنید. در مسیر OTP کنسول، قرارداد تولید و بررسی کد را از کنسول تأیید کنید. [مستندات SendOtp][otp] · [نمونهٔ کنسول][console-otp] · [الزامات NIST برای کد خارج از باند][nist]

1. `POST /auth/otp/request` شماره را نرمال کند و برای شماره، حساب و IP محدودیت بگذارد. متن و کد وضعیت پاسخ را برای شماره‌های ثبت‌شده و ثبت‌نشده یکسان نگه دارید. یک `challengeId` تصادفی بسازید و آن را به شماره و هدف عملیات مثل `login` متصل کنید.
2. کد را با منبع تصادفی رمزنگاری‌شده تولید کنید. برای بررسی کد، شناسهٔ چالش، شماره، هدف و کد را با قالبی ثابت مانند آرایهٔ JSON سریال کنید و HMAC آن را با کلید مستقل سرور ذخیره کنید. زمان انقضا و شمارندهٔ تلاش ناموفق را کنار آن نگه دارید. انقضای ۲ تا ۵ دقیقه و فاصلهٔ ۶۰ ثانیه برای ارسال مجدد، نمونهٔ تنظیمات پروژه‌اند. اگر ارسال در صف است، دادهٔ لازم برای ارسال را با رمزنگاری و مهلت کوتاه نگه دارید و پس از انقضا از صف خارج کنید.
3. `POST /auth/otp/verify` چالش، هدف، انقضا و تعداد تلاش را بررسی کند. تطبیق HMAC را با مقایسهٔ زمان‌ثابت انجام دهید. افزایش شمارنده و مصرف چالش را در تراکنش یا عملیات اتمیک انجام دهید تا دو درخواست هم‌زمان با یک کد نشست نسازند.
4. صدور کد جدید، کد قبلی را برای همان هدف نامعتبر کند. شمارندهٔ تلاش ناموفق حساب/شماره را در ارسال مجدد حفظ کنید. در خطای مبهم ارسال، زمان انتظار را رعایت کنید و پذیرش `recId` را به‌عنوان وضعیت ارسال ذخیره کنید.
5. کد، متن کامل پیام، کلید و شمارهٔ کامل را از لاگ‌ها و ابزارهای پایش حذف کنید. NIST استفاده از شبکهٔ تلفن عمومی برای این نوع احراز هویت را محدود می‌داند. برای عملیات پرریسک، روش احراز هویت را متناسب با سطح اطمینان لازم انتخاب کنید. [NIST SP 800-63B-4][nist] · [راهنمای MFA در OWASP][owasp-mfa] · [راهنمای لاگ در OWASP][owasp-logging]

## ۷. تحویل، پیام دریافتی و عملیات تولید

### دلیوری و ارسال دوباره

در `GetDeliveries2`، `1` به معنی رسیدن به گوشی است. `0` و `8` به مرحلهٔ مخابرات مربوط‌اند و `200` ارسال‌شدن را گزارش می‌کند. `400` در صف، `35` لیست سیاه، `300` فیلترشده، `500` عدم پذیرش و `100` نامشخص است. کد `-3` در این عملیات خطای احراز هویت است. کد خام را همراه وضعیت داخلی ذخیره کنید. اگر `null` دریافت شد، دسترسی گزارش تحویل حساب را هم بررسی کنید. [جدول رسمی دلیوری][delivery]

| رخداد | کار بک‌اند |
| --- | --- |
| پذیرش ارسال با شناسه | `recId`، خانوادهٔ API، شناسهٔ داخلی و زمان پذیرش را ثبت کنید. از job استعلام با فاصلهٔ افزایشی، کمی پراکندگی زمانی و مهلت مشخص استفاده کنید. |
| خطای صریح ورودی، پترن، خط یا حساب | رخداد را ردشده ثبت کنید و بر اساس کد، تنظیمات یا ورودی را اصلاح کنید. |
| timeout، قطع اتصال پس از شروع درخواست، پاسخ نامعتبر، `5xx` یا توقف worker پیش از ذخیرهٔ پاسخ | وضعیت ارسال را نامعلوم ثبت کنید. ابتدا گزارش پنل یا شناسهٔ ثبت‌شده را تطبیق دهید. ارسال مجدد خودکار در این نقطه ممکن است پیام تکراری بسازد. |
| شکست استعلام دلیوری | استعلامِ خواندنی را در خطاهای موقت با backoff محدود تکرار کنید. |
| پایان مهلت استعلام با وضعیت مبهم | آخرین وضعیت و کد مشاهده‌شده را نگه دارید. تصمیم دربارهٔ ارسال دوباره را به سیاست همان نوع پیام بسپارید. |

برای پیام‌های تراکنشی، ثبت رخداد کسب‌وکار و ردیف صف ارسال را در یک تراکنش انجام دهید. کلید یکتای داخلی مانند `(eventId, channel, normalizedMobile)` جلوی درج هم‌زمان یک ارسال را می‌گیرد. worker باید رکورد را اتمیک بردارد و پیش از تماس با سرویس، وضعیت «در حال ارسال» را ثبت کند. پس از پاسخ، شناسه و نتیجه را ذخیره کند. در فاصلهٔ تماس خارجی تا ثبت نتیجه، وضعیت مبهم را برای تطبیق نگه دارید.

برای پایش، زمان پاسخ API، نرخ رد یا وضعیت مبهم، زمان رسیدن به وضعیت نهایی و افت اعتبار حساب را ثبت کنید. برای برآورد هزینه، متن نهایی پس از جایگذاری متغیرهای پترن را در نظر بگیرید. ظرفیت رایج یک بخش برای متن Unicode مانند فارسی ۷۰ واحد و برای GSM-7 برابر ۱۶۰ است. در پیام چندبخشی این اعداد معمولاً به ۶۷ و ۱۵۳ کاهش می‌یابند. ایموجی و کاراکترهای خاص می‌توانند بر شمارش اثر بگذارند. تعرفه و تعداد بخش محاسبه‌شده را با پنل و خط واقعی بررسی کنید. [ظرفیت بخش‌های SMS][sms-segments] · [تعرفهٔ پنل][price]

### پیام‌های دریافتی

- **خواندن دوره‌ای** با `GetMessages` و `location=1` شروع می‌شود. برای محدودهٔ زمانی، متد `GetMessagesByDate` را بررسی کنید. شناسهٔ پیام دریافتی را برای جلوگیری از پردازش دوباره ذخیره کنید و نقطهٔ ادامهٔ خواندن را پس از ثبت پایدار جلو ببرید. [GetMessages][messages] · [GetMessagesByDate][messages-by-date]
- **انتقال ترافیک از پنل** در بخش تنظیمات به URL پروژه درخواست `GET` می‌فرستد. نمونهٔ نگاشت `https://example.invalid/sms/inbound?to=$TO$&body=$TEXT$&from=$FROM$` است. `to` خط گیرنده، `from` شمارهٔ فرستنده و `body` متن است. نام پارامترهای برنامه را در URL ثبت‌شده تعیین کنید. [مستند رسمی انتقال پیام][inbound]
- روی URL دریافت، HTTPS، محدودیت اندازه و اعتبارسنجی ورودی را اعمال کنید. اصالت درخواست را با سازوکار تأییدشده برای حساب بسنجید. برای عملیات حساس، اگر پنل راه تأیید اصالت درخواست ورودی را ارائه نمی‌کند، پیام را از API احرازشدهٔ پنل بخوانید. Query string این مسیر حاوی متن و شماره است. آن را در پراکسی، APM و وب‌سرور ثبت نکنید.

### قابلیت‌های دیگر

| نیاز | نقطهٔ شروع |
| --- | --- |
| ارسال زمان‌دار یا تکرارشونده | [زمان‌بندی رسمی][schedule] و [پترن زمان‌دار][pattern-schedule]. منطقهٔ زمانی مورد انتظار متد، وضعیت و امکان لغو را با تست حساب مشخص کنید. |
| ارسال انبوه، متناظر یا منطقه‌ای | [وب‌سرویس انبوه][bulk]. محدودیت تعداد، مجوز خط و نگاشت نتیجه به مخاطب را برای همان متد ثبت کنید. |
| Smart و گزارش آن | [مستندات Smart][smart]. متد ارسال و استعلام Smart را از یک خانواده استفاده کنید. |
| مدیریت پترن | [مدیریت REST پترن][pattern-manage]. تأیید پترن را پیش‌نیاز فعال‌کردن پیام در محیط تولید قرار دهید. |
| پیام صوتی، دفترچه تلفن و نمایندگی | [صوتی][voice] · [دفترچه تلفن][contacts] · [نمایندگان][users]. دسترسی موردنیاز را مطابق پنل و متد بررسی کنید. |

## ۸. تحویل کار عامل به تیم

- [ ] خانوادهٔ API، عملیات، منبع قرارداد و تنظیمات محیط مشخص‌اند. کلید، پترن و خط در تنظیمات سرورند.
- [ ] شماره‌های `09…`، `+98…`، `0098…` و ارقام فارسی/عربی آزمون دارند. ورودی نامعتبر پیش از تماس رد می‌شود.
- [ ] قالب درخواست و ترتیب متغیرهای پترن با فیکسچر بررسی شده‌اند. شناسه‌های بزرگ `recId` از HTTP تا پایگاه داده بدون تغییر باقی می‌مانند.
- [ ] تست‌ها پذیرش ارسال، خطای کسب‌وکار در HTTP 200، HTML در HTTP 200، `4xx`، `5xx`، timeout و تفاوت پذیرش با تحویل را پوشش می‌دهند. دو درخواست هم‌زمان برای یک رخداد، پیام دوباره ایجاد نمی‌کنند.
- [ ] در OTP، انقضا، محدودیت درخواست و تلاش، ارسال مجدد و مصرف اتمیک تست شده‌اند. در دریافت پیامک، پردازش تکراری و ثبت‌نشدن متن در لاگ بررسی شده‌اند.
- [ ] مسیر عملی از IP خروجی محیط استقرار با حساب و شمارهٔ آزمایشی تست شده است. گزارش تحویل و تطبیق وضعیت مبهم قابل پیگیری است.

برای سپردن کار به یک عامل، این فایل را کنار مستندات پروژه، مثلاً `docs/melipayamak.md`، قرار دهید. می‌توانید دستور زیر را در تسک بگذارید.

> راهنمای ملی پیامک را بخوان. اتصال فعلی و تنظیمات پروژه را پیدا کن. قابلیت درخواستی را با خانوادهٔ API، خط و پترن تنظیم‌شده پیاده کن. درخواست و پاسخ را با فرستندهٔ شبیه‌سازی‌شده تست کن و پذیرش ارسال، دلیوری و وضعیت مبهم را قابل پیگیری کن. کار را با تست‌ها و تنظیمات لازم برای آزمون روی حساب واقعی تحویل بده.

## منابع

- مستندات و نمونه‌های اصلی ملی پیامک. [فهرست API][api] · [راهنمای پترن][pattern-blog] · [کنسول][console] · [مخزن رسمی Node.js][node-repo]
- بررسی تکمیلی قراردادهای کنسول. [سورس و فیکسچرهای کلاینت عمومی][console-sdk] · [راهنمای کنسول][console-guide] · [نمونهٔ عمومی OTP کنسول][console-otp]
- مراجع فنی برای پیاده‌سازی. [Node.js][node-fetch] · [MDN و دقت JSON][json-parse] · [NIST][nist] · [OWASP MFA][owasp-mfa] · [OWASP Logging][owasp-logging]

[api]: https://www.melipayamak.com/api/
[console]: https://console.melipayamak.com/auth/login
[send]: https://www.melipayamak.com/api/sendsimplesms2/
[pattern-v1]: https://www.melipayamak.com/api/sendbybasenumber/
[pattern]: https://www.melipayamak.com/api/sendbybasenumber2/
[pattern-v3]: https://www.melipayamak.com/api/sendbybasenumber3/
[pattern-blog]: https://www.melipayamak.com/blog/posts/sms-with-pattern-mode/
[otp]: https://www.melipayamak.com/api/sendotp/
[delivery]: https://www.melipayamak.com/api/getdelivery/
[credit]: https://www.melipayamak.com/api/getcredit/
[messages]: https://www.melipayamak.com/api/getmessages/
[messages-by-date]: https://www.melipayamak.com/api/getmessagesbydate/
[price]: https://www.melipayamak.com/api/getprice/
[inbound]: https://www.melipayamak.com/api/transfering-massage/
[schedule]: https://www.melipayamak.com/api/category/schedule-webservice/
[pattern-schedule]: https://www.melipayamak.com/api/addschedulesendbybasenumber2/
[bulk]: https://www.melipayamak.com/api/category/actions-webservice/
[smart]: https://www.melipayamak.com/api/category/smart-sms-api/
[pattern-manage]: https://www.melipayamak.com/api/category/rest-share-service-api/
[pattern-add]: https://www.melipayamak.com/api/add-pattern/
[voice]: https://www.melipayamak.com/api/category/voice-webservice/
[contacts]: https://www.melipayamak.com/api/category/contacts-webservice/
[users]: https://www.melipayamak.com/api/category/users-webservice/
[node-repo]: https://github.com/Melipayamak/melipayamak-node
[node-package]: https://github.com/Melipayamak/melipayamak-node/blob/378e2c47e4b45e8ae699f93744a1e95acde6de5b/package.json
[node-rest]: https://github.com/Melipayamak/melipayamak-node/blob/378e2c47e4b45e8ae699f93744a1e95acde6de5b/src/sms/restAsync.js
[node-rest-sync]: https://github.com/Melipayamak/melipayamak-node/blob/378e2c47e4b45e8ae699f93744a1e95acde6de5b/src/sms/rest.js
[node-soap]: https://github.com/Melipayamak/melipayamak-node/blob/378e2c47e4b45e8ae699f93744a1e95acde6de5b/src/sms/soapAsync.js
[node-wsdl]: https://github.com/Melipayamak/melipayamak-node/blob/378e2c47e4b45e8ae699f93744a1e95acde6de5b/src/baseSoap.js
[dotnet]: https://github.com/Melipayamak/melipayamak-Asp.net-Core/blob/master/RestClientAsync.cs
[console-sdk]: https://github.com/Goldis-Team/sms-providers-sdk/tree/af5a18f3c132ad632ef2616879dbb9e34656ce90
[console-guide]: https://sms92.niloblog.com/p/67/%D8%B1%D8%A7%D9%87%D9%86%D9%85%D8%A7%DB%8C-%D8%A7%D8%B3%D8%AA%D9%81%D8%A7%D8%AF%D9%87-%D8%A7%D9%86%D8%AF%D8%A7%D8%B2%DB%8C-%DA%A9%D9%86%D8%B3%D9%88%D9%84-%D9%85%D9%84%DB%8C-%D9%BE%DB%8C%D8%A7%D9%85%DA%A9
[console-otp]: https://sms92.niloblog.com/p/61/%D8%A7%D8%B1%D8%B3%D8%A7%D9%84-SMS-PHP-%D8%A8%D8%B1%D8%B1%D8%B3%DB%8C-REST-API-SOAP
[soap-domain]: https://t.me/s/Melipayamak?before=1417
[ip-notice]: https://t.me/melipayamak/1223
[npm-spec]: https://docs.npmjs.com/cli/v11/using-npm/package-spec/
[node-fetch]: https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html#fetch
[json-parse]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
[sms-segments]: https://www.twilio.com/docs/glossary/what-sms-character-limit
[nist]: https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#out-of-band
[owasp-mfa]: https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
[owasp-logging]: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
