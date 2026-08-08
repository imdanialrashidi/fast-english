# Podcast Domain (Slice 2)

Durable domain documentation for the Podcast content model. Companion to
`docs/PRODUCT.md` and `docs/ARCHITECTURE.md`.

## Collection mapping (stable database names)

The Product vocabulary may call content Episodes/Variants; the database
keeps the stable collection names to avoid migration risk.

| Collection        | Podcast domain meaning                 | Notes |
|-------------------|----------------------------------------|-------|
| `categories`      | Podcast Library categories             | New (Slice 2). |
| `topics`          | Canonical Episodes (shared by levels)  | Upgraded (Slice 2), name unchanged. |
| `lessons`         | Level-specific Episode Variants        | Upgraded (Slice 2), name unchanged. |
| `lesson_vocabulary` | Key vocabulary per Variant           | New (Slice 2). |
| `lesson_progress` | Per-Variant Student Progress           | Unchanged (Slice 2), name unchanged. |

No `episodes`, `episode_variants` or `episode_progress` collections exist.
The unique Variant identity remains `topic + level` (`idx_lessons_topic_level`).

## Level semantics — four separated concepts

- **recommendedLevel** — educational guidance derived from the completed
  Placement result. Source of truth: `fep_users.suggested_level`, falling
  back to `placement_attempts.suggested_level`. Never changes when a
  Student browses another level.
- **preferredLevel** — the Student's default browsing level (Home and
  Library). Reuses the existing `fep_users.selected_level` field when it
  holds a valid CEFR level; falls back to `recommendedLevel`. No new
  preferred-level field is added — the existing field is semantically
  correct. Invalid legacy values fall back safely.
- **browsingLevel** — temporary per-request state (the `?level=` query
  parameter of the lesson list route, or a Variant URL). Never persisted,
  never written to the User record. Opening B2 must not modify the
  Placement result, the preferred level, B1 Progress, or the Subscription.
- **entitlement** — an active eligible Student may access every Published
  Episode Variant from A1 through C2. Level is no longer an authorization
  boundary. Access still requires: authenticated `fep_users` Student with
  role `student`, active non-suspended account, completed Placement,
  active Subscription, Published Category, Published Episode, Published
  Variant. Audio-token revalidation and Progress revision protection are
  unchanged.

## Schema

### categories (new)

`key` (unique, import identity), `slug` (unique), `title_fa` (required),
`title_en`, `description_fa` (required), `cover_image` (optional image,
thumbs `640x0`), `cover_alt_fa`, `sort_order` (int 0–10000; not DB-required
because PB 0.39.9 rejects 0 on required NumberFields — the hook defaults it),
`is_featured`, `publication_status` (draft/published/archived — the
recommended name for this new collection), `published_at`, `archived_at`.
All CRUD rules locked (`null`); only superuser tooling writes. Published
Categories require a valid title, valid slug and non-empty Persian
description (hook-enforced). Students and Staff direct CRUD stay locked;
no unfinished Admin CRUD surface is exposed in this slice.

Indexes: `idx_categories_key` (U), `idx_categories_slug` (U),
`idx_categories_pub_sort` (publication_status, sort_order).

### topics (canonical Episodes)

Retained: `slug` (U), `title`, `description`, `cover_image` (legacy,
grandfathered — `artwork_square` is the canonical artwork), `sort_order`,
`status` (existing draft/published/archived enum — the single authoritative
publication field; no `publication_status` is added), `published_at`,
`archived_at`, `source_note`, `source_date`.

Added (Slice 2): `content_key` (unique, stable import identity),
`category` (relation), `title_fa`, `description_fa`, `artwork_square`
(JPEG/PNG/WebP, ≤5 MB, thumbs `640x0`), `hero_image_wide` (optional,
thumbs `1280x0`), `artwork_alt_fa`, `episode_number`, `is_featured`,
`content_version` (positive int).

Indexes: `idx_topics_slug` (U, existing), `idx_topics_content_key` (U),
`idx_topics_category_status_published_at`.

### lessons (Episode Variants)

Retained: `topic` (relation), `level` (A1–C2), `title`, `summary`, `body`
(the Variant transcript — no second transcript field), `audio` (protected),
`estimated_minutes`, `status` (existing enum), `is_public_sample`,
`published_at`, `archived_at`, `audio_duration_seconds` (authoritative).

Added (Slice 2): `summary_fa`, `thumbnail_override` (optional image,
thumbs `640x0`), `thumbnail_alt_fa`, `content_version`.

Indexes: `idx_lessons_topic_level` (U, existing), `idx_lessons_status_published_at`.

### lesson_vocabulary (new)

`lesson` (relation, cascade), `term` (display term), `normalized_term`
(deterministic normalization), `phonetic`, `part_of_speech` (bounded text),
`meaning_fa`, `definition_en`, `example_sentence`, `pronunciation_audio`
(protected MP3/M4A, ≤2 MB), `sort_order`. All CRUD locked. Unique
`(lesson, normalized_term)`; index `(lesson, sort_order)`.

Normalization is one deterministic function: trim, collapse repeated
whitespace, lowercase for uniqueness. No stemming, no linguistic
transformation, no AI normalization; the original display term is stored
separately. Pronunciation audio stays protected with the Variant until an
explicit policy is approved; no Device TTS/pronunciation UI in this slice.

## Publication invariants

- **Published Episode** requires: published Category, stable `content_key`,
  valid slug, `title`, Persian `title_fa`, Persian `description_fa`,
  artwork, positive `content_version`, valid `published_at`.
- **Published Variant** requires: published parent Episode, valid A1–C2
  level, transcript/body, audio, positive authoritative
  `audio_duration_seconds`, Persian `summary_fa`, positive
  `content_version`, valid `published_at`. Vocabulary is supported but not
  yet a hard publication requirement (the Slice 3 JSON pipeline will
  require it for imported packages).
- **Archive** hides content publicly but never deletes or rewrites
  Progress; **republish** restores access to the same Progress records.
- Draft and archived content are inaccessible to every Product route
  (list, detail, audio, progress, artwork, public sample, dashboard).

### Grandfathering strategy (documented)

New-field invariants are enforced for NEW publishes and REPUBLISHES
(create-with-published, or a status transition into published).
Already-published legacy content without the new fields keeps working
unchanged: PB 0.39 hooks cannot distinguish migration/import backfill
saves from editorial saves (no `originalRecord` during migrations), so
edit-time enforcement would break the backfill itself. Grandfathered
records become subject to the full invariants when they are republished.
The migration never changes `status`, so nothing is silently unpublished
or republished.

## Existing-data backfill (migration 1700000023)

- One controlled default Category `general` / «عمومی» (published) is
  created; every existing Topic is assigned to it.
- `content_key = "legacy." + slug` (deterministic; unique because slug is
  unique), `content_version = 1` for Topics and Lessons.
- No Persian title/description/summary is invented: fields stay empty and
  are only required on (re)publish. No placeholder values are inserted.
- `lesson_progress` is never touched; counts and relations are proven
  unchanged by the podcast-domain smoke (pre-stage/post-stage disposable
  PocketBase migration test).

## Artwork policy

- **Preferred policy:** Published Episode artwork is public and cacheable
  (`Cache-Control: public, max-age=3600`) because it appears in Library
  discovery. Draft/archived artwork returns 404.
- Served through the custom proxy `GET /api/fast-english/artwork/{lessonId}`
  (and `/hero` for `hero_image_wide`), which re-verifies Variant/Episode/
  Category published state on every request. No raw file paths or storage
  names are exposed; `X-Content-Type-Options: nosniff`; path containment
  enforced; 5 MB cap.
- **Resolution order:** `lesson.thumbnail_override` → `topic.artwork_square`
  → deterministic Product fallback (a controlled branded SVG, never a
  broken image). Artwork is never copied per Variant.
- **Audio policy unchanged:** premium Episode audio stays protected
  (`private, no-store`, live entitlement revalidation, Range support).
- Artwork/vocabulary/transcript/audio are NOT added to the PWA precache.

## API contract (Slice 2)

Extended lesson list/detail (legacy fields preserved):

```
episode:   { id, slug, contentKey, title, titleFa, descriptionFa,
             category: {id,key,slug,titleFa} | null,
             artwork, heroImage, featured }
variant:   { id, level, summaryFa, transcript, audioDurationSeconds,
             publicationStatus }
recommendedLevel, preferredLevel
availableLevels: [{ level, variantId, available, isRecommended, isPreferred }]
vocabularyCount   (detail only — avoids N+1 in lists)
```

- `GET /api/fast-english/lessons?level=B2` — browsing level parameter
  (validated against A1–C2; default preferredLevel; invalid → 400).
  Browsing is read-only.
- `availableLevels` contains only Published Variants whose parent Episode
  and Category are Published, sorted in canonical CEFR order
  (A1, A2, B1, B2, C1, C2). Draft/archived Variant IDs never appear.
- Responses never expose raw file paths, internal storage names,
  unpublished Variant IDs, Draft metadata, archived content, or
  Staff-only import metadata.

## Indexes (Slice 2 additions)

`categories(publication_status, sort_order)`, `topics(content_key)` (U),
`topics(category, status, published_at)`, `lessons(status, published_at)`,
`lesson_vocabulary(lesson, normalized_term)` (U),
`lesson_vocabulary(lesson, sort_order)`. `topics(slug)` (U) and
`lesson_progress(user, lesson)` (U) already existed and are preserved.
(Note: topics/lessons publish under the field name `status`, so the
`publication_status` indexes from the slice brief map to `status`.)

## Cross-level authorization change

The selected-level equality check was removed as an authorization
requirement from: lesson list (level is now a browsing parameter), lesson
detail, audio proxy, progress GET/PUT. Preserved: active Subscription,
account status, Placement completion, published states (Category, Episode,
Variant), live entitlement checks, audio-token revalidation, Progress
revision protection, and the Student/Staff boundary.

Dashboard and Continue Learning stay scoped to the preferred level
(`selected_level`) — cross-level Progress never inflates default-level
Dashboard counts. Dashboard/summary/continue also filter by published
Category so Category archival hides child content from counts.

## Staff Content Studio (Podcast Slice 4)

- **Bounded Staff routes** (`server/pb_hooks/content_admin_routes.pb.js`)
  replace direct CRUD: categories, episodes, variants, vocabulary,
  artwork/hero/audio/pronunciation media, transcript saves, publish/
  archive, reorder, feature toggles, a staff-only draft preview and
  staff-only media serving (Range for audio, `private, no-store`, no
  storage names in responses). Every route requires an active
  `staff_admins` session; publication invariants are re-checked on the
  server (the main.pb.js hooks remain the final gate).
- **Authoritative readiness** is computed server-side per Episode and
  Variant (`{ ready, legacy, errors[], warnings[], preconditions[] }`):
  errors block publish; warnings do not; currently-published content
  missing new fields reads as ready with a "republish will require…"
  warning (grandfathering preserved); variant preconditions guide the
  Staff to publish the parent Episode/Category first. The UI renders the
  server payload — no client-side readiness authority.
- **Publish/archive rules:** publishing a Variant requires a published
  parent Episode and Category; publishing an Episode requires a
  published Category. Archive hides content from every Student surface
  and never deletes records or Progress; media removal is blocked for
  published content (would violate the invariants).
- **Preview policy:** Draft content stays inaccessible to Students (404/
  403); Staff preview uses a dedicated authenticated API and never marks
  Draft content Published.
