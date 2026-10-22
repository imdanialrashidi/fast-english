# Glossary

Domain terms used by the product, tests, and architecture reviews. Use these
names in code and prose; do not substitute a generic synonym when the domain
term is meant.

- **Topic** — a published subject with one or more level versions. The library
  lists one row per Topic, never one per Lesson.
- **Lesson** — one level version of a Topic (`lessons.topic_id`, `level`). A
  Lesson owns the body, audio revision, glossary, and duration.
- **Level** — the CEFR label (A1–C2) on a Lesson. Level is content, never a
  permission.
- **Public sample** — the Lesson flagged `is_public_sample`, readable without a
  subscription through `/sample`; it is the only media a public page may carry.
- **Reader** — the learner reading surface at `/app/topics/{slug}?level=…`:
  plain paragraphs, audio transport, glossary, bookmark, completion.
- **Library** — the learner browse surface at `/app`; filters, search, and
  pagination live in the URL.
- **Today** — the signed-in learner's plan page at `/app/today`; every row is
  derived from persisted state by `DailyPlan`, never stored.
- **Entitlement** — the server-side answer to "may this learner see this?";
  computed per request by `App\Support\Entitlement`.
- **Subscription** — the single current access window per user, written only by
  `ApprovePayment` and audited by `subscription_events`.
- **Topic card** — the shared metadata payload for a Topic in the library,
  saved list, Today recommendations, and landing shelf.
- **Reading payload** — the shared Topic + Lesson + prepared reading content
  used by the reader and the public sample.
- **Precache allowlist** — the public assets the service worker may cache;
  owned by `resources/public-assets.json`.
- **Placement** — the optional level-suggestion test; its score-to-level table
  is a labelled fixture, not a validated CEFR scale.
- **Vocabulary word** — a learner-owned notebook row with deterministic
  spaced-repetition state.
