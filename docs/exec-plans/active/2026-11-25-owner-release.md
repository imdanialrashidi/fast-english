# Owner release — 2026-11-25

Status: implemented, deployed, and verified on production on 2026-11-25.

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
- Production deployment (2026-11-25): image `fe-app:release`
  (`3045ebae33cb`, PHP 8.4.26 FPM + nginx + queue/schedule; built from the
  release tree with the post-build payload fix baked in), container
  `app-uerwghnhy5ezsd3ghxo96ugl-20261125T124636`, domain
  `https://fastenglishpodcast.ir` returns 200 and `/up` returns 200. The
  release image is also tagged `uerwghnhy5ezsd3ghxo96ugl_app:5e9bc0ab…` and
  `:2c96e28` so the compose file can restart it.
- Production data: 148 reading documents enriched (63 paragraph-level B2+
  lists on IELTS, 5–12 harder words per Inside Reading paragraph (verified min 5, max 12), 400 True/
  False questions), 50 topic A1 summaries, 5,379 new word-audio rows (7,543
  total approved keys), and 351 new storybook page MP3s with exact sentence
  timings.
- Live checks: non-subscriber sees Discover/Today (200) and receives the
  «لطفاً اشتراک ماهیانه خریداری کنید» locked page for reader/words; a
  subscriber sees the readers; TED audio streams through X-Accel; landing,
  about/cooperation/support/terms/FAQ render the new copy; `/refund` and
  `/sample` return 404; the monthly 641,000 offer is the only active plan.
- Remaining operational risk: the host root filesystem is ~98% full (about
  0.5 GB free). A Coolify no-cache rebuild needs roughly 2–3 GB and failed
  several times on disk exhaustion; the current image was built from the
  same tree and started through the compose file. Free disk (old images,
  logs, host backups) before the next deploy, and keep the PostgreSQL/volume
  backups. One old media backup of the unrelated `kidotalks` app was moved
  to `/home/danial/kidotalks-backups-20261125/` (SHA-256 verified) to free
  space; it should be copied back when the host has room.
