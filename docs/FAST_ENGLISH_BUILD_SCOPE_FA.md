# Fast English — Scope اجرایی بازسازی از صفر

> یک محصول ساده برای خواندن و شنیدن انگلیسی در سطح مناسب؛ تجربه اصلی شبیه الگوی News in Levels، با برند، محتوا و طراحی مستقل.

| مشخصه | مقدار |
|---|---|
| نسخه سند | 1.0 — Build Baseline |
| تاریخ | ۷ اکتبر ۲۰۲۶ |
| زبان سند / رابط | فارسی / فارسی RTL، محتوای انگلیسی LTR |
| وضعیت | سند آماده برنامه‌ریزی و اجرا؛ پیشنهادها و اطلاعات لازم برای انتشار مشخص شده‌اند |
| محصول | Fast English؛ نام تجاری نهایی پیش از انتشار تعیین می‌شود |
| دامنه مرجع اسناد | `fastenglishpodcast.com`؛ مالکیت و دسترسی آن پیش از انتشار بررسی شود |
| پلتفرم | وب واکنش‌گرا + PWA + APK آنلاین Android |
| مقیاس مبنا | حدود ۱۰۰۰ کاربر احتمالی؛ معادل ۱۰۰۰ کاربر هم‌زمان نیست |
| معماری | یک Laravel application، یک دیتابیس، یک origin |
| انتخاب stack | Laravel + Blade + Livewire + Alpine + Tailwind/Flux Free + Filament + PostgreSQL |
| روش توسعه | Pi workflow نصب‌شده در مخزن، با sliceهای کوچک و یک نویسنده برای هر worktree |
| نحوه استفاده | فایل را به مخزن تازه و agent بده؛ ابتدا برنامه ساخت و سپس هر slice را اجرا کن |

## 0. قرارداد استفاده و وضعیت تصمیم‌ها

این سند مرجع تازه بازسازی است. کد، دیتابیس، UI، پیشرفت و ادعاهای «انجام‌شده» پروژه قبلی مبنای پیاده‌سازی نیستند. مهاجرت legacy در این کار وجود ندارد.

ترتیب اعتبار: آخرین دستور صریح صاحب محصول ← قرارداد پذیرفته‌شده slice جاری ← این سند و تصمیم‌های ثبت‌شده تازه ← مستندات فنی مخزن. اگر اختلافی کشف شد، آن را مشخص کن؛ دو رفتار متعارض را هم‌زمان پیاده نکن.

سه وضعیت در این سند:

- **قطعی گفتگو:** شروع از صفر، سادگی، mobile-first، تجربه متن/صوت سطح‌بندی‌شده، ظاهر حرفه‌ای و مقیاس کوچک.
- **مبنای اسناد ورودی:** پرداخت دستی، رسید خصوصی، اشتراک، A1–C2 و تعیین سطح. تا دستور تازه‌ای خلاف آن‌ها نباشد در برنامه ساخت حفظ شوند.
- **پیشنهاد اجرایی این نسخه:** انتخاب stack، تعیین سطح اختیاری، سه مقصد ناوبری، bookmark، واژه‌نامه کوچک، مدل ساده staff و جزئیات طراحی/عملیات. قابل تغییرند و به‌عنوان تأیید قبلی صاحب محصول معرفی نشوند.

قیمت، اطلاعات بانک، متن حقوقی و credential واقعی ساخته یا حدس زده نشوند. توسعه با fixture واضح ادامه پیدا کند؛ انتشار عمومی فقط با اطلاعات واقعی بخش 25 انجام شود.

اسناد Reboot v2.0، Remaining Scope، مقایسه stack و Pi Workflow Guide منابع ورودی بوده‌اند. جزئیات قدیمی React/PocketBase/Capacitor/MUI، subdomainهای جدا و ساختار قبلی در این baseline جایگزین شده‌اند. این فایل scope است؛ خود اپ ساخته یا آزمایش نشده است.

برای context محدود agent: در شروع بخش‌های 0–7 و 21–26؛ برای reader بخش‌های 8، 9، 13، 15، 17؛ برای پرداخت بخش‌های 8، 10، 11، 14، 16؛ برای release بخش‌های 18–20 و 23–25 خوانده شوند. نیاز و معیار مرتبط همیشه همراه slice باشد؛ کل سند در هر prompt تکرار نشود.

## 1. هدف محصول و تجربه اصلی

کاربر در چند قدم یک مطلب مناسب پیدا می‌کند، سطح آن را انتخاب می‌کند، متن را می‌خواند و همان نسخه را می‌شنود. بازگشت بعدی او از موقعیت ذخیره‌شده آغاز می‌شود.

مسیر اصلی:

1. دیدن یک نمونه واقعی پیش از پرداخت.
2. انتخاب مطلب و سطح.
3. خواندن متن و شنیدن صوت مرتبط.
4. دیدن معنی تعداد محدودی کلمه مهم.
5. ادامه از موقعیت قبلی یا ذخیره مطلب برای بعد.

مسیر درآمد: ساخت حساب ← انتخاب پلن ← مشاهده اطلاعات واریز ← کارت‌به‌کارت خارج از اپ ← ارسال رسید ← بررسی staff ← فعال‌شدن اشتراک.

اولویت‌ها به ترتیب: درستی جریان اصلی و دسترسی، UX ساده موبایل، خوانایی و کیفیت پخش، نگهداری آسان، سپس امکانات تکمیلی.

معیارهای خروجی نسخه اول:

- یک کاربر بدون راهنمایی حضوری نمونه را می‌بیند، درخواست پرداخت می‌فرستد و پس از تأیید محتوا را استفاده می‌کند.
- یک staff بدون ویرایش کد مطلب منتشر و رسید بررسی می‌کند.
- صوت، متن و progress هیچ‌وقت میان سطح‌ها یا کاربران مخلوط نمی‌شوند.
- درخواست تکراری یا هم‌زمان اثر اشتراک را دو بار اعمال نمی‌کند.
- نصب PWA و APK release و بازیابی backup با شواهد واقعی اثبات می‌شوند.

## 2. Stack و ابزارهای ساخت

این baseline فقط یک مسیر frontend دارد. استفاده قطعی از package اصلی `shadcn/ui` نیازمند تغییر ثبت‌شده به Laravel + Inertia + React است؛ دو frontend موازی ساخته نشوند.

| بخش | انتخاب نسخه اول | مسئولیت |
|---|---|---|
| Runtime سرور | PHP 8.4، patch پشتیبانی‌شده | اجرای اپ |
| Framework | Laravel 13.x | routing، session، validation، authorization، ORM، storage |
| رابط عمومی و زبان‌آموز | Blade + Tailwind CSS 4.1+ سازگار | HTML اولیه و طراحی اختصاصی |
| تعامل دارای داده سرور | Livewire 4.x | فرم‌ها، فیلترها و mutation |
| تعامل فوری مرورگر | Alpine همراه Livewire + JavaScript محدود | player، سرعت، seek و نمایش‌های محلی |
| اجزای پایه رابط | Flux Free موردنیاز + Blade اختصاصی | اجزای فرم و دسترس‌پذیری؛ بدون الزام Flux Pro |
| مدیریت | Filament 5.x Panel Builder | یک پنل staff |
| Auth | starter kit رسمی Livewire با Fortify | ورود، ثبت‌نام، reset و قابلیت‌های امنیتی استاندارد |
| داده | PostgreSQL نسخه پشتیبانی‌شده | داده و transaction واقعی |
| Build | Vite موجود در Laravel، npm | asset build؛ Node سرور API نیست |
| Style و آزمون PHP | Pint + Pest | style و proof رفتار |
| آزمون مرورگر | Playwright | مسیرهای حیاتی و بررسی browser-dependent |
| وب‌سرور تولید | Nginx + PHP-FPM | HTTPS، فایل عمومی، تحویل صوت محافظت‌شده |
| PWA | manifest + service worker محدود | نصب و fallback عمومی هنگام قطع شبکه |
| APK آنلاین | TWA با Bubblewrap | بسته Android برای همان سایت |
| CI | GitHub Actions یا runner معادل | verification تکرارپذیر |
| کمک به agent | Laravel Boost در محیط توسعه، اگر Pi سازگار باشد | مستندات و ابزارهای پروژه |

نسخه‌ها مبنای فعلی‌اند، نه اثبات سازگاری runtime. در slice نخست حل dependency با Composer، ورود، یک component Livewire و پنل Filament در scaffold تازه بررسی شود. نسخه‌های حل‌شده در `composer.lock` و `package-lock.json` ثبت شوند؛ نسخه PHP و Node build نیز pin شوند. majorها در هر session خودکار عوض نشوند.

Alpine دوباره از CDN یا bundle دوم بارگذاری نشود. assetهای Filament وارد layout زبان‌آموز نشوند. امکانات Pro، plugin و package اضافی فقط برای نیاز روشن همان slice اضافه شوند.

شروع با database session/cache/queue کافی است. Redis، Octane، WebSocket، موتور جست‌وجوی مستقل، monorepo، API عمومی و Docker شرط این scope نیستند.

## 3. محدوده نسخه اول با شناسه نیازها

| شناسه | قابلیت | خروجی قابل مشاهده |
|---|---|---|
| PUB-01 | معرفی عمومی | ارزش محصول، نمونه واقعی، پلن، نصب و پشتیبانی |
| PUB-02 | صفحات اعتماد | درباره، همکاری، FAQ، قوانین و حریم خصوصی با متن واقعی |
| AUTH-01 | حساب | ثبت‌نام با نام/ایمیل/رمز، ورود و خروج |
| AUTH-02 | بازیابی و session | reset با SMTP واقعی و session معتبر پس از refresh |
| LIB-01 | فهرست مطالب | جدیدترین مطالب، یک نتیجه برای هر موضوع، pagination |
| LIB-02 | پیدا کردن مطلب | فیلتر سطح/دسته و جست‌وجوی ساده عنوان |
| READ-01 | صفحه مطلب | انتخاب سطح، متن انگلیسی، صوت همان نسخه |
| READ-02 | واژه‌های مهم | واژه‌نامه کوچک مرتبط با نسخه، بدون سرویس دیکشنری |
| MEDIA-01 | player | play/pause، seek، عقب/جلو ۱۰ ثانیه، سرعت |
| MEDIA-02 | ادامه پخش | navigation داخلی بدون قطع ناخواسته؛ خطای شبکه قابل بازیابی |
| PROG-01 | progress | ادامه موقعیت و علامت تکمیل مستقل برای هر نسخه |
| SAVE-01 | ذخیره‌شده‌ها | bookmark موضوع و حذف آن |
| LEVEL-01 | سطح ترجیحی | تغییر صریح سطح پیش‌فرض، مستقل از تعیین سطح |
| PLACE-01 | تعیین سطح | آزمون ۲۰ سؤال، تصحیح سرور و پیشنهاد غیررسمی |
| PAY-01 | درخواست پرداخت | snapshot پلن/مبلغ/مقصد پیش از انتقال، رسید خصوصی |
| PAY-02 | وضعیت پرداخت | مشاهده وضعیت، دلیل رد و درخواست جدید |
| PAY-03 | بررسی staff | approve/reject با سابقه و اثر تراکنشی |
| SUB-01 | دسترسی | اشتراک فعال، تمدید، انقضا و لغو کنترل‌شده |
| ADM-01 | محتوا | موضوع، نسخه سطحی، تصویر، صوت، preview و publish |
| ADM-02 | عملیات | پلن، مقصد واریز، پشتیبانی، صف پرداخت و کاربران |
| MOB-01 | PWA | نصب، آیکون و fallback قطع شبکه بدون افشای داده |
| MOB-02 | APK | TWA release امضاشده، asset links و صفحه دانلود |
| OPS-01 | عملیات تولید | HTTPS، log، monitoring ضروری، backup و restore |
| QA-01 | تحویل | شواهد جریان واقعی و مرزهای امنیت/پرداخت/موبایل |

## 4. خارج از نسخه اول

درگاه و اتصال بانکی، تأیید خودکار/OCR رسید، native iOS، انتشار store، دانلود آفلاین محتوای پولی، Push، AI tutor، speaking، runtime AI/TTS، flashcard/SRS، ترجمه کامل درس، highlight کلمه‌به‌کلمه، import pipeline عمومی، dashboard نموداری، streak/gamification، پیشنهاددهنده الگوریتمی، coupon، affiliate، چند مدرس، چند زبان رابط و dark mode.

> به‌روزرسانی 2026-11-12 (درخواست صریح مالک، جایگزین این بند): «OTP پیامکی» از فهرست خارج شد و به‌صورت ورود/تأیید با موبایل و کد شش‌رقمی، در کنار ورود ایمیل/رمز و با ملی‌پیامک، وارد scope شد. جزئیات و معیار پذیرش در `docs/PRODUCT.md` و `docs/QUALITY.md` (AC-28) ثبت شده است. فروش/پرداخت، snapshot و قواعد دسترسی تغییر نکرد.

پیشرفت در صفحه مطلب و «ادامه» دیده می‌شود؛ صفحه مستقل آمار ساخته نمی‌شود. همکاری و پشتیبانی در آغاز لینک/صفحه اطلاعات‌اند؛ CRM یا ticketing داخلی ندارند.

این موارد فقط با تغییر صریح scope و معیار پذیرش جدید وارد برنامه شوند. نام یک قابلیت در wishlist مجوز شروع آن نیست.

## 5. نقش‌ها و اجازه‌ها

**پیشنهاد ساده نسخه اول:** دو نوع حساب کاربردی `student` و `staff` در مدل User، با `is_staff` محافظت‌شده. مدیر فنی مسئول استقرار است؛ superuser عمومی داخل محصول ساخته نمی‌شود. نقش/permission engine عمومی یا package RBAC در آغاز لازم نیست.

| عمل | Visitor | Student بدون اشتراک | Student فعال | Staff |
|---|---|---|---|---|
| معرفی، پلن و نمونه منتشرشده | بله | بله | بله | بله |
| metadata عمومی مطالب | بله | بله | بله | بله |
| متن/صوت premium منتشرشده | خیر | خیر | بله، تمام سطح‌های موجود | preview مجاز در پنل |
| پروفایل، bookmark و سابقه خود | خیر | بله | بله | فقط اطلاعات لازم پشتیبانی |
| پرداخت و رسید خود | خیر | بله | بله | بررسی همه درخواست‌ها |
| تعیین سطح و انتخاب سطح | خیر | بله | بله | مدیریت آزمون |
| محتوا، پلن و تنظیمات | خیر | خیر | خیر | بله |
| تغییر status پرداخت/اشتراک | خیر | خیر | خیر | فقط action مجاز و ثبت‌شده |

- صاحب محصول باید پیش از launch از دسترسی مشترک مالی/محتوا برای staff آگاه باشد. اگر کارکنان متفاوت به دسترسی محدود نیاز دارند، پیش از ایجاد حساب آن‌ها تفکیک permission به scope افزوده شود.
- staff از ثبت‌نام عمومی ایجاد نمی‌شود؛ bootstrap کنترل‌شده از CLI و ثبت مسئول آن.
- سیاست server و `canAccessPanel` لازم است؛ مخفی‌کردن دکمه یا URL کافی نیست.
- staff نمی‌تواند درخواست پرداخت متعلق به حساب خودش را approve کند.
- برای staff، 2FA استاندارد و session حساس پیش از launch الزامی این baseline است. recovery code و بازیابی عملیاتی خارج از Git نگهداری شوند.
- تعلیق حساب با `disabled_at` تمام عملیات احراز‌شده آن کاربر را متوقف می‌کند. صفحات عمومی برای بازدید ناشناس باقی می‌مانند.

## 6. ساختار صفحات و ناوبری

**پیشنهاد UX:** سه مقصد اصلی موبایل: «مطالب»، «ذخیره‌شده‌ها»، «حساب». تعیین سطح، پرداخت و تنظیمات مسیرهای فرعی‌اند؛ admin در ناوبری زبان‌آموز نیست.

| مسیر | نوع | محتوا / دسترسی |
|---|---|---|
| `/` | عمومی | معرفی کوتاه، نمونه، پلن و نصب |
| `/sample` | عمومی | یک نمونه واقعی منتشرشده |
| `/plans` | عمومی | پلن‌های فعال و روش پرداخت |
| `/install` و `/download` | عمومی | PWA و APK جاری |
| `/about`، `/cooperation`، `/faq`، `/support` | عمومی | محتوا و لینک تماس |
| `/terms`، `/privacy` | عمومی | متن مصوب کسب‌وکار |
| مسیرهای استاندارد Fortify | auth | ورود، ثبت‌نام، logout و reset |
| `/app` | فهرست | قابل مشاهده عمومی؛ metadata مجاز |
| `/app/topics/{slug}?level=B1` | مطلب | نمونه عمومی یا محتوای مجاز |
| `/app/saved` | student | bookmarkهای خود |
| `/app/account` | student | حساب، اشتراک و پرداخت جاری |
| `/app/account/settings` | student | پروفایل و سطح پیش‌فرض |
| `/app/placement` و `/app/placement/result/{attempt}` | student | آزمون و نتیجه خود |
| `/app/subscribe` | student | انتخاب پلن و اطلاعات واریز |
| `/app/payments/{request}` | owner | رسید و وضعیت درخواست |
| `/media/lessons/{lesson}/audio` | policy | فایل صوتی با Range |
| `/media/payment-requests/{request}/receipt` | owner/staff | تصویر خصوصی |
| `/admin` و resourceهای Filament | staff | پنل واحد عملیات |

این‌ها قرارداد URL پیشنهادی‌اند؛ endpointهای داخلی Livewire طبق framework استفاده شوند. برای همه قابلیت‌ها REST API موازی ساخته نشود. auth logout فقط mutation دارای CSRF است، نه لینک GET.

Landing کوتاه باشد: وعده روشن، یک نمونه، روش کار، پلن، نصب و FAQ. جزئیات درباره/همکاری در صفحه فرعی؛ ۱۵ بلوک طولانی تکراری در موبایل لازم نیست.

## 7. جریان‌های کاربر و وضعیت‌های خطا

### 7.1 نمونه و اولین استفاده

Visitor بدون ثبت‌نام نمونه متن/صوت را استفاده می‌کند. metadata همه مطالب منتشرشده قابل دیدن است؛ بازکردن premium اطلاعات محدود و CTA اشتراک را نشان می‌دهد و متن/صوت premium را در HTML یا پاسخ Livewire نمی‌فرستد.

ثبت‌نام با نام، ایمیل و رمز انجام می‌شود. phone اختیاری است. اشتراک شرط ساخت حساب نیست. تعیین سطح پیشنهادی و قابل ردکردن است؛ کاربر می‌تواند مستقیم سطح را انتخاب کند.

### 7.2 مطالعه و تغییر سطح

- فهرست با سطح پیش‌فرض آغاز می‌شود؛ مهمان سطح انتخابی را فقط به‌عنوان preference غیرحساس مرورگر نگه می‌دارد.
- انتخاب موقت سطح در URL ثبت می‌شود و سطح پیش‌فرض حساب را بی‌صدا تغییر نمی‌دهد.
- اگر نسخه سطح انتخابی موجود نباشد، همین موضوع با پیام «این سطح هنوز آماده نیست» و سطح‌های موجود نمایش داده شود؛ جایگزینی پنهان ممنوع.
- تغییر سطح، صوت قبلی را متوقف و state نسخه تازه را بارگذاری می‌کند. شروع صوت تازه نیازمند عمل کاربر است.
- اگر تغییر سطح/مطلب شکست خورد، متن و player متناقض نمایش داده نشوند؛ خطا و retry مشخص باشد.
- Back/Forward مرورگر، URL سطح و نسخه نمایش‌داده‌شده را هماهنگ نگه دارند.

### 7.3 خرید، رد و تمدید

کاربر وارد حساب می‌شود، پلن را انتخاب می‌کند و سرور درخواست `awaiting_receipt` با snapshot می‌سازد. سپس مبلغ/مقصد ثابت همان درخواست نمایش داده می‌شود. کاربر خارج از اپ انتقال می‌دهد و رسید می‌فرستد؛ وضعیت `pending` می‌شود.

Pending دسترسی تازه ایجاد نمی‌کند. اگر اشتراک قبلی فعال است، همان دسترسی حفظ می‌شود. پس از رد، دلیل عمومی و امکان ساخت درخواست تازه نمایش داده شود؛ درخواست قبلی بازنویسی نشود.

Approve اشتراک را ایجاد/تمدید می‌کند. نتیجه در حساب دیده شود؛ برای مشاهده آن websocket لازم نیست. صفحه pending دکمه «بررسی وضعیت» دارد؛ polling سریع دائمی انجام نشود.

### 7.4 خطاهای مشترک

حالت خالی، loading، validation، session منقضی/CSRF، قطع شبکه، فایل نامعتبر، pending، rejected، expired subscription و محتوای حذف‌شده، همگی متن روشن و عمل بعدی دارند. خطا مقدار فرم را تا جایی که امن است حفظ کند؛ success پیش از تأیید سرور نشان داده نشود.

## 8. قواعد دسترسی و زمان

حق دسترسی از سرور و دیتابیس محاسبه شود:

`eligible = user exists AND disabled_at is null AND subscription.revoked_at is null AND starts_at <= now_utc < expires_at`

نمونه عمومی فقط وقتی مجاز است که topic و lesson هر دو published و `is_public_sample=true` باشند. preview draft برای staff از مسیر مجاز پنل است.

- تمام A1–C2های منتشرشده برای subscriber واجد شرایط مجازند. سطح آموزشی یک permission نیست.
- فهرست عمومی شامل عنوان، تصویر، خلاصه مستقل، دسته و سطح‌های موجود است؛ body، glossary پولی، path خصوصی و پاسخ آزمون را شامل نمی‌شود.
- دسترسی صفحه، فایل صوت، progress mutation و actionهای Livewire مستقل در سرور بررسی شوند.
- در لحظه انقضا، درخواست‌های بعدی premium رد شوند. بایت‌های قبلاً دریافت‌شده و buffer مرورگر قابل پس‌گرفتن نیستند؛ ادعای DRM وجود ندارد.
- `active/expired/pending/rejected` وضعیت‌های نمایشی مشتق‌شده‌اند؛ `account_status` موازی و مستعد تناقض روی users نگهداری نشود.
- timestampها UTC ذخیره شوند؛ نمایش زمان عملیات Asia/Tehran. مدت پلن تعداد روز دقیق است، نه ماه تقویمی.
- پول integer تومان است؛ float و تبدیل مبهم ریال/تومان ممنوع. این واحد در DB field، UI و snapshot روشن بماند.

## 9. محتوا و انتشار

### 9.1 مدل مفهومی

Category اختیاری برای هر Topic؛ Topic مطلب مشترک؛ Lesson نسخه همان مطلب در یک سطح. در UI زبان‌آموز اصطلاح اصلی «مطلب» است. مدل‌های موازی `stories/episodes/topics` برای یک مفهوم ساخته نشوند.

شش مقدار ثابت سطح: `A1, A2, B1, B2, C1, C2`. هر topic حداکثر یک lesson برای هر سطح دارد. انتشار همه شش نسخه هم‌زمان اجباری نیست؛ حداقل یک نسخه کامل منتشرشده لازم است. نمونه دارای دو سطح متفاوت برای نشان‌دادن تفاوت باشد.

### 9.2 داده هر نسخه

عنوان انگلیسی، body انگلیسی پاراگراف‌بندی‌شده، یک صوت مستقل متناظر، مدت صوت تأییدشده، زمان تقریبی مطالعه و glossary اختیاری تا ۱۲ مدخل.

Glossary در یک JSON اعتبارسنجی‌شده نگهداری شود: `word` انگلیسی، `meaning_fa` و `example_en` اختیاری. دیکشنری جهانی، pronunciation API و مدیریت واژه‌های کاربر ساخته نشوند.

body در نسخه اول متن ساده با پاراگراف است. HTML دلخواه و script پذیرفته نشود. متن فارسی، انگلیسی، اعداد و ورودی staff هم هنگام rendering escape شوند.

### 9.3 چرخه انتشار

`draft → published → archived`، با امکان بازگرداندن کنترل‌شده به draft. انتشار action صریح است.

شرط publish: topic معتبر، سطح معتبر، title/body غیرخالی، فایل صوتی موجود و قابل پخش، duration معتبر، review محتوایی و ثبت reviewer/time. draft از فهرست عمومی، جست‌وجو، URL مستقیم و media route ناشناس پنهان باشد.

metadata والد همراه حداقل یک lesson منتشر شود. پس از archive آخرین lesson، موضوع در فهرست محتوای قابل استفاده نمایش داده نشود. تغییر وضعیت انتشار و قواعد والد/فرزند در یک action معتبر مدیریت شوند.

تعویض فایل صوت `audio_revision` را افزایش می‌دهد. درخواست progress با revision قدیمی، پیشرفت صوت جدید را بازنویسی نمی‌کند. title یا اصلاح تایپ ساده بدون تغییر صوت، revision صوت را عوض نمی‌کند.

### 9.4 تولید محتوا

AI می‌تواند خارج از runtime اپ برای آماده‌سازی متن/صوت کمک کند. staff مسئول صحت، تناسب سطح، هماهنگی صوت و متن، اجازه استفاده از تصویر/صوت و ثبت source note است. API تولید محتوا، prompt store و auto-publish در نسخه اول وجود ندارند.

حدود اولیه upload پیشنهادی: صوت MP3 حداکثر ۳۰ MB، تصویر cover حداکثر ۲ MB از JPEG/PNG/WebP. نمونه واقعی و مدت ۱ تا ۸ دقیقه ترجیح محتوایی است؛ ادعای اندازه‌گیری آموزشی نیست. تبدیل صوت در pipeline تولید محتوا انجام شود؛ FFmpeg سرویس runtime پیش‌فرض نیست.

topic/lesson دارای سابقه استفاده archive شود؛ حذف فیزیکی بی‌قاعده و cascade روی سابقه مالی/پیشرفت ممنوع.

## 10. پرداخت دستی: وضعیت، snapshot و فایل

### 10.1 وضعیت‌های درخواست

| وضعیت فعلی | عمل | وضعیت بعد | اثر |
|---|---|---|---|
| وجود ندارد | انتخاب پلن توسط owner | awaiting_receipt | snapshot و نمایش اطلاعات واریز |
| awaiting_receipt | receipt معتبر و submit | pending | ورود به صف بررسی |
| awaiting_receipt | cancel توسط owner/staff | cancelled | بدون اثر اشتراک |
| pending | approve توسط staff مجاز | approved | یک اثر اشتراک |
| pending | reject با دلیل عمومی | rejected | بدون اثر تازه |
| pending | cancel توسط staff با دلیل | cancelled | بدون اثر اشتراک؛ سابقه/receipt طبق retention |
| approved | approve مجدد | approved | پاسخ idempotent، بدون تمدید مجدد |
| rejected/cancelled | خرید دوباره | درخواست تازه | سابقه قبلی حفظ شود |
| وضعیت نهایی | تغییر غیرمجاز | همان وضعیت | رد سرور |

در pending، plan، مقصد، snapshot و receipt قابل ویرایش توسط student نیستند. cancellation درخواست pending در این baseline فقط توسط staff و با دلیل انجام شود؛ کاربر با پشتیبانی تماس می‌گیرد.

فقط یک درخواست باز `awaiting_receipt/pending` برای هر user مجاز است. با درخواست باز موجود، صفحه همان درخواست را برمی‌گرداند. برای تغییر پلن قبل از انتقال، draft لغو و درخواست تازه ساخته شود.

### 10.2 Snapshot قبل از انتقال

سرور از plan و مقصد فعال می‌خواند و این‌ها را ذخیره می‌کند: نام پلن، قیمت تومان، مدت روز، شماره کارت مقصد، نام صاحب کارت و بانک. client فقط plan ID را انتخاب می‌کند؛ مبلغ، مدت، مقصد و status را تعیین نمی‌کند.

**پیشنهاد تجاری نسخه اول:** snapshot ایجادشده تا تصمیم نهایی درخواست محترم است؛ timeout خودکار یا تغییر قیمت draft وجود ندارد. این سیاست ساده باید پیش از فروش توسط صاحب محصول پذیرفته شود. اگر قیمت مدت اعتبار لازم دارد، expiry و رسید انتقال پس از expiry باید ابتدا قرارداد جدا بگیرند؛ صرفاً با cron درخواست مالی پاک نشود.

ویرایش پلن/مقصد فقط درخواست‌های بعدی را تغییر دهد. اگر مقصد بانکی مشکل عملیاتی پیدا کرد، draftهای باز از پنل با اطلاع‌رسانی و audit رسیدگی شوند؛ مقصد قبلی بی‌صدا جایگزین نشود.

اطلاعات انتقال اختیاری: کد پیگیری، زمان انتقال و چهار رقم آخر کارت مبدأ. اطلاعات CVV2، رمز، انقضا، شماره کامل کارت مبدأ یا تصویر کارت جمع‌آوری نشوند.

### 10.3 Receipt

- یک تصویر JPEG/PNG/WebP، حداکثر ۵ MB؛ SVG، HTML، PDF و executable پذیرفته نشوند.
- MIME/signature و امکان decode تصویر بررسی شود؛ حد ابعاد پیشنهادی ۶۰۰۰×۶۰۰۰ برای کنترل مصرف منابع.
- metadata غیرضروری با re-encode حذف شود؛ فایل زیر نام تصادفی خارج از public نگهداری شود.
- مالک درخواست و staff مجاز با session/policy تصویر را ببینند؛ URL عمومی دائمی ساخته نشود.
- فایل روی disk نوشته، سپس DB mutation انجام شود. در failure پاک‌سازی compensating و job فایل‌های orphan لازم است؛ DB transaction فایل‌سیستم را اتمیک نمی‌کند.
- تا تأیید ثبت DB، پیام موفقیت نمایش داده نشود. retry بعد از timeout، همان pending ثبت‌شده را نشان دهد و درخواست تازه نسازد.
- preview/file response خصوصی و no-store باشد؛ receipt/path/بانک‌مرجع در log عمومی یا analytics نیاید.
- رسید به‌تنهایی اثبات پرداخت نیست. staff خارج از اپ با حساب مقصد تطبیق می‌دهد و سپس action را اجرا می‌کند.

## 11. اثر اشتراک و مقاومت در برابر تکرار

### 11.1 منبع حقیقت

برای هر user یک ردیف `subscriptions` با window جاری وجود دارد. هر approve یا تغییر دستی معتبر، یک `subscription_events` تغییرناپذیر ثبت می‌کند. درخواست پرداخت منبع یک event یکتا است؛ این طراحی از lost update و اعمال دوباره جلوگیری می‌کند.

دسترسی از window جاری محاسبه می‌شود؛ audit/event برای سابقه و idempotency است. نتیجه مالی با status اضافی روی User تکرار نشود.

### 11.2 ApprovePayment

تمام مسیرهای UI/CLI مجاز از یک action مشترک استفاده کنند؛ منطق approval داخل resource Filament کپی نشود.

ترتیب منطقی:

1. بررسی staff، تعلیق، CSRF و ممنوعیت self-approval.
2. شروع transaction و قفل ردیف User مالک، سپس PaymentRequest، سپس subscription؛ ترتیب قفل ثابت باشد.
3. اگر request approved است، همان نتیجه قبلی بازگردد؛ هیچ event/تاریخ تازه‌ای ساخته نشود. وضعیت rejected/cancelled یا بدون receipt رد شود.
4. خواندن snapshotهای ذخیره‌شده و ساخت/قفل subscription.
5. اگر window فعلی فعال و لغونشده است: `base = current_expires_at`. در غیر این صورت: `base = approved_at_utc`.
6. `new_expires_at = base + duration_days_snapshot × 24h`. برای دسترسی تازه starts_at زمان approve است؛ در تمدید فعال starts_at حفظ شود. revoked_at در خرید تازه معتبر پاک شود.
7. درج event با source_payment_request یکتا، before/after expiry، duration، actor و زمان.
8. تغییر request به approved و ثبت reviewer/time، همراه به‌روزرسانی subscription.
9. commit؛ نمایش نتیجه و ارسال notification فقط پس از commit و در صورت نیاز.

مثال: اشتراک تا ۲۰ مهر فعال است؛ پرداخت ۳۰روزه امروز تأیید می‌شود؛ ۳۰ روز به پایان فعلی اضافه می‌شود. برای اشتراک منقضی، ۳۰ روز از زمان approve آغاز می‌شود.

قفل User تغییرهای متفاوت اشتراک یک کاربر، مانند approve و grant دستی، را serialize می‌کند و race ایجاد اولین subscription را کنترل می‌کند. با قاعده یک درخواست باز، دو pending مستقل برای یک user حالت معتبر نیست. unique index به‌تنهایی جای قفل/قواعد وضعیت نیست. race/replay با PostgreSQL واقعی اثبات شود.

### 11.3 Reject، لغو و تغییر دستی

Reject فقط pending، با دلیل عمومی غیرخالی و internal note جدا؛ request lock و audit در transaction. approval و rejection هم‌زمان باید یک نتیجه نهایی داشته باشند.

student نمی‌تواند subscription بسازد یا تاریخ آن را ویرایش کند. staff برای اصلاح دستی، revoke یا grant حمایتی action مشخص با reason اجباری و event دارد. همه این actionها در transaction با همان ترتیب قفل User سپس subscription اجرا شوند. فیلد expires_at به‌صورت CRUD آزاد قابل ویرایش نباشد.

لغو subscription حق دسترسی جاری را متوقف می‌کند؛ refund خودکار انجام نمی‌شود. اگر approve قدیمی replay شود، subscription لغوشده دوباره فعال نشود. refund و خطای بانکی به سیاست انسانی پشتیبانی ارجاع شوند.

## 12. تعیین سطح و ترجیح کاربر

**پیشنهاد UX این نسخه:** تعیین سطح اختیاری است؛ ساخت حساب، نمونه و استفاده subscriber به تکمیل آن وابسته نیستند.

- هر نسخه آزمون دقیقاً ۲۰ سؤال چندگزینه‌ای، چهار گزینه و یک پاسخ صحیح دارد.
- نسخه منتشرشده آزمون و questionهای آن تغییرناپذیرند. ویرایش، نسخه جدید draft ایجاد می‌کند.
- فقط یک نسخه published به‌عنوان is_current فعال باشد؛ انتشار نسخه جدید، current قبلی را خاموش می‌کند. attemptهای باز به نسخه ثابت قبلی تعلق دارند و با سؤال‌های تازه مخلوط نمی‌شوند.
- در start، attempt و نسخه آزمون در سرور ثبت شوند. پاسخ صحیح/وزن تصحیح به client یا public property Livewire ارسال نشود.
- پاسخ‌ها با question ID همان attempt، بدون duplicate و بدون question خارجی اعتبارسنجی شوند. پاسخ ناقص نتیجه قطعی ایجاد نکند.
- تصحیح server-side، با ۱ امتیاز برای جواب صحیح و صفر برای غلط؛ submit تکراری همان نتیجه ثبت‌شده را برگرداند.
- نتیجه فقط score، سطح پیشنهادی و توضیح «راهنمای اولیه، بدون گواهی رسمی» است.
- پذیرش نتیجه، preferred_level را صریح تغییر می‌دهد. تغییر سطح مرور، recommended_level را تغییر نمی‌دهد.
- پیشنهاد اولیه محدودیت: یک attempt باز برای هر user و یک شروع تازه در ۲۴ ساعت؛ resume همان attempt مجاز.
- پاسخ‌های انتخاب‌شده برای resume سمت سرور ذخیره شوند؛ transition هر سؤال یک mutation قابل بازیابی است. answer key به صفحه برنگردد.

**جدول اولیه پیشنهادی برای fixture و تصمیم مدرس، نه مقیاس علمی معتبر:**

| امتیاز | سطح پیشنهادی |
|---|---|
| ۰–۳ | A1 |
| ۴–۷ | A2 |
| ۸–۱۱ | B1 |
| ۱۲–۱۵ | B2 |
| ۱۶–۱۸ | C1 |
| ۱۹–۲۰ | C2 |

پیش از فعال‌کردن آزمون عمومی، مدرس باید سؤال‌ها، وزن ساده و مرزبندی سطح‌ها را تأیید کند. سؤال placeholder یا این جدول به‌تنهایی کیفیت تعیین CEFR را ثابت نمی‌کند. غیرفعال بودن آزمون، انتخاب دستی سطح و بقیه محصول را مسدود نکند.

## 13. Player، progress و bookmark

### 13.1 قرارداد player

یک `HTMLAudioElement` در layout مشترک زبان‌آموز وجود دارد، خارج از componentهای تعویض‌شونده، با `@persist` برای `wire:navigate`. کنترل‌های فوری در JS/Alpine هستند؛ timeupdate به property سرور bind نشود.

داده فعال player: lesson_id، audio_revision، عنوان/سطح، currentTime، duration، speed و وضعیت. یک مالک state؛ چند audio element هم‌زمان ساخته نشوند.

- سرعت‌های اولیه: 0.75، 1، 1.25 و 1.5؛ عقب/جلو ۱۰ ثانیه، با clamp معتبر.
- autoplay بدون عمل کاربر وجود ندارد. rejection از play و buffering/error با UI قابل فهم مدیریت شود.
- navigate به فهرست/حساب در همان layout می‌تواند پخش را ادامه دهد؛ mini-player نشان می‌دهد چه مطلب/سطحی در حال پخش است.
- بازکردن مطلب/سطح متفاوت player قبلی را متوقف می‌کند؛ متن تازه کنار صوت قدیمی نمایش داده نشود.
- logout و ورود به admin پخش را قطع، src و state خصوصی را پاک می‌کند؛ عبور از این مرزها full navigation دارد.
- listenerهای navigation فقط یک‌بار ثبت و با lifecycle صحیح پاک شوند؛ تکرار play/progress در رفت‌وبرگشت ممنوع.
- Media Session در صورت پشتیبانی مرورگر، metadata و کنترل‌های استاندارد را تنظیم کند. background/lock screen تضمین بین همه OSها ندارد و شواهد دستگاه واقعی لازم است.

### 13.2 ذخیره و بازیابی

progress برای `user + lesson` مستقل است. position آخرین موقعیت معتبر است، نه بیشترین seek؛ کاربر می‌تواند عقب برگردد.

در هنگام پخش، حداکثر هر ۱۵ ثانیه و هنگام pause/end save انجام شود. pagehide/visibilitychange فقط best effort است؛ به آن برای دوام قطعی تکیه نشود. قطع شبکه آخرین save تأییدشده را حفظ می‌کند و UI به‌دروغ «ذخیره شد» نمی‌گوید. صف offline عمومی ساخته نشود.

پس از refresh، position تأییدشده از DB خوانده شود؛ هیچ صوتی خودکار پخش نشود. multi-device در نسخه اول «آخرین write معتبر سرور» است؛ sync هم‌زمان پیشرفته خارج scope.

ورودی server: lesson ID، audio_revision و position finite در محدوده duration سروری. duration ارسالی client منبع حقیقت نیست. revision قدیمی رد شود و client موقعیت نسخه جدید را بگیرد؛ progress قدیمی برای صوت تازه صفر نمایش داده شود تا دوباره ثبت شود.

تکمیل از ended یا دکمه صریح «خواندم» ثبت می‌شود؛ دورزدن با seek گواهی آموزشی ایجاد نمی‌کند. تکمیل تا reset صریح user باقی می‌ماند؛ pauseهای بعدی آن را پاک نکنند. برای audio_revision تازه، completion قبلی به نسخه صوت تازه نسبت داده نشود.

### 13.3 Bookmark

bookmark متعلق به Topic است، نه سطح. یک unique pair `user_id/topic_id`؛ toggle تکراری اثر معین دارد. بازکردن bookmark با preferred_level و قواعد نبودن نسخه انجام شود. account بدون اشتراک می‌تواند bookmark و سابقه خود را ببیند؛ متن/صوت premium همچنان نیازمند دسترسی است.

## 14. مدل داده و محدودیت‌های دیتابیس

مدل‌ها هنگام slice مرتبط اضافه شوند؛ کل schema قبل از اولین صفحه واقعی پیاده نشود. primary key استاندارد Laravel کافی است؛ policy امنیت را تأمین می‌کند. timestampها UTC و روابط دارای foreign key باشند.

| جدول | فیلدهای اصلی دامنه |
|---|---|
| users | name، email unique، password استاندارد، is_staff، disabled_at، preferred_level؛ فیلدهای auth/2FA استاندارد |
| categories | name_fa، slug unique، display_order، is_active |
| topics | category_id nullable، slug unique، title_en، summary_public، cover_path public، source_note private، status، published_at |
| lessons | topic_id، level، title_en، body_en، glossary JSON، audio_path private، audio_revision، duration_seconds، estimated_minutes، is_public_sample، status، reviewed_by/at |
| lesson_progress | user_id، lesson_id، audio_revision، position_seconds، started_at، completed_at، updated_at |
| bookmarks | user_id، topic_id، created_at |
| plans | slug unique، name_fa، price_toman integer، duration_days integer، is_active، display_order |
| payment_destinations | card_number، holder_name، bank_name، instructions، is_active؛ حداکثر یک مقصد فعال |
| payment_requests | user_id، plan_id، destination_id، plan_name_snapshot، amount_toman_snapshot، duration_days_snapshot، destination_snapshot JSON، receipt_path private، receipt_deleted_at، bank_reference، sender_last4، transferred_at، status، public_reason، internal_note، reviewed_by/at، cancelled_by/at |
| subscriptions | user_id unique، starts_at، expires_at، revoked_at nullable، updated_at |
| subscription_events | user_id، subscription_id، source_payment_request_id nullable unique، type، before/after window، duration_days nullable، actor_id، reason، created_at |
| placement_tests | version unique، status، is_current، scoring_rules JSON server-only، published_at |
| placement_questions | test_id، position، prompt، options JSON، correct_option server-only |
| placement_attempts | user_id، test_id، status، started_at، completed_at، score، recommended_level |
| placement_answers | attempt_id، question_id، selected_option، server_correctness/score |
| app_settings | کلیدهای محدود support_contact، review_sla_text، business_hours و اطلاعات عمومی لازم |

session، queue/job، cache و password reset جدول‌های framework هستند؛ به‌عنوان entity محصول دوباره طراحی نشوند. audit مالی و تغییر انتشار حداقلی در event/actionها ثبت شود؛ event sourcing عمومی ساخته نشود.

محدودیت‌های الزامی:

- unique `lessons(topic_id, level)`، `lesson_progress(user_id, lesson_id)` و `bookmarks(user_id, topic_id)`.
- partial unique در PostgreSQL روی `payment_requests(user_id)` برای status در awaiting_receipt/pending.
- unique `subscription_events(source_payment_request_id)` برای مقدار غیرnull و `subscriptions(user_id)`.
- unique `placement_answers(attempt_id, question_id)` و `placement_questions(test_id, position)`.
- partial unique روی placement_attempts(user_id) برای status=in_progress؛ مقدارهای attempt محدود به in_progress/completed/abandoned. فقط یک placement_tests.is_current=true با شرط published مجاز است.
- حداکثر یک مقصد بانکی فعال با constraint مناسب؛ اصلاح مقصد، history snapshot را تغییر ندهد.
- check سطح/وضعیت‌های مجاز، مبلغ مثبت برای پلن پولی و snapshot، duration مثبت و expiry پس از start؛ validation سطح اپ نیز لازم است.
- indexهای فهرست روی status/published_at، topic/category، صف payment(status, created_at)، و progress(user_id, updated_at).
- حذف user/topic/plan نباید سابقه مالی را cascade حذف کند. archive/disable مسیر پیش‌فرض است.
- password، 2FA secret، correct_option، internal_note و private path در serialization عمومی hidden باشند؛ hidden جای DTO/انتخاب فیلد مجاز نیست.

## 15. معماری و مالکیت state

یک Laravel app، public/student/staff در یک repository و origin. هیچ subdomain یا auth client جدا در این baseline لازم نیست. صفحات Blade HTML اولیه دارند؛ Livewire فقط در جای نیاز واقعی به state سرور استفاده شود.

| state | مالک | قاعده |
|---|---|---|
| داده، role، انتشار، access و پول | PostgreSQL/Laravel | client اجازه تعیین ندارد |
| سطح مرور، دسته، query و page | URL | back/share/refresh سازگار |
| preferred_level | User | فقط تغییر صریح settings/پذیرش تعیین سطح |
| recommended_level | آخرین attempt کامل | مرور سطح آن را تغییر نمی‌دهد |
| فرم و validation | Livewire/Laravel | سرور مرجع اعتبارسنجی |
| currentTime، speed، play state | JS player | بدون round-trip کنترل فوری |
| progress تأییدشده | DB، scoped به user/lesson | مرورگر فقط درخواست ذخیره می‌دهد |
| preference غیرحساس مهمان | localStorage محدود | بدون token، receipt، lesson body یا answer key |
| theme | در نسخه اول light ثابت | dark/system بعداً با scope مستقل |

مسیرهای اصلی کد، متعارف Laravel:

| محل پیشنهادی | مسئولیت |
|---|---|
| routes/web.php | صفحات و media/controller routeهای ضروری |
| app/Models | entity و relationshipها |
| app/Policies | ownership و دسترسی |
| app/Livewire | فهرست/فرم/حساب/placement دارای state سرور |
| app/Http/Controllers | فایل محافظت‌شده و HTTP ضروری |
| app/Http/Requests | validation درخواست‌های controller |
| app/Actions | قواعد مشترک حساس، مانند ApprovePayment/RejectPayment/PublishLesson |
| app/Filament | resource و actionهای پنل |
| resources/views | layout عمومی/student، Blade و اجزای موردنیاز |
| resources/js/player.js | lifecycle واحد صوت |
| resources/css/app.css | semantic tokens و سبک learner |
| database/migrations و seeders | schema، constraints و fixtures |
| tests/Feature و tests/Unit | proof PHP در لایه مناسب |
| tests/browser | مسیرهای browser-dependent |
| docs | قراردادها، برنامه و evidence |

از فایل‌ها و نام‌های ایجادشده starter kit استفاده شود؛ آن‌ها فقط برای شبیه‌کردن به این جدول جابه‌جا نشوند. controller/service/repository/manager موازی برای هر model ساخته نشود. direct Eloquent مناسب است؛ action برای یک قانون مشترک یا تراکنشی لازم است.

قابلیت جدید فقط dependency لازم خودش را اضافه کند. abstraction برای استفاده فرضی آینده، event bus عمومی، wrapper روی همه کلاس‌های framework و design system package جدا ممنوع این baseline‌اند.

## 16. قرارداد تحویل فایل و امنیت

صوت و receipt روی private disk خارج از public هستند. cover/آیکون/asset عمومی می‌توانند public باشند. path فیزیکی با ورودی مستقیم کاربر ساخته نشود؛ lookup با model و path سروری انجام شود.

برای صوت، کنترلر ابتدا policy و revision را بررسی می‌کند. در production تحویل بایت با location داخلی Nginx و `X-Accel-Redirect` انجام شود؛ URL خارجی location داخلی باید 404 بدهد. رفتار Range با فایل واقعی و configuration واقعی بررسی شود.

در توسعه، file response استاندارد دارای پشتیبانی Range قابل استفاده است. هیچ مسیر صوتی کل فایل را با file_get_contents در حافظه PHP بارگذاری نکند. اگر راه تحویل فایل تغییر کرد، access/Range دوباره اثبات شوند.

قرارداد HTTP:

- `GET/HEAD` معتبر، `Accept-Ranges` و پاسخ 206/Content-Range برای Range معتبر.
- Range خارج محدوده پاسخ 416؛ seek بعد از دریافت بخشی از فایل درست باشد.
- media خصوصی، HTML حساب و Livewire response خصوصی `Cache-Control: private, no-store` داشته باشند.
- receipt، auth، admin و media خصوصی وارد CDN/SW cache عمومی نشوند.
- response asset عمومی fingerprinted می‌تواند cache طولانی داشته باشد.
- uploadها size/type محدود؛ فایل نامعتبر خطای 422، دسترسی غیرمجاز 403/404 مطابق قرارداد route و session نامعتبر مسیر auth دارد.
- debug، stack trace، query و secret در production نمایش داده نشوند.

CSRF، secure/HttpOnly session cookie و SameSite مناسب، session regeneration، password hashing و rate limit از قابلیت استاندارد framework استفاده کنند. token احراز هویت در localStorage ذخیره نشود.

مقادیر اولیه rate limit پیشنهادی: login پنج تلاش ناموفق در دقیقه به‌ازای ترکیب حساب/IP؛ upload پنج درخواست در دقیقه و ساخت درخواست مالی ده بار در روز برای user. این مقادیر با نمونه واقعی تنظیم شوند؛ محدودیت IP به‌تنهایی پشت شبکه مشترک کاربر مشروع را مسدود نکند.

تمام Livewire actionها داده و ID را untrusted بدانند؛ public property، locked attribute و button disabled جای policy و transaction نیستند. secret یا answer key در hydration snapshot قرار نگیرد.

## 17. قرارداد UI/UX

### 17.1 جهت طراحی

آرام، حرفه‌ای، بزرگسال، خوانا و editorial؛ تمرکز بصری بر متن، تصویر مطلب و پخش. طراحی learner اختصاصی است و الگوی dashboard ادمین به آن منتقل نشود.

هویت navy/blue سند اولیه حفظ شده است. hexهای زیر **پیشنهادی این نسخه** هستند، نه انتخاب تأییدشده قبلی:

| token معنایی | مقدار اولیه پیشنهادی |
|---|---|
| canvas | #F8FAFC |
| surface | #FFFFFF |
| text | #0F172A |
| muted-text | #475569 |
| border | #E2E8F0 |
| primary | #1D4ED8 |
| primary-hover | #1E40AF |
| on-primary | #FFFFFF |
| success | #15803D |
| danger | #B91C1C |

Vazirmatn self-hosted برای فارسی، system font خوانا برای انگلیسی در آغاز. مجوز فونت/asset ثبت شود. text انگلیسی پیشنهاد ۱۸px با line-height حدود 1.75؛ متن UI حداقل ۱۶px در کنترل‌های اصلی. reader روی desktop عرض خواندن حدود ۶۸۰px دارد؛ محتوا در موبایل تک‌ستونی است.

رنگ جدید arbitrary، سایه/gradient/glow تزئینی و انیمیشن دائمی اضافه نشوند. levelها با متن و token محدود مشخص شوند؛ شش رنگ پررنگ مستقل لازم نیست.

### 17.2 صفحه فهرست

عنوان صفحه، selector سطح، جست‌وجوی کم‌مزاحمت، یک بخش «ادامه» اگر progress معتبر وجود دارد، سپس مطالب تازه. هر Topic فقط یک کارت/ردیف دارد؛ شش نسخه آن شش نتیجه مستقل ایجاد نمی‌کنند.

کارت شامل تصویر مرتبط با نسبت ابعاد ثابت، title، سطح‌های موجود و زمان تقریبی است. badgeهای متعدد، metadata داخلی، جدول و KPI مالی در learner نباشد.

صفحه saved همان الگوی فهرست را reuse می‌کند. حساب وضعیت اشتراک و درخواست جاری را با یک CTA روشن نشان دهد.

### 17.3 صفحه مطالعه

ترتیب: عنوان/تصویر محدود، selector سطح، player، متن و واژه‌های مهم. متن انگلیسی `lang=en, dir=ltr`؛ chrome فارسی `lang=fa, dir=rtl`. کارت بزرگ برای هر پاراگراف ساخته نشود.

reader و mini-player هنگام keyboard، bottom nav و safe-area هم‌پوشانی نداشته باشند. padding انتهای محتوا متناسب با کنترل ثابت باشد. سرعت و bookmark در جای ثابت و قابل فهم؛ کنترل‌ها صرفاً icon بی‌نام نباشند.

### 17.4 دسترس‌پذیری و responsive

هدف کاربردی WCAG 2.2 AA در مسیرهای اصلی است؛ ادعای conformance کامل فقط با audit کافی.

- contrast متن عادی حداقل 4.5:1 و متن بزرگ حداقل 3:1؛ زوج رنگ واقعی اندازه‌گیری شود.
- هدف طراحی برای کنترل لمس ۴۴×۴۴ CSS px؛ seek علاوه بر drag با keyboard قابل استفاده باشد.
- focus قابل مشاهده، ترتیب keyboard منطقی، label، نام کنترل، error وابسته به field و اعلان مناسب وضعیت.
- zoom ۲۰۰٪ و متن طولانی فارسی/انگلیسی ساختار را نشکند؛ رنگ تنها نشانه خطا/status نباشد.
- reduced motion رعایت و autoplay حذف شود؛ modal focus را نگه دارد و صحیح بازگرداند.
- عرض‌های ۳۶۰، ۳۹۰، ۴۳۰، ۷۶۸ و ۱۴۴۰ بررسی شوند. reflow در ۳۲۰ CSS px نیز برای مسیر اصلی بررسی شود.
- loading، empty، error، locked، pending، rejected و expired با داده واقعی در QA پوشش داده شوند.

قبل از توسعه UI کامل، دو صفحه فهرست و reader در موبایل با محتوای واقعی ساخته و تصویر آن‌ها دیده شود. کیفیت بصری با خروجی rendered پذیرفته می‌شود؛ تعداد screenshot یا scan خودکار proof کافی نیست.

## 18. PWA و Android آنلاین

### 18.1 PWA

manifest: نام نهایی، `lang=fa`، `dir=rtl`، `display=standalone`، `start_url=/app`، scope مناسب، آیکون‌های استاندارد و maskable.

SW فقط allowlist assetهای عمومی fingerprinted، آیکون، فونت و offline page عمومی را cache کند. تمام navigationهای داده‌دار، auth، Livewire، admin، receipt، placement، progress و media شبکه‌محورند. حتی صوت نمونه در cache offline نسخه اول قرار نگیرد.

در قطع شبکه، صفحه عمومی «برای ادامه به اینترنت وصل شوید» با retry نمایش داده شود؛ آخرین صفحه premium/حساب به‌عنوان fallback برنگردد.

cache versioning و حذف cache عمومی قدیمی وجود داشته باشد. update فعال‌سازی SW در وسط فرم رسید/آزمون یا پخش، reload اجباری ایجاد نکند؛ اطلاع مختصر و refresh کنترل‌شده در زمان مناسب.

پس از logout، state حساس player و صفحه پاک شود. Back/Forward و bfcache نباید داده خصوصی حساب قبلی را بدون بررسی session نمایش دهند؛ این مرز با دو حساب و logout واقعی اثبات شود. no-store به‌تنهایی proof تمام حالت‌های browser history نیست.

### 18.2 APK با TWA

- Bubblewrap پروژه wrapper همان سایت HTTPS را می‌سازد؛ frontend دوم یا API Node ندارد.
- package ID پیشنهادی `com.fastenglishpodcast.app`؛ پیش از اولین release نهایی شود.
- `/.well-known/assetlinks.json` با package و SHA-256 certificate واقعی release هماهنگ باشد.
- domain/signing verification زود روی staging قابل دسترس و Android واقعی بررسی شود. خطای verification و toolbar مرورگر مستند باشد.
- keystore/رمز/recovery خارج Git، با backup مستقل و مسئول مشخص.
- دانلود از دامنه خود پروژه؛ فایل نسخه‌دار، versionCode افزایشی، versionName، تاریخ، حجم و SHA-256 در صفحه.
- تغییر وب معمولاً build جدید APK نمی‌خواهد؛ تغییر package/manifest/signing مسیر release خود را دارد.
- اپ آنلاین است و به مرورگر سازگار/شبکه وابسته است. background audio یا پخش بدون توقف روی تمام گوشی‌ها وعده داده نشود.

ماتریس حداقل pilot: یک Android واقعی با APK release، یک Android مرورگر/PWA، و یک iPhone Safari/PWA. نام دستگاه، OS، browser، نوع build و وضعیت تست ثبت شوند. اگر دستگاه در دسترس نیست، معیار UNPROVEN است و به‌دروغ passed نشود.

## 19. استقرار، عملیات و حریم خصوصی

### 19.1 استقرار ساده

یک VPS Linux LTS، Nginx، PHP-FPM و PostgreSQL محلی/private. دامنه اصلی برای public، `/app` و `/admin`. فقط document root برابر public؛ .env، storage خصوصی، backup و Git از وب قابل خواندن نباشند.

TLS، firewall، SSH key، non-root application user، log rotation، زمان UTC و scheduler استاندارد Laravel. database worker فقط برای email/job واقعی؛ Node dev server در production اجرا نشود.

environment واقعی از secret store/محیط سرور؛ `APP_DEBUG=false`، APP_URL صحیح، session cookie امن، SMTP، disk خصوصی و APP_KEY پایدار. env.example فقط نام متغیر و مقدار نمونه غیرمحرمانه دارد.

صفحه عمومی indexable و metadata/canonical/sitemap درست؛ auth/student خصوصی/admin و staging از index خارج شوند. robots/noindex کنترل امنیت نیست. حذف noindex staging هنگام launch عمومی بررسی شود.

### 19.2 Release و recovery

artifact تولید شامل code revision، lockfiles، assets build و migrationهای معلوم است. پیش از migration production، backup سالم و مسیر recovery ثبت شود. schema change حساس مسیر سازگاری/rollback خودش را داشته باشد؛ rollback کد نباید migration داده را بی‌فکر برگرداند.

healthcheck بدون افشای اطلاعات و خارج از cache: آماده‌بودن اپ/DB و امکان storage لازم. monitoring ضروری شامل availability، خطای 5xx، شکست job/backup، فضای دیسک و سن pending payment است. dashboard analytics محصول در scope نیست.

اطلاعات request/correlation ID و نوع خطا کافی است؛ password، receipt، محتوای پولی، answer key، cookie، token و signed URL در log ثبت نشوند.

### 19.3 Backup و retention

پیشنهاد عملیاتی اولیه: backup روزانه DB + فایل‌ها + configuration لازم، حداقل یک نسخه رمزگذاری‌شده خارج VPS، نگهداری چرخشی حداکثر ۳۰ روز. فایل‌های private و DB باید با snapshot/رویه سازگار گرفته شوند؛ DB backup بدون صوت/receipt کافی نیست.

APP_KEY و Android keystore بازیابی‌پذیر اما جدا از source و با دسترسی محدود باشند. پیش از launch، restore در محیط خالی و تطبیق تعداد/نمونه رکورد، صوت، receipt و login انجام شود.

اهداف اولیه پیشنهادی: RPO حداکثر ۲۴ ساعت و RTO حداکثر ۴ ساعت؛ بعد از تمرین اندازه‌گیری شوند. این‌ها ضمانت فعلی نیستند.

Receipt نهایی پس از ۹۰ روز از reviewed_at/cancelled_at حذف شود؛ رکورد مالی بدون تصویر حفظ شود. pending حل‌نشده خودکار حذف نشود. backupهای قبلی حداکثر ۳۰ روز بعد از حذف چرخه خود را طی کنند؛ privacy این تأخیر را توضیح دهد. پس از restore، cleanup موارد منقضی قبل از بازکردن محیط اجرا شود.

draft لغوشده بدون receipt، داده مالی حساس زائد نداشته باشد. تقاضای حذف حساب و retention سابقه مالی توسط صاحب محصول تعریف شود؛ agent سیاست حقوقی اختراع نکند.

## 20. کیفیت، کارایی و proof

### 20.1 روش verification

هر slice قبل از شروع ۳ تا ۷ معیار observable دارد؛ سپس ارزان‌ترین proof معتبر برای همان ریسک انتخاب شود. unit test خودکار برای هر فایل/متد نوشته نشود. پوشش درصدی یا تعداد تست معیار تحویل نیست.

| ریسک | proof لازم |
|---|---|
| UI و خوانایی | جریان مرورگر + تصاویر فعلی دیده‌شده |
| ownership/access | feature/integration با userهای متفاوت و negative path |
| مالی و race | transaction/replay/concurrency روی PostgreSQL واقعی |
| فایل و seek | فایل MP3 واقعی، HTTP Range و تجربه browser/device |
| progress/سطح | refresh، level switch، revision و owner isolation |
| placement | answer-key absence و تصحیح/submit server-side |
| mobile | PWA/iPhone و TWA release/Android واقعی |
| recovery | restore واقعی در محیط جدا |

تست مخزن موقت/دیتابیس جدا داشته باشد؛ روی داده developer یا production اجرا نشود. زمان در آزمون انقضا کنترل شود. mock نباید مرجع authorization/transaction/storage را حذف و درستی همان مرز را ادعا کند.

entry pointهای استاندارد پیشنهادی: Pint check، test suite متناسب slice با PostgreSQL، asset build، browser tests مرتبط. در Pi، command/script واقعی checkout و QUALITY حاکم است؛ command فرضی فقط برای شبیه‌شدن به سند ساخته نشود.

وضعیت evidence: PASS، FAIL، UNPROVEN یا BLOCKED. screenshot ذخیره‌شده اما دیده‌نشده، check اجرا‌نشده و command سبز بدون proof رفتار، PASS نیستند.

### 20.2 کارایی و ظرفیت

فهرست paginated با ۱۲ topic در صفحه و query بدون N+1؛ eager-load فقط رابطه لازم. image responsive و ابعاد رزروشده؛ audio `preload=metadata` و بدون دانلود خودکار همه صوت‌های فهرست. JS/CSS پنل admin در learner بارگذاری نشود.

baseline واقعی bundle، زمان HTML، آماده‌شدن player و seek در slice اول اندازه‌گیری شود. بودجه نهایی از baseline و داده واقعی ثبت شود؛ claim «سریع» صرفاً بر نام stack بنا نشود.

برای pilot، سناریوی پیشنهادی ۳۰ session هم‌زمان با ۱۰ stream صوت و burst فرم/صفحه، روی سخت‌افزار مشخص و فایل/شبکه معلوم اجرا شود؛ این سناریو فرض capacity planning است، نه عدد اعلام‌شده از سوی کارفرما یا تضمین ۱۰۰۰ کاربر هم‌زمان. نتیجه throughput/p95/error و bottleneck ثبت و اندازه VPS/CDN فقط با evidence تغییر کند.

نمایش متن هنگام تأخیر صوت ممکن باشد؛ قطع صوت صفحه را blank نکند. retry بی‌نهایت و درخواست هم‌زمان تکراری progress وجود نداشته باشد.

## 21. برنامه پیاده‌سازی مرحله‌ای

ترتیب بر اساس ریسک و وابستگی است؛ وعده تعداد روز یا سرعت مدل نیست. هر مرحله می‌تواند چند slice کوچک داشته باشد. UI، داده و authorization یک outcome تا حد لازم با هم ساخته شوند؛ چند هفته «فقط backend» سپس «فقط frontend» انجام نشود.

| مرحله | خروجی | شروط خروج اصلی | نیازها |
|---|---|---|---|
| S0 — قرارداد و scaffold | مخزن تازه، docs و dependency سازگار | نصب/lock معتبر؛ auth و component نمونه کار کنند؛ اولین plan/evidence ثبت شود | AUTH-01، QA-01 |
| S1 — مسیر واقعی متن/صوت | یک topic با دو سطح و reader موبایل | داده واقعی از DB؛ نمونه بدون login؛ صوت/seek واقعی؛ عدم اختلاط سطح | READ-01، MEDIA-01 |
| S2 — اثبات زودهنگام موبایل | PWA و TWA کوچک روی HTTPS آزمایشی | نصب Android/iPhone؛ signing/domain صحیح؛ cookie/session و صوت؛ عدم cache خصوصی | MOB-01/02 |
| S3 — محتوا و فهرست | Filament محدود محتوا + library | draft پنهان؛ publish معتبر؛ یک نتیجه برای هر topic؛ filter/search؛ نمونه public | ADM-01، LIB-01/02، READ-02 |
| S4 — بازگشت کاربر | progress، bookmark، حساب و level preference | refresh resume؛ variant/revision isolation؛ bookmark یکتا؛ settings صریح | PROG-01، SAVE-01، LEVEL-01، MEDIA-02 |
| S5 — ارسال پرداخت | پلن، snapshot، receipt و status | snapshot قبل از واریز؛ فایل خصوصی؛ یک درخواست باز؛ validation/retry؛ رد ownership نامعتبر | PAY-01/02، ADM-02 |
| S6 — بررسی و entitlement | approval/rejection و subscription | replay/race واقعی؛ expiry/revoke؛ منع self-approval؛ audit؛ premium deny/allow | PAY-03، SUB-01 |
| S7 — تعیین سطح | آزمون اختیاری و نتیجه | ۲۰ سؤال نسخه ثابت؛ answer key پنهان؛ resume؛ submit تکراری؛ تغییر preference صریح | PLACE-01، LEVEL-01 |
| S8 — عمومی و release candidate | Landing کوتاه، SMTP، download و operations | متن واقعی؛ reset؛ metadata؛ APK release؛ monitoring و backup آماده | PUB-01/02، AUTH-02، OPS-01 |
| S9 — pilot و تحویل | مسیر کامل روی دستگاه واقعی و recovery | معیارهای نهایی PASS؛ restore واقعی؛ ریسک باقیمانده معلوم؛ handover | QA-01 و همه نیازها |

پنل staff برای واردکردن اولین محتوای واقعی به‌اندازه لازم زود scaffold شود؛ resourceهای مالی قبل از قرارداد S5/S6 ساخته نشوند. S2 مانع موکول‌کردن خطر APK/رسانه به پایان پروژه است.

داده توسعه: user/staff آزمایشی، topic با دو lesson واقعی، یک subscription seed معتبر فقط در local/test و fixture receipt مصنوعی. seed در production subscription رایگان یا credential پیش‌فرض ایجاد نکند.

## 22. قرارداد کار agent و Pi

### 22.1 فایل‌های مرجع مخزن

این فایل در `docs/FAST_ENGLISH_BUILD_SCOPE_FA.md` قرار گیرد. نقشه کوتاه `AGENTS.md` فقط مسیر قراردادها و commandهای واقعی را معرفی کند.

از ساختار workflow نصب‌شده استفاده شود:

- `docs/PRODUCT.md`: هدف، baseline پذیرفته‌شده و ارجاع به بخش‌های این scope.
- `docs/DESIGN.md`: جهت بصری، پیشنهاد/انتخاب صاحب محصول و mapping token به CSS واقعی.
- `docs/ARCHITECTURE.md`: state ownership، schema/فایل/authorization و تصمیم stack.
- `docs/QUALITY.md`: معیارها و مسیر verification واقعی پروژه.
- `docs/PLAN.md`: roadmap و وضعیت مرحله‌ها.
- `docs/exec-plans/active/`: فقط برای کار پیچیده/بلند؛ handoff و evidence.
- ADR کوتاه برای تغییر مهم معماری؛ تصمیم‌ها در چند فایل با مقادیر متناقض کپی نشوند.

Pi Workflow Guide راهنمای operator است؛ متن کامل آن وارد AGENTS.md یا هر prompt نشود. مدل، credential، branch و PR policy از checkout/دستور واقعی صاحب محصول گرفته شوند. هیچ سابقه code review یا تست پروژه قبلی proof این rebuild نیست.

### 22.2 حلقه هر slice

1. نتیجه قابل مشاهده و ۳ تا ۷ معیار، شامل شکست مهم، تعیین شود.
2. فقط قرارداد/فایل مرتبط و commandهای واقعی checkout خوانده شوند.
3. یک نویسنده outcome کامل را بسازد؛ dependency جدید دلیل داشته باشد.
4. verification متناسب خطر و evidence واقعی انجام شود.
5. failure اصلاح، معیارهای affected دوباره بررسی و diff مرور شود.
6. گزارش کوتاه: نتیجه، مسیرهای تغییر، معیار → evidence، ریسک، اقدام بعدی.

تغییرات هم‌زمان چند agent نویسنده، agent swarm و ابزار اجباری بدون نیاز ساخته نشوند. reviewer مستقل فقط وقتی لازم و واقعاً در دسترس است؛ self-review evidence-focused جایگزین معتبر است.

بعد از دو شکست مشابه بدون اطلاعات تازه، علت بررسی شود؛ retry کور، تعویض خودکار مدل/provider و rewrite وسیع انجام نشود. وضعیت unfinished در plan حفظ شود؛ resume از worktree واقعی، نه حافظه ادعایی.

دستورهای /plan، /build، /build-ui، /review و /ship فقط اگر workflow فعلی آن‌ها را دارد استفاده شوند. /ship تحویل scoped PR است؛ merge/deploy از آن نتیجه گرفته نشود. اختیار commit/PR/deploy مطابق درخواست صاحب محصول و سیاست فعلی checkout است؛ این فایل برای آن مجوز تازه صادر نمی‌کند.

### 22.3 پیچیدگی قابل کنترل

- یک framework backend، یک frontend learner و یک پنل staff.
- هر state یک منبع حقیقت؛ هر قانون مالی/access یک مالک سروری.
- dependency، abstraction و background service با نیاز همین محصول توجیه شوند.
- mock data جای persistence واقعی، دکمه بی‌عمل و success نمایشی در خروجی تحویل وجود نداشته باشد.
- feature خارج scope و بازطراحی بی‌ارتباط با slice شروع نشود.
- تغییر stack فقط با مسئله مشخص، گزینه ارزیابی‌شده و برنامه اثر آن روی code/data/proof ثبت شود.

## 23. معیارهای پذیرش نسخه قابل انتشار

این فهرست قرارداد نهایی است، نه ادعای PASS فعلی. معیارهای عملیاتی وابسته به دسترسی واقعی از قبل اعلام شوند.

| معیار | نیازها | نتیجه مورد انتظار / proof |
|---|---|---|
| AC-01 | PUB-01، READ-01 | Visitor نمونه واقعی متن/صوت را بدون حساب استفاده کند؛ نمونه draft یا premium افشا نشود. |
| AC-02 | AUTH-01، AUTH-02 | ثبت‌نام، ورود غلط/درست، logout، session refresh و reset با ایمیل واقعی کار کنند؛ actor نامعتبر داده دیگری را تغییر ندهد. |
| AC-03 | LIB-01، LIB-02 | فهرست یک نتیجه برای هر topic، pagination، query/سطح URL و پیام نبودن نسخه داشته باشد. |
| AC-04 | READ-01، READ-02 | انتخاب سطح، متن/صوت/glossary همان lesson را نشان دهد؛ تغییر سطح recommendation/preference را بی‌صدا عوض نکند. |
| AC-05 | MEDIA-01 | پخش، pause، seek، سرعت و Range معتبر/نامعتبر با MP3 واقعی درست باشند. |
| AC-06 | MEDIA-02 | navigation عادی پخش را حفظ کند؛ بازکردن نسخه دیگر و logout صوت قدیمی را متوقف کنند؛ listener تکراری نباشد. |
| AC-07 | PROG-01 | آخرین save معتبر پس از refresh برگردد؛ user/lesson/revision متفاوت progress را مخلوط نکنند؛ خطای ذخیره success جعلی ندهد. |
| AC-08 | SAVE-01 | bookmark یکتا، پایدار و قابل حذف باشد؛ archived content رفتار روشن داشته باشد. |
| AC-09 | LEVEL-01، PLACE-01 | تعیین سطح قابل skip؛ ۲۰ سؤال بدون answer key؛ resume و submit دوباره یک نتیجه؛ preference فقط با عمل صریح تغییر کند. |
| AC-10 | PAY-01 | مبلغ/مدت/مقصد از سرور و snapshot پیش از انتقال؛ تغییر plan بعدی snapshot را تغییر ندهد؛ amount/status تزریق‌شده رد شود. |
| AC-11 | PAY-01، PAY-02 | upload نامعتبر رد؛ receipt متعلق به دیگری و مسیر private عمومی رد؛ retry یا دو create هم‌زمان بیش از یک درخواست باز نسازند. |
| AC-12 | PAY-03 | staff مجاز pending را یک بار approve کند؛ retry و دو approve هم‌زمان فقط یک event و یک تمدید ایجاد کنند. |
| AC-13 | PAY-03، SUB-01 | approve و grant دستی هم‌زمان برای یک user lost update نداشته باشند؛ approve/reject race یک نتیجه نهایی داشته باشد؛ self-approval رد شود. |
| AC-14 | PAY-02، PAY-03 | reject با دلیل، بدون اثر تازه؛ resubmit درخواست تازه بسازد؛ اشتراک قبلی معتبر حفظ شود. |
| AC-15 | SUB-01 | premium در حالت بدون اشتراک/منقضی/لغوشده/تعلیق، از صفحه و audio route رد شود؛ همه سطح‌های published برای subscriber مجاز باشند. |
| AC-16 | SUB-01 | تمدید فعال از expiry، خرید پس از انقضا از approve؛ replay approve قدیمی اشتراک revoked را فعال نکند؛ audit تغییر دستی موجود باشد. |
| AC-17 | ADM-01، ADM-02 | student به staff action دسترسی نگیرد؛ draft در URL/file/search دیده نشود؛ staff مطلب معتبر منتشر و plan/مقصد را کنترل کند. |
| AC-18 | QA-01 | فهرست/reader/پرداخت در موبایل، RTL/LTR، keyboard/focus، zoom، contrast و حالت‌های خطا با rendered evidence بررسی شوند. |
| AC-19 | MOB-01 | PWA روی iPhone واقعی نصب/اجرا شود؛ SW cache خصوصی نداشته باشد؛ logout/back با حساب دیگر اطلاعات قبلی را نشان ندهد. |
| AC-20 | MOB-02 | APK release روی Android واقعی نصب شود؛ Digital Asset Links همان certificate تأیید شود؛ login، صوت و download metadata صحیح باشند. |
| AC-21 | OPS-01 | HTTPS و config امن، debug خاموش، private storage غیرقابل دسترسی مستقیم، log بدون secret و health/monitoring لازم کار کنند. |
| AC-22 | OPS-01 | backup DB+file سالم؛ restore در محیط جدا، login/صوت/receipt و cleanup retention اثبات شوند. |
| AC-23 | PUB-02، QA-01 | copy و تماس/قیمت واقعی، قوانین و privacy مصوب، مالکیت domain/signing و handover کامل؛ placeholder تجاری در فروش عمومی نباشد. |

بار/performance و رفتار background روی دستگاه‌های pilot با شرایط و محدودیت معلوم گزارش شوند. اگر نیاز اصلی رسانه در دستگاه هدف برآورده نشد، پیش از launch تصمیم اصلاح ثبت شود؛ نام TWA/Livewire دلیل قبول failure نیست.

## 24. خروجی‌های قابل تحویل

- source در مخزن تازه، lockfileها، migrationها و seedهای غیرتولیدی.
- learner واقعی، public pages و Filament staff مطابق scope.
- PWA، پروژه wrapper TWA و APK امضاشده نسخه جاری با checksum.
- config نمونه بدون secret، دستور dev/build/verify واقعی و نسخه runtime.
- قرارداد PRODUCT/DESIGN/ARCHITECTURE/QUALITY و plan/evidence تکمیل‌شده.
- راهنمای staff: تولید/انتشار محتوا، تطبیق receipt، approve/reject، اصلاح اشتراک و پشتیبانی.
- runbook کوتاه release، rollback/recovery، backup، restore، retention و incident.
- inventory مالکیت دامنه، VPS، DB، SMTP، storage، signing و مسئول recovery؛ credentialها از کانال امن، خارج متن سند/Git.
- known issues با اثر و workaround؛ هیچ دکمه نمایشی، persistence ساختگی یا معیار UNPROVEN ضروری با برچسب «کامل» تحویل نشود.

محتوای تجاری و نرم‌افزار دو تحویل متفاوت‌اند. تولید انبوه lesson جزء توسعه اپ نیست مگر تعداد/کیفیت/مالک تولید جدا تعیین شود.

## 25. تصمیم‌های باقی‌مانده و آمادگی انتشار

موارد زیر توسعه عادی را متوقف نمی‌کنند؛ زمان موردنیاز واقعی‌شان مشخص است. defaultهای پیشنهادی به‌عنوان approval صاحب محصول جا زده نشوند.

| مورد | baseline پیشنهادی / اقدام | چه زمانی لازم است؟ |
|---|---|---|
| stack | مسیر Livewire همین سند؛ shadcn اصلی = تغییر به Inertia/React | پیش از scaffold؛ اگر دستور خلاف نیست با baseline ادامه |
| ناوبری و placement | سه مقصد، آزمون اختیاری | پیش از تثبیت UX؛ قابل بازگشت |
| staff | یک نوع staff با اختیارات مالی/محتوا | پیش از ایجاد کارکنان واقعی |
| برند/لوگو/دامنه | Fast English نام کاری؛ دامنه مرجع اسناد | طراحی هویت و staging |
| package ID و مالک signing | مقدار پیشنهادی بخش 18؛ نهایی‌سازی و backup | پیش از اولین APK release |
| پلن و قیمت | ۳۰/۹۰/۳۶۵ روز؛ قیمت واقعی باید داده شود | پیش از فعال‌کردن checkout عمومی |
| مقصد بانکی | کارت/صاحب/بانک واقعی از صاحب محصول | پیش از دریافت انتقال واقعی |
| اعتبار snapshot | احترام تا تصمیم نهایی، بدون timeout در MVP | پیش از فروش؛ اگر رد شد قرارداد expiry جدا |
| SLA و ساعات staff | متن صادقانه بر اساس توان واقعی | پیش از نمایش وعده بررسی |
| ایمیل و SMTP | ایمیل/رمز، reset استاندارد | تست staging و قبل از فروش عمومی |
| سؤال/مرزهای placement | تأیید مدرس، در غیر این صورت آزمون عمومی disabled | پیش از فعال‌کردن آزمون |
| محتوای pilot | پیشنهاد ۵ topic و حداقل ۱۲ lesson، پوشش هر شش سطح و نمونه دو‌سطحی | قبل از pilot؛ مسئول تولید و کیفیت مشخص |
| رنگ/فونت/asset | پیشنهاد بخش 17، بدون نسبت‌دادن تأیید قبلی | هنگام بررسی اولین UI واقعی |
| سیاست refund/privacy/retention | اقدام انسانی، receipt ۹۰ روز و backup تا ۳۰ روز | پیش از انتشار متن و دریافت receipt واقعی |
| VPS/storage/backup destination | مشخصات واقعی با ظرفیت/restore اندازه‌گیری‌شده | پیش از staging پایدار / launch |
| پشتیبانی و تماس | کانال معتبر؛ فرم CRM لازم نیست | قبل از launch |
| بودجه و deadline | هیچ مبلغ/زمان قدیمی به‌عنوان قرارداد تازه فرض نشده | قرارداد تجاری جدا از این scope |

اگر داده واقعی لازم موجود نیست، قابلیت تجاری مربوطه disabled و وضعیت BLOCKED واضح باشد؛ app با fixture در local/staging پیش برود. از قیمت/شماره کارت/متن حقوقی ساختگی برای فروش استفاده نشود.

## 26. شروع کار در Pi

1. مخزن تازه با workflow موردنظر ایجاد کن؛ legacy را کپی نکن.
2. همین فایل را در `docs/FAST_ENGLISH_BUILD_SCOPE_FA.md` قرار بده.
3. prompt زیر را اجرا کن. این entry point قرارداد و برنامه را آماده می‌کند؛ پیاده‌سازی اپ با slice S0/S1 پس از دستور build انجام می‌شود.

### Prompt آماده برنامه‌ریزی

```text
/plan Prepare the implementation contracts and a bounded build plan for a fresh Fast English rebuild.

Read docs/FAST_ENGLISH_BUILD_SCOPE_FA.md, the checkout's AGENTS.md and the installed workflow map. The supplied scope is the new baseline. Do not import legacy code, data, completed-work claims or old architecture.

This request is planning/documentation only. Do not implement the application, use production credentials, merge or deploy.

Record confirmed owner requirements, inherited product requirements, reversible proposed defaults and launch-only missing inputs separately. Use the Laravel/Blade/Livewire/Alpine/Tailwind/Filament/PostgreSQL baseline unless a newer owner instruction supersedes it. Do not build a second frontend.

Create or update the installed PRODUCT, DESIGN, ARCHITECTURE, QUALITY and PLAN contracts with references to the supplied scope. Preserve valid workflow and delivery policies; do not copy the entire operator guide into AGENTS.md.

Acceptance:
1. PRODUCT maps the scoped requirements and non-goals, including optional placement, level semantics and manual-payment access.
2. DESIGN records the proposed mobile reader direction and token choices without inventing owner approval.
3. ARCHITECTURE assigns each state one owner and records payment snapshot/idempotency, private media/Range and PWA/TWA boundaries.
4. PLAN starts with compatibility/auth and a real two-level text/audio skeleton, followed by early PWA/TWA proof and bounded slices.
5. QUALITY maps the final acceptance IDs to faithful proof, including PostgreSQL concurrency, private receipts, expiry and real-device media.
6. Missing commercial inputs block only their actual launch boundary; reversible development continues with clearly labelled fixtures.

Use the installed checks relevant to planning. Do not claim runtime compatibility or acceptance tests passed without execution. Report changed document paths, decisions, blockers and the concrete first build slice concisely.
```

بعد از plan، درخواست `/build` فقط برای یک outcome مرحله S0 یا S1 بده؛ کل سند در یک turn به «همه‌چیز را بساز» تبدیل نشود. ویژگی بعدی از acceptance مرحله فعلی و evidence واقعی انتخاب شود.

## 27. منابع فنی مبنا

این منابع قابلیت framework را توضیح می‌دهند؛ انتخاب معماری و قواعد تجاری این سند پیشنهاد مخصوص این پروژه‌اند. جزئیات نصب و command با نسخه‌های واقعاً pin‌شده بررسی شوند.

- [Laravel 13 Starter Kits / Livewire / Fortify](https://laravel.com/docs/13.x/starter-kits)
- [Laravel Frontend](https://laravel.com/docs/13.x/frontend)
- [Filament 5 Installation](https://filamentphp.com/docs/5.x/introduction/installation)
- [Livewire 4 Navigate / Persistent Player](https://livewire.laravel.com/docs/4.x/navigate)
- [Livewire Alpine](https://livewire.laravel.com/docs/4.x/alpine)
- [Laravel Database / Transactions](https://laravel.com/docs/13.x/database)
- [Laravel Authorization](https://laravel.com/docs/13.x/authorization)
- [Laravel Filesystem](https://laravel.com/docs/13.x/filesystem)
- [Laravel Boost](https://laravel.com/docs/13.x/boost)
- [Android TWA / Bubblewrap / Digital Asset Links](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Nginx Internal Locations](https://nginx.org/en/docs/http/ngx_http_core_module.html)
- [Symfony HttpFoundation / File Responses](https://symfony.com/doc/current/components/http_foundation.html)
- [HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

---

**وضعیت فعلی:** این فایل یک scope آماده استفاده است. هیچ source اپ، migration تولیدی، deploy، benchmark، آزمون دستگاه یا تأیید تجاری با ایجاد این سند انجام نشده است.




