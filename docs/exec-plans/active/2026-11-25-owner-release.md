# Owner release — 2026-11-25

Status: implementation complete in the working tree; production data/content
update and Coolify deploy are the remaining steps.

## Accepted owner changes

- **Placement:** one final submit for all 20 questions; blanks are allowed and
  simply do not score. No per-question save buttons.
- **Account:** profile photo upload/remove; post-activation profile form with
  first name, surname, and a Jalali birth date in three fields; verified phone
  shown read-only.
- **Daily goal:** 10/20/30/40/50/60 minutes; an opt-in on-device daily
  notification says whether today's goal is done.
- **Install:** iPhone step 2 is «three dots bottom-right → share
  (به اشتراک‌گذاری)»; the download page carries the same step-by-step guide.
- **Paywall:** the signed-in shell, Discover, Today, and Books shelf are
  visible without a subscription; every lesson body, transcript, glossary,
  exercise, and audio stays locked. The old public `/sample` route is retired.
- **Podcasts:** the reader shows the Persian summary plus an A1 English
  summary, and key vocabulary above the body at every level.
- **TED:** talks appear in the default Discover list; B2+ transcript words are
  statically highlighted with a calm background, tap shows a short meaning,
  and a simple synonym/different pronunciation is offered when available.
- **IELTS / Inside Reading:** dotted underlines became a soft highlight; tap
  shows meaning, a second tap plays pronunciation; pre-taught words are in
  text order; Inside Reading adds True/False practice, a part-of-speech table,
  and 5–12 harder words per paragraph.
- **Storybooks:** A Pretty Face, Drive into Danger, and A Christmas Carol have
  new Underdog Woof narration (sentence-timed per page) and the same
  highlight/tap/double-tap behavior.
- **Landing/trust:** new owner copy, three summary claims, monthly 641,000
  offer against 990,000, four FAQ questions, «درباره ما», no refund page,
  support number 09936908633 in Bale/Telegram, and no telephone-call links.
- **Plans:** the monthly plan is «اشتراک ماهیانه» at 641,000 toman / 30 days;
  the old 90-day and yearly plans are inactive so checkout matches the offer.

## Deliberate boundaries

- **Notification transport:** the daily goal reminder is an on-device
  notification (Notification API + service worker) shown when the learner
  opens the app, at most once per Tehran day. Real background Web Push is not
  implemented; that requires VAPID keys, a push subscription table, and a
  server-side push sender. This is the one deliberate gap from the owner's
  wording and is recorded here rather than silently claimed as done.
- **Persian glosses:** the lexicon combines the existing article glossaries,
  the Apache-2.0 EnglishToPersianDictionaries collection, and a small manually
  reviewed TED set. It is a learner hint, not a licensed dictionary; machine-
  derived and hand-written entries should be reviewed before a major content
  release. Provenance is in `resources/data/NOTICE.md`.
- **Inside Reading questions:** True/False prompts are generated from factual
  sentences in the stored reading documents (true sentence or a negated
  auxiliary), with the source sentence as evidence. They are practice items,
  not publisher-authored exam questions.
- **Arabic/English bidi:** parrot text and quotes stay in their original
  characters; no copy was rewritten.

## Verification

- `php artisan test` (PostgreSQL 17): PASS, 0 failed (7 passed, 480 warnings;
  the warnings are missing local `.env` reads in the test container).
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- Production content update: `content_update.sql` (148 reading documents + 3
  storybooks + 49 topic A1 summaries) and `word_audio_update.sql` (5,379
  pronunciation rows); story audio is 351 page MP3s.
- Production deployment and live smoke checks are recorded in the handoff
  after the Coolify release.
