# Copywriting Guidelines — Student App (Podcast Slice 5)

Lightweight source of truth for the Student-facing voice and terminology.
Not an i18n framework: canonical repeated labels live in
`app/src/app/copy/productCopy.ts`; page-specific prose stays close to the
page that owns it.

## Canonical entity vocabulary

Public Student UI prefers exactly these words for the same entity:

| Term | Used for |
| --- | --- |
| اپیزود | the Episode entity (never درس/فایل/مطلب/پادکست/جلسه) |
| کتابخانه | the Episode collection destination |
| سطح پیشنهادی | Placement-derived recommended level |
| سطح پیشفرض | the Student's default browsing level |
| ادامه گوشدادن | resuming a started Episode |
| شروع گوشدادن | starting an Episode for the first time |
| مرور دوباره | re-listening to a completed Episode |
| کلمات کلیدی | vocabulary items (future Vocabulary UI) |
| متن اپیزود | the Episode transcript |
| پیشرفت | learning progress |

Legacy Backend/database terms may remain internally. Database collection
names are not renamed by this slice. Older flows that are not redesigned in
this slice (payment, placement, the current lessons list page) keep their
own existing copy; the static copy scanner covers only the redesigned
Podcast-facing components (`features/podcast/components`, `features/home`,
`features/library`, the `progress` route, `app/copy`).

## Voice

Student-facing tone: clear, warm, confident, adult, encouraging, concise —
non-childish, non-salesy.

Avoid:

- generic motivational slogans;
- exaggerated promises («تضمین یادگیری», «مسلط شو»);
- guilt or fake urgency («فقط امروز!»);
- excessive exclamation marks;
- literal translation of English UI terminology.

Never promise: «Fluency in 30 days», «Guaranteed learning»,
«Guaranteed improvement». If data does not exist, the copy must not
fabricate it (no invented listening time, no invented durations, no
invented recommendation intelligence — the Recommended section is
level + publication metadata, not «هوشمند»/«شخصیسازیشده»).

## Hierarchy

Every major Student screen carries: page title → (optional) one-line
orientation → primary action → secondary action only when genuinely needed
→ empty-state explanation → error next step. Do not add explanatory
paragraphs everywhere; use copy only where it reduces uncertainty.

## State copy conventions

- Empty states explain what happened and the next action («هنوز اپیزودی
  شروع نکردی. از کتابخانه یک موضوع انتخاب کن و اولین شنیدنت را شروع کن.»),
  never «No data» / «Nothing found».
- Errors explain the next step («اتصال اینترنت را بررسی کن و دوباره تلاش
  کن.») and offer Retry where meaningful. Never surface raw Backend or
  PocketBase errors.
- Subscription: active state is a compact line; pending payment reads
  «رسید شما در حال بررسی است.»; Staff/operator/payment-review terminology
  is never shown to Students.
- Timing: only show estimated remaining time when it derives from the
  authoritative duration and the saved position.

## Scope of this file

Durable voice/terminology decisions only. Product architecture decisions
live in `docs/ARCHITECTURE.md` / `docs/PRODUCT.md`; slice history lives in
`docs/PLAN.md`.
